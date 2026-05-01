import uuid
from typing import Optional

from sqlalchemy import update as sa_update
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
