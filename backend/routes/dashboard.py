import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from core.auth_dep import get_current_user_id
from db.connection import get_db
from db.repositories.ats_repo import get_evaluation, list_evaluations_by_resume
from db.repositories.parsed_resume_repo import get_parsed_by_resume_id, upsert_parsed_data
from db.repositories.resume_repo import get_resume, list_resumes_with_latest_score
from services.extraction_service import extract_text
from services.llm_service import extract_resume_data
from services.s3_service import download_file, get_presigned_url

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/resumes", tags=["dashboard"])

PRESIGNED_URL_TTL = 900  # 15 minutes


def _serialize_resume_row(row: dict) -> dict:
    return {
        "resume_id": str(row["resume_id"]),
        "original_filename": row.get("original_filename"),
        "uploaded_at": row["uploaded_at"].isoformat() if row.get("uploaded_at") else None,
        "latest_ats_score": row.get("latest_ats_score"),
        "latest_analysis_at": (
            row["latest_analysis_at"].isoformat() if row.get("latest_analysis_at") else None
        ),
    }


def _serialize_evaluation(record) -> dict:
    return {
        "id": str(record.id),
        "resume_id": str(record.resume_id),
        "timestamp": record.timestamp.isoformat() if record.timestamp else None,
        "ats_score": record.ats_score,
        "match_percentage": record.match_percentage,
        "matching_skills": record.matching_skills or [],
        "experience_fit": record.experience_fit,
        "strengths": record.strengths or [],
        "weaknesses": record.weaknesses or [],
        "missing_keywords": record.missing_keywords or [],
        "formatting_feedback": record.formatting_feedback,
        "match_report": record.match_report,
        "jd_text": record.jd_text,
        "jd_title": record.jd_title,
    }


@router.get("")
async def list_resumes(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    current_user_id: str = Depends(get_current_user_id),
):
    offset = (page - 1) * page_size
    rows, total = await list_resumes_with_latest_score(
        db, user_id=current_user_id, limit=page_size, offset=offset
    )
    return {
        "items": [_serialize_resume_row(r) for r in rows],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


def _parse_resume_id(resume_id: str) -> uuid.UUID:
    try:
        return uuid.UUID(resume_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid resume_id format.")


async def _load_owned_resume(db: AsyncSession, resume_id: str, current_user_id: str):
    resume_uuid = _parse_resume_id(resume_id)
    resume = await get_resume(db, resume_id=resume_uuid)
    # 404 (not 403) — don't leak existence of other users' resumes
    if resume is None or resume.user_id != current_user_id:
        raise HTTPException(status_code=404, detail="Resume not found.")
    return resume


@router.get("/{resume_id}/analyses")
async def list_analyses(
    resume_id: str,
    db: AsyncSession = Depends(get_db),
    current_user_id: str = Depends(get_current_user_id),
):
    resume = await _load_owned_resume(db, resume_id, current_user_id)
    evaluations = await list_evaluations_by_resume(db, resume_id=resume.id)
    return {
        "resume_id": str(resume.id),
        "original_filename": resume.original_filename,
        "analyses": [_serialize_evaluation(e) for e in evaluations],
    }


@router.get("/{resume_id}/download-url")
async def get_resume_download_url(
    resume_id: str,
    db: AsyncSession = Depends(get_db),
    current_user_id: str = Depends(get_current_user_id),
):
    resume = await _load_owned_resume(db, resume_id, current_user_id)
    if not resume.s3_key:
        raise HTTPException(status_code=409, detail="Resume file is not available.")
    url = await get_presigned_url(resume.s3_key, expires_in=PRESIGNED_URL_TTL)
    return {"url": url, "expires_in": PRESIGNED_URL_TTL}


@router.get("/{resume_id}/parsed")
async def get_parsed_resume(
    resume_id: str,
    db: AsyncSession = Depends(get_db),
    current_user_id: str = Depends(get_current_user_id),
):
    resume = await _load_owned_resume(db, resume_id, current_user_id)
    parsed = await get_parsed_by_resume_id(db, resume_id=resume.id)
    if parsed is None:
        # Parsing is best-effort during upload; row may be absent if Ollama was down.
        raise HTTPException(status_code=404, detail="Parsed resume not available.")
    return {
        "resume_id": str(resume.id),
        "parsed_data": parsed.parsed_data or {},
    }


@router.post("/{resume_id}/reparse")
async def reparse_resume(
    resume_id: str,
    db: AsyncSession = Depends(get_db),
    current_user_id: str = Depends(get_current_user_id),
):
    resume = await _load_owned_resume(db, resume_id, current_user_id)
    if not resume.s3_key:
        raise HTTPException(status_code=409, detail="Original resume file is not available.")

    try:
        content = await download_file(resume.s3_key)
    except Exception as exc:
        logger.exception("S3 download failed during reparse for resume_id=%s", resume_id)
        raise HTTPException(status_code=502, detail="Failed to fetch original file.") from exc

    content_type = "application/pdf" if resume.s3_key.lower().endswith(".pdf") else "application/docx"

    try:
        raw_text = await extract_text(content, content_type)
        parsed_data = await extract_resume_data(raw_text)
    except Exception as exc:
        logger.exception("Reparse pipeline failed for resume_id=%s", resume_id)
        raise HTTPException(status_code=503, detail="AI service unavailable — is Ollama running?") from exc

    await upsert_parsed_data(
        db,
        resume_id=resume.id,
        user_id=resume.user_id,
        raw_text=raw_text,
        parsed_data=parsed_data,
    )
    return {
        "resume_id": str(resume.id),
        "parsed_data": parsed_data or {},
    }


# ----- Single-analysis endpoint (mounted at /api/analyses/{id} via separate router) -----

analyses_router = APIRouter(prefix="/analyses", tags=["dashboard"])


@analyses_router.get("/{analysis_id}")
async def get_single_analysis(
    analysis_id: str,
    db: AsyncSession = Depends(get_db),
    current_user_id: str = Depends(get_current_user_id),
):
    try:
        analysis_uuid = uuid.UUID(analysis_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid analysis_id format.")

    evaluation = await get_evaluation(db, evaluation_id=analysis_uuid)
    if evaluation is None:
        raise HTTPException(status_code=404, detail="Analysis not found.")

    # Ownership check via the parent resume
    resume = await get_resume(db, resume_id=evaluation.resume_id)
    if resume is None or resume.user_id != current_user_id:
        raise HTTPException(status_code=404, detail="Analysis not found.")

    return {
        **_serialize_evaluation(evaluation),
        "resume_filename": resume.original_filename,
    }
