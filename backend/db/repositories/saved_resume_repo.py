import uuid
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import SavedResume


async def insert_saved_resume(
    db: AsyncSession,
    *,
    user_id: str,
    name: str,
    company: Optional[str],
    resume_data: dict,
) -> SavedResume:
    record = SavedResume(
        id=uuid.uuid4(),
        user_id=user_id,
        name=name,
        company=company,
        resume_data=resume_data,
    )
    db.add(record)
    await db.flush()
    await db.refresh(record)
    return record


async def list_saved_resumes(
    db: AsyncSession,
    *,
    user_id: str,
    limit: int,
    offset: int,
) -> tuple[list[SavedResume], int]:
    rows_result = await db.execute(
        select(SavedResume)
        .where(SavedResume.user_id == user_id)
        .order_by(SavedResume.saved_at.desc())
        .limit(limit)
        .offset(offset)
    )
    items = list(rows_result.scalars().all())

    count_result = await db.execute(
        select(func.count()).select_from(SavedResume).where(SavedResume.user_id == user_id)
    )
    total = int(count_result.scalar_one())
    return items, total


async def get_saved_resume(
    db: AsyncSession,
    *,
    saved_resume_id: uuid.UUID,
) -> Optional[SavedResume]:
    result = await db.execute(
        select(SavedResume).where(SavedResume.id == saved_resume_id)
    )
    return result.scalar_one_or_none()


async def delete_saved_resume(
    db: AsyncSession,
    *,
    saved_resume_id: uuid.UUID,
) -> None:
    record = await get_saved_resume(db, saved_resume_id=saved_resume_id)
    if record is not None:
        await db.delete(record)
