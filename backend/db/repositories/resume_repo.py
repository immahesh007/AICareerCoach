import uuid
from typing import Optional

from sqlalchemy import func, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import ResumeMetadata, ResumeStatus


async def create_pending(
    db: AsyncSession,
    *,
    user_id: str,
    size: float,
    original_filename: Optional[str] = None,
) -> ResumeMetadata:
    record = ResumeMetadata(
        id=uuid.uuid4(),
        user_id=user_id,
        status=ResumeStatus.PENDING,
        size=size,
        s3_key=None,
        original_filename=original_filename,
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


async def get_resume(
    db: AsyncSession,
    *,
    resume_id: uuid.UUID,
) -> Optional[ResumeMetadata]:
    result = await db.execute(
        select(ResumeMetadata).where(ResumeMetadata.id == resume_id)
    )
    return result.scalar_one_or_none()


async def list_resumes_with_latest_score(
    db: AsyncSession,
    *,
    user_id: str,
    limit: int,
    offset: int,
) -> tuple[list[dict], int]:
    """Returns (rows, total_count). Each row: resume_id, original_filename, s3_key,
    status, uploaded_at, latest_ats_score (nullable). Only SUCCESS-status resumes are listed."""
    rows_result = await db.execute(
        text(
            """
            SELECT
                r.id              AS resume_id,
                r.original_filename,
                r.s3_key,
                r.status::text    AS status,
                r.uploaded_at,
                e.ats_score       AS latest_ats_score,
                e.timestamp       AS latest_analysis_at
            FROM resume_metadata r
            LEFT JOIN LATERAL (
                SELECT ats_score, timestamp
                FROM ats_evaluations
                WHERE resume_id = r.id
                ORDER BY timestamp DESC
                LIMIT 1
            ) e ON true
            WHERE r.user_id = :user_id
              AND r.status = 'SUCCESS'
            ORDER BY r.uploaded_at DESC
            LIMIT :limit OFFSET :offset
            """
        ),
        {"user_id": user_id, "limit": limit, "offset": offset},
    )
    rows = [dict(row._mapping) for row in rows_result]

    count_result = await db.execute(
        select(func.count()).select_from(ResumeMetadata).where(
            ResumeMetadata.user_id == user_id,
            ResumeMetadata.status == ResumeStatus.SUCCESS,
        )
    )
    total = int(count_result.scalar_one())

    return rows, total
