import uuid
from typing import Optional

from sqlalchemy import select, update as sa_update
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import ParsedResume


async def insert_parsed(
    db: AsyncSession,
    *,
    resume_id: uuid.UUID,
    user_id: str,
    raw_text: Optional[str],
    parsed_data: dict,
) -> ParsedResume:
    record = ParsedResume(
        id=uuid.uuid4(),
        resume_id=resume_id,
        user_id=user_id,
        raw_text=raw_text,
        parsed_data=parsed_data or {},  # JSONB column is NOT NULL
    )
    db.add(record)
    await db.flush()
    await db.refresh(record)
    return record


async def update_parsed_jd(
    db: AsyncSession,
    *,
    resume_id: uuid.UUID,
    parsed_jd: dict,
) -> None:
    await db.execute(
        sa_update(ParsedResume)
        .where(ParsedResume.resume_id == resume_id)
        .values(parsed_jd=parsed_jd)
    )


async def get_parsed_by_resume_id(
    db: AsyncSession,
    resume_id: uuid.UUID,
) -> Optional[ParsedResume]:
    result = await db.execute(
        select(ParsedResume).where(ParsedResume.resume_id == resume_id)
    )
    return result.scalar_one_or_none()


async def has_parsed_data(
    db: AsyncSession,
    resume_ids: list[uuid.UUID],
) -> set[uuid.UUID]:
    """Return the subset of resume_ids that have a parsed_resumes row."""
    from sqlalchemy import select

    from db.models import ParsedResume

    if not resume_ids:
        return set()
    result = await db.execute(
        select(ParsedResume.resume_id).where(ParsedResume.resume_id.in_(resume_ids))
    )
    return {row[0] for row in result.all()}


async def upsert_parsed_data(
    db: AsyncSession,
    *,
    resume_id: uuid.UUID,
    user_id: str,
    raw_text: Optional[str],
    parsed_data: dict,
) -> ParsedResume:
    existing = await get_parsed_by_resume_id(db, resume_id)
    if existing is None:
        return await insert_parsed(
            db,
            resume_id=resume_id,
            user_id=user_id,
            raw_text=raw_text,
            parsed_data=parsed_data,
        )
    await db.execute(
        sa_update(ParsedResume)
        .where(ParsedResume.resume_id == resume_id)
        .values(raw_text=raw_text, parsed_data=parsed_data or {})
    )
    await db.refresh(existing)
    return existing
