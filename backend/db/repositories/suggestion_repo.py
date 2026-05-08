import uuid
from typing import Optional

from sqlalchemy import select, update as sa_update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import func

from db.models import ResumeSuggestion


async def insert_suggestions(
    db: AsyncSession,
    *,
    evaluation_id: uuid.UUID,
    resume_id: uuid.UUID,
    suggestions: dict,
    model: str,
) -> ResumeSuggestion:
    record = ResumeSuggestion(
        id=uuid.uuid4(),
        evaluation_id=evaluation_id,
        resume_id=resume_id,
        suggestions=suggestions,
        model=model,
    )
    db.add(record)
    await db.flush()
    await db.refresh(record)
    return record


async def get_suggestion(
    db: AsyncSession,
    *,
    suggestion_id: uuid.UUID,
) -> Optional[ResumeSuggestion]:
    result = await db.execute(
        select(ResumeSuggestion).where(ResumeSuggestion.id == suggestion_id)
    )
    return result.scalar_one_or_none()


async def get_latest_for_evaluation(
    db: AsyncSession,
    *,
    evaluation_id: uuid.UUID,
) -> Optional[ResumeSuggestion]:
    result = await db.execute(
        select(ResumeSuggestion)
        .where(ResumeSuggestion.evaluation_id == evaluation_id)
        .order_by(ResumeSuggestion.generated_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def record_decisions(
    db: AsyncSession,
    *,
    suggestion_id: uuid.UUID,
    decisions: dict,
) -> None:
    """Overwrite the decisions JSONB and stamp decided_at. Idempotent."""
    await db.execute(
        sa_update(ResumeSuggestion)
        .where(ResumeSuggestion.id == suggestion_id)
        .values(decisions=decisions, decided_at=func.now())
    )
