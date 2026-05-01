import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from db.connection import get_db
from db.repositories.parsed_resume_repo import update_parsed_jd
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

    # ── PLACEHOLDER: ATS scoring algorithm goes here ──────────────────────
    # ats_score = await compute_ats_score(parsed_jd, resume_id)
    # ─────────────────────────────────────────────────────────────────────

    return {
        "file_id": request.file_id,
        "parsed_jd": parsed_jd,
        "message": "Job description parsed successfully. ATS scoring coming soon.",
    }
