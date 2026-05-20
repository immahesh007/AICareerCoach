import uuid
from typing import Optional

from sqlalchemy import func, select, update as sa_update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import JobGeneratedResume, JobMatch, JobMatchBatch, JobMatchTask


# ── JobMatch (cached match API response) ──────────────────────────────────

async def upsert_job_match(
    db: AsyncSession,
    *,
    resume_id: uuid.UUID,
    user_id: str,
    match_results: dict,
) -> JobMatch:
    # Fetch the newest row — tolerate duplicates (unique constraint added in 011).
    result = await db.execute(
        select(JobMatch)
        .where(JobMatch.resume_id == resume_id)
        .order_by(JobMatch.matched_at.desc())
        .limit(1)
    )
    record = result.scalar_one_or_none()
    if record is None:
        record = JobMatch(
            id=uuid.uuid4(),
            resume_id=resume_id,
            user_id=user_id,
            match_results=match_results,
        )
        db.add(record)
        await db.flush()
        await db.refresh(record)
    else:
        # Update the newest row and delete any older duplicates.
        await db.execute(
            sa_update(JobMatch)
            .where(JobMatch.id == record.id)
            .values(match_results=match_results, matched_at=func.now())
        )
        from sqlalchemy import delete as sa_delete
        await db.execute(
            sa_delete(JobMatch)
            .where(JobMatch.resume_id == resume_id, JobMatch.id != record.id)
        )
        await db.refresh(record)
    return record


async def get_job_match(
    db: AsyncSession,
    resume_id: uuid.UUID,
) -> Optional[JobMatch]:
    result = await db.execute(
        select(JobMatch)
        .where(JobMatch.resume_id == resume_id)
        .order_by(JobMatch.matched_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


# ── JobMatchBatch ─────────────────────────────────────────────────────────

async def insert_batch(
    db: AsyncSession,
    *,
    resume_id: uuid.UUID,
    user_id: str,
    total_tasks: int,
) -> JobMatchBatch:
    record = JobMatchBatch(
        id=uuid.uuid4(),
        resume_id=resume_id,
        user_id=user_id,
        total_tasks=total_tasks,
        status="pending",
    )
    db.add(record)
    await db.flush()
    await db.refresh(record)
    return record


async def get_batch(
    db: AsyncSession,
    batch_id: uuid.UUID,
) -> Optional[JobMatchBatch]:
    result = await db.execute(select(JobMatchBatch).where(JobMatchBatch.id == batch_id))
    return result.scalar_one_or_none()


async def update_batch_status(
    db: AsyncSession,
    *,
    batch_id: uuid.UUID,
    status: str,
    completed_tasks: Optional[int] = None,
) -> None:
    values = {"status": status}
    if completed_tasks is not None:
        values["completed_tasks"] = completed_tasks
    await db.execute(
        sa_update(JobMatchBatch).where(JobMatchBatch.id == batch_id).values(**values)
    )


# ── JobMatchTask ──────────────────────────────────────────────────────────

async def insert_tasks(
    db: AsyncSession,
    *,
    batch_id: uuid.UUID,
    jobs: list[dict],
) -> list[JobMatchTask]:
    records = []
    for job in jobs:
        record = JobMatchTask(
            id=uuid.uuid4(),
            batch_id=batch_id,
            job_id=job["job_id"],
            job_title=job.get("title"),
            company=job.get("company"),
            location=job.get("location"),
            match_score=job.get("final_score"),
            missing_skills=job.get("missing_skills") or [],
            status="pending",
        )
        db.add(record)
        records.append(record)
    await db.flush()
    return records


async def list_tasks_by_batch(
    db: AsyncSession,
    batch_id: uuid.UUID,
) -> list[JobMatchTask]:
    result = await db.execute(
        select(JobMatchTask)
        .where(JobMatchTask.batch_id == batch_id)
        .order_by(JobMatchTask.created_at)
    )
    return list(result.scalars().all())


async def get_next_pending_task(
    db: AsyncSession,
    batch_id: uuid.UUID,
) -> Optional[JobMatchTask]:
    result = await db.execute(
        select(JobMatchTask)
        .where(JobMatchTask.batch_id == batch_id, JobMatchTask.status == "pending")
        .order_by(JobMatchTask.created_at)
        .limit(1)
    )
    return result.scalar_one_or_none()


async def update_task_status(
    db: AsyncSession,
    *,
    task_id: uuid.UUID,
    status: str,
    generated_id: Optional[uuid.UUID] = None,
    error_message: Optional[str] = None,
) -> None:
    values = {"status": status}
    if generated_id is not None:
        values["generated_id"] = generated_id
    if error_message is not None:
        values["error_message"] = error_message
    if status in ("completed", "failed"):
        values["completed_at"] = func.now()
    await db.execute(
        sa_update(JobMatchTask).where(JobMatchTask.id == task_id).values(**values)
    )


async def count_completed_tasks(
    db: AsyncSession,
    batch_id: uuid.UUID,
) -> int:
    result = await db.execute(
        select(func.count())
        .select_from(JobMatchTask)
        .where(
            JobMatchTask.batch_id == batch_id,
            JobMatchTask.status.in_(["completed", "failed"]),
        )
    )
    return int(result.scalar_one())


# ── JobGeneratedResume ────────────────────────────────────────────────────

async def insert_generated_resume(
    db: AsyncSession,
    *,
    resume_id: uuid.UUID,
    user_id: str,
    job_id: str,
    job_title: Optional[str],
    company: Optional[str],
    location: Optional[str],
    match_score: Optional[float],
    generated_data: dict,
    s3_key: Optional[str] = None,
) -> JobGeneratedResume:
    stmt = (
        pg_insert(JobGeneratedResume)
        .values(
            id=uuid.uuid4(),
            resume_id=resume_id,
            user_id=user_id,
            job_id=job_id,
            job_title=job_title,
            company=company,
            location=location,
            match_score=match_score,
            generated_data=generated_data,
            s3_key=s3_key,
        )
        .on_conflict_do_update(
            constraint="uq_job_generated_resumes_resume_job",
            set_={
                "user_id": user_id,
                "job_title": job_title,
                "company": company,
                "location": location,
                "match_score": match_score,
                "generated_data": generated_data,
                "s3_key": s3_key,
            },
        )
        .returning(JobGeneratedResume)
    )
    result = await db.execute(stmt)
    record = result.scalar_one()
    await db.flush()
    return record


async def get_generated_resume(
    db: AsyncSession,
    generated_id: uuid.UUID,
) -> Optional[JobGeneratedResume]:
    result = await db.execute(
        select(JobGeneratedResume).where(JobGeneratedResume.id == generated_id)
    )
    return result.scalar_one_or_none()


async def list_generated_ids_for_resume(
    db: AsyncSession,
    resume_id: uuid.UUID,
) -> dict[str, uuid.UUID]:
    """Return mapping of job_id → generated_id for all generated resumes of a resume."""
    result = await db.execute(
        select(JobGeneratedResume.job_id, JobGeneratedResume.id)
        .where(JobGeneratedResume.resume_id == resume_id)
    )
    return {row.job_id: row.id for row in result.all()}


async def get_existing_generated_resume(
    db: AsyncSession,
    resume_id: uuid.UUID,
    job_id: str,
) -> Optional[JobGeneratedResume]:
    """Get the generated resume for a specific (resume, job) pair if it exists."""
    result = await db.execute(
        select(JobGeneratedResume)
        .where(JobGeneratedResume.resume_id == resume_id, JobGeneratedResume.job_id == job_id)
    )
    return result.scalar_one_or_none()
