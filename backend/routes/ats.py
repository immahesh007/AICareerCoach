import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from db.connection import get_db
from db.repositories.parsed_resume_repo import update_parsed_jd
from services.ats_service import compute_ats_score
from services.llm_service import extract_jd_data

router = APIRouter()


class KnowATSRequest(BaseModel):
    file_id: str
    jobDescription: str = Field(min_length=1, max_length=5000)


@router.post("/know-ats")
async def know_ats(
    request: KnowATSRequest,
    db: AsyncSession = Depends(get_db),
):
    try:
        resume_uuid = uuid.UUID(request.file_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid file_id format.")

    parsed_jd = await extract_jd_data(request.jobDescription)

    await update_parsed_jd(db, resume_id=resume_uuid, parsed_jd=parsed_jd)

    evaluation = await compute_ats_score(db, resume_id=resume_uuid, parsed_jd=parsed_jd)

    return {
        "file_id": request.file_id,
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
