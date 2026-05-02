import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from db.models import ATSEvaluation


async def insert_evaluation(
    db: AsyncSession,
    *,
    resume_id: uuid.UUID,
    ats_score: int,
    strengths: list,
    weaknesses: list,
    missing_keywords: list,
    formatting_feedback: str,
    match_report: str,
) -> ATSEvaluation:
    record = ATSEvaluation(
        id=uuid.uuid4(),
        resume_id=resume_id,
        ats_score=ats_score,
        strengths=strengths,
        weaknesses=weaknesses,
        missing_keywords=missing_keywords,
        formatting_feedback=formatting_feedback,
        match_report=match_report,
    )
    db.add(record)
    await db.flush()
    await db.refresh(record)
    return record
