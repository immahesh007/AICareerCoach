import logging
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from core.auth_dep import get_current_user_id
from db.connection import get_db
from db.repositories.ats_repo import get_evaluation
from db.repositories.parsed_resume_repo import get_parsed_by_resume_id, update_parsed_jd
from db.repositories.resume_repo import get_resume
from db.repositories.suggestion_repo import (
    get_suggestion,
    insert_suggestions,
    record_decisions,
)
from services.ats_service import compute_ats_score
from services.llm_service import extract_jd_data
from services.suggestion_service import generate_suggestions

logger = logging.getLogger(__name__)

router = APIRouter()


class KnowATSRequest(BaseModel):
    file_id: str
    jobDescription: str = Field(min_length=1, max_length=5000)
    jd_title: Optional[str] = Field(default=None, max_length=200)


@router.post("/know-ats")
async def know_ats(
    request: KnowATSRequest,
    db: AsyncSession = Depends(get_db),
    current_user_id: str = Depends(get_current_user_id),
):
    try:
        resume_uuid = uuid.UUID(request.file_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid file_id format.")

    resume = await get_resume(db, resume_id=resume_uuid)
    if resume is None or resume.user_id != current_user_id:
        # 404 (not 403) — don't leak existence of other users' resumes
        raise HTTPException(status_code=404, detail="Resume not found.")

    try:
        parsed_jd = await extract_jd_data(request.jobDescription)
    except Exception as exc:
        logger.exception("Ollama JD extraction failed")
        raise HTTPException(status_code=503, detail="AI service unavailable — is Ollama running?") from exc

    await update_parsed_jd(db, resume_id=resume_uuid, parsed_jd=parsed_jd)

    try:
        evaluation = await compute_ats_score(
            db,
            resume_id=resume_uuid,
            parsed_jd=parsed_jd,
            jd_text=request.jobDescription,
            jd_title=request.jd_title,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("ATS scoring failed")
        raise HTTPException(status_code=503, detail="AI service unavailable — is Ollama running?") from exc

    return {
        "file_id": request.file_id,
        "evaluation_id": evaluation.get("evaluation_id"),
        "parsed_jd": parsed_jd,
        "ats_score": evaluation.get("ats_score", 0),
        "match_percentage": evaluation.get("match_percentage", 0),
        "matching_skills": evaluation.get("matching_skills", []),
        "experience_fit": evaluation.get("experience_fit", ""),
        "strengths": evaluation.get("strengths", []),
        "weaknesses": evaluation.get("weaknesses", []),
        "missing_keywords": evaluation.get("missing_keywords", []),
        "formatting_feedback": evaluation.get("formatting_feedback", ""),
        "match_report": evaluation.get("match_report", ""),
        "message": "ATS analysis complete.",
    }


class SuggestModificationsRequest(BaseModel):
    evaluation_id: str


@router.post("/suggest-modifications")
async def suggest_modifications(
    request: SuggestModificationsRequest,
    db: AsyncSession = Depends(get_db),
    current_user_id: str = Depends(get_current_user_id),
):
    try:
        evaluation_uuid = uuid.UUID(request.evaluation_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid evaluation_id format.")

    evaluation = await get_evaluation(db, evaluation_id=evaluation_uuid)
    if evaluation is None:
        raise HTTPException(status_code=404, detail="Evaluation not found.")

    resume = await get_resume(db, resume_id=evaluation.resume_id)
    if resume is None or resume.user_id != current_user_id:
        # 404 (not 403) — don't leak existence of other users' resumes
        raise HTTPException(status_code=404, detail="Evaluation not found.")

    parsed = await get_parsed_by_resume_id(db, evaluation.resume_id)
    if parsed is None or not parsed.parsed_data:
        raise HTTPException(
            status_code=409,
            detail="Resume has not been parsed yet — cannot generate suggestions.",
        )

    evaluation_payload = {
        "weaknesses": evaluation.weaknesses or [],
        "missing_keywords": evaluation.missing_keywords or [],
        "experience_fit": evaluation.experience_fit or "",
        "match_report": evaluation.match_report or "",
    }

    try:
        result = await generate_suggestions(
            parsed_resume=parsed.parsed_data,
            parsed_jd=parsed.parsed_jd,
            jd_text=evaluation.jd_text,
            evaluation=evaluation_payload,
        )
    except Exception as exc:
        logger.exception("Suggestion generation failed")
        raise HTTPException(
            status_code=503, detail="AI service unavailable — is Ollama running?"
        ) from exc

    record = await insert_suggestions(
        db,
        evaluation_id=evaluation.id,
        resume_id=evaluation.resume_id,
        suggestions=result["suggestions"],
        model=result["model"],
    )

    return {
        "suggestion_id": str(record.id),
        "evaluation_id": str(evaluation.id),
        "resume_id": str(evaluation.resume_id),
        **result,
    }


class RecordDecisionsRequest(BaseModel):
    decisions: dict[str, bool]


@router.post("/suggest-modifications/{suggestion_id}/decisions")
async def record_suggestion_decisions(
    suggestion_id: str,
    request: RecordDecisionsRequest,
    db: AsyncSession = Depends(get_db),
    current_user_id: str = Depends(get_current_user_id),
):
    try:
        suggestion_uuid = uuid.UUID(suggestion_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid suggestion_id format.")

    suggestion = await get_suggestion(db, suggestion_id=suggestion_uuid)
    if suggestion is None:
        raise HTTPException(status_code=404, detail="Suggestion not found.")

    resume = await get_resume(db, resume_id=suggestion.resume_id)
    if resume is None or resume.user_id != current_user_id:
        # 404 (not 403) — don't leak existence of other users' suggestions
        raise HTTPException(status_code=404, detail="Suggestion not found.")

    await record_decisions(
        db,
        suggestion_id=suggestion_uuid,
        decisions=request.decisions,
    )

    return {"suggestion_id": suggestion_id, "recorded": len(request.decisions)}
