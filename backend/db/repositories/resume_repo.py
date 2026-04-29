import uuid

from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import ResumeMetadata, ResumeStatus


async def create_pending(
    db: AsyncSession,
    *,
    user_id: str,
    size: float,
) -> ResumeMetadata:
    record = ResumeMetadata(
        id=uuid.uuid4(),
        user_id=user_id,
        status=ResumeStatus.PENDING,
        size=size,
        s3_key=None,
    )
    db.add(record)
    await db.flush()    # write to DB within transaction; validates constraints
    await db.refresh(record)  # reload to populate server_default fields (uploaded_at)
    return record


async def update_success(
    db: AsyncSession,
    *,
    file_id: uuid.UUID,
    s3_key: str,
) -> None:
    await db.execute(
        update(ResumeMetadata)
        .where(ResumeMetadata.id == file_id)
        .values(status=ResumeStatus.SUCCESS, s3_key=s3_key)
    )


async def update_failed(
    db: AsyncSession,
    *,
    file_id: uuid.UUID,
) -> None:
    await db.execute(
        update(ResumeMetadata)
        .where(ResumeMetadata.id == file_id)
        .values(status=ResumeStatus.FAILED)
    )
