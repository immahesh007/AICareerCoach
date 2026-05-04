import uuid
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import ATSEvaluation


async def insert_evaluation(
    db: AsyncSession,
    *,
    resume_id: uuid.UUID,
    ats_score: int,
    match_percentage: int,
    matching_skills: list,
    experience_fit: str,
    strengths: list,
    weaknesses: list,
    missing_keywords: list,
    formatting_feedback: str,
    match_report: str,
    jd_text: Optional[str] = None,
    jd_title: Optional[str] = None,
) -> ATSEvaluation:
    record = ATSEvaluation(
        id=uuid.uuid4(),
        resume_id=resume_id,
        ats_score=ats_score,
        match_percentage=match_percentage,
        matching_skills=matching_skills,
        experience_fit=experience_fit,
        strengths=strengths,
        weaknesses=weaknesses,
        missing_keywords=missing_keywords,
        formatting_feedback=formatting_feedback,
        match_report=match_report,
        jd_text=jd_text,
        jd_title=jd_title,
    )
    db.add(record)
    await db.flush()
    await db.refresh(record)
    return record


async def list_evaluations_by_resume(
    db: AsyncSession,
    *,
    resume_id: uuid.UUID,
) -> list[ATSEvaluation]:
    result = await db.execute(
        select(ATSEvaluation)
        .where(ATSEvaluation.resume_id == resume_id)
        .order_by(ATSEvaluation.timestamp.desc())
    )
    return list(result.scalars().all())


async def get_evaluation(
    db: AsyncSession,
    *,
    evaluation_id: uuid.UUID,
) -> Optional[ATSEvaluation]:
    result = await db.execute(
        select(ATSEvaluation).where(ATSEvaluation.id == evaluation_id)
    )
    return result.scalar_one_or_none()
