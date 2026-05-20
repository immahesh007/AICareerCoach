import asyncio
import logging
import uuid
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from core.auth_dep import get_current_user_id
from core.config import settings
from db.connection import AsyncSessionLocal, get_db
from db.models import JobMatchTask
from db.repositories import job_match_repo, parsed_resume_repo, resume_repo
from services.llm_service import enhance_resume_for_job
from services.s3_service import delete_file, get_presigned_url, upload_file

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/resumes", tags=["job-matching"])
batches_router = APIRouter(prefix="/batches", tags=["job-matching"])

PAGE_SIZE_DEFAULT = 10

# ═══════════════════════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════════════════════


def _parse_resume_id(resume_id: str) -> uuid.UUID:
    try:
        return uuid.UUID(resume_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid resume_id format.")


async def _load_owned_resume(db: AsyncSession, resume_id: str, current_user_id: str):
    rid = _parse_resume_id(resume_id)
    resume = await resume_repo.get_resume(db, resume_id=rid)
    if resume is None or resume.user_id != current_user_id:
        raise HTTPException(status_code=404, detail="Resume not found.")
    return resume


def _build_match_payload(parsed_data: dict) -> dict:
    education_list = []
    for e in parsed_data.get("education") or []:
        if isinstance(e, dict):
            parts = [e.get("degree", ""), e.get("institution", ""), e.get("year", "")]
            education_list.append(" ".join(p for p in parts if p))
        else:
            education_list.append(str(e))

    experience_list = []
    for exp in parsed_data.get("experience") or []:
        if isinstance(exp, dict):
            desc = exp.get("description")
            if isinstance(desc, list):
                desc = "\n".join(desc)
            experience_list.append({
                "title": exp.get("title", ""),
                "company": exp.get("company", ""),
                "duration": exp.get("duration", ""),
                "description": desc or "",
            })

    return {
        "summary": parsed_data.get("summary", ""),
        "skills": parsed_data.get("skills") or [],
        "education": education_list,
        "experience": experience_list,
        "total_years_of_exp": parsed_data.get("total_years_experience") or 0,
        "preferred_location": "",
        "current_location": "",
    }


def _paginated_matches(match_results: dict, page: int, page_size: int) -> dict:
    matches = match_results.get("matches") or []
    total = match_results.get("total_matched", len(matches))
    start = (page - 1) * page_size
    end = start + page_size
    return {
        "items": matches[start:end],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": max(1, (total + page_size - 1) // page_size),
    }


# ═══════════════════════════════════════════════════════════════════════════
# POST /api/resumes/{resume_id}/match-jobs
# ═══════════════════════════════════════════════════════════════════════════


@router.post("/{resume_id}/job/match")
async def match_jobs(
    resume_id: str,
    db: AsyncSession = Depends(get_db),
    current_user_id: str = Depends(get_current_user_id),
):
    resume = await _load_owned_resume(db, resume_id, current_user_id)

    # Load parsed resume data
    parsed = await parsed_resume_repo.get_parsed_by_resume_id(db, resume_id=resume.id)
    if parsed is None or not parsed.parsed_data:
        raise HTTPException(status_code=400, detail="Resume has not been parsed yet.")

    # Check cache first
    cached = await job_match_repo.get_job_match(db, resume.id)
    if cached is not None:
        return {
            "resume_id": str(resume.id),
            "cached": True,
            "matched_at": cached.matched_at.isoformat() if cached.matched_at else None,
            **_paginated_matches(cached.match_results, 1, PAGE_SIZE_DEFAULT),
        }

    # Call job-match microservice
    payload = _build_match_payload(parsed.parsed_data)
    url = f"{settings.JOB_MATCH_SERVICE_URL}/api/jobs/match"
    logger.info("Calling job-match service at %s with skills=%d", url, len(payload.get("skills", [])))
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, json=payload)
            if resp.status_code != 200:
                logger.error(
                    "Job-match service returned %d: %s", resp.status_code, resp.text[:500]
                )
                detail = f"Job matching service returned {resp.status_code}."
                try:
                    body = resp.json()
                    if isinstance(body, dict) and body.get("detail"):
                        detail = body["detail"]
                except Exception:
                    if resp.text:
                        detail = resp.text[:500]
                raise HTTPException(status_code=502, detail=detail)
            match_results = resp.json()
    except httpx.TimeoutException:
        logger.error("Job-match service timed out: %s", url)
        raise HTTPException(status_code=504, detail="Job matching service timed out.")
    except httpx.ConnectError:
        logger.error("Job-match service connect error: %s", url)
        raise HTTPException(status_code=502, detail=f"Unable to connect to job matching service at {url}.")

    # Cache the result
    await job_match_repo.upsert_job_match(
        db,
        resume_id=resume.id,
        user_id=current_user_id,
        match_results=match_results,
    )
    await db.commit()

    return {
        "resume_id": str(resume.id),
        "cached": False,
        "matched_at": None,
        **_paginated_matches(match_results, 1, PAGE_SIZE_DEFAULT),
    }


# ═══════════════════════════════════════════════════════════════════════════
# GET /api/resumes/{resume_id}/matching-jobs
# ═══════════════════════════════════════════════════════════════════════════


@router.get("/{resume_id}/matching-jobs")
async def get_matching_jobs(
    resume_id: str,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    current_user_id: str = Depends(get_current_user_id),
):
    resume = await _load_owned_resume(db, resume_id, current_user_id)

    cached = await job_match_repo.get_job_match(db, resume.id)
    if cached is None:
        raise HTTPException(status_code=404, detail="No cached matches. Run match-jobs first.")

    # Enrich each job match with its generated_id if one exists
    generated_map = await job_match_repo.list_generated_ids_for_resume(db, resume.id)
    paginated = _paginated_matches(cached.match_results, page, page_size)
    for item in paginated["items"]:
        gid = generated_map.get(item.get("job_id", ""))
        item["generated_id"] = str(gid) if gid else None

    return {
        "resume_id": str(resume.id),
        "matched_at": cached.matched_at.isoformat() if cached.matched_at else None,
        **paginated,
    }


# ═══════════════════════════════════════════════════════════════════════════
# POST /api/resumes/{resume_id}/matching-jobs/generate
# ═══════════════════════════════════════════════════════════════════════════


class GenerateRequest(BaseModel):
    job_ids: list[str] = Field(default_factory=list, min_length=1)


@router.post("/{resume_id}/matching-jobs/generate")
async def generate_resumes_for_jobs(
    resume_id: str,
    body: GenerateRequest,
    db: AsyncSession = Depends(get_db),
    current_user_id: str = Depends(get_current_user_id),
):
    resume = await _load_owned_resume(db, resume_id, current_user_id)

    # Load cached match results
    cached = await job_match_repo.get_job_match(db, resume.id)
    if cached is None:
        raise HTTPException(status_code=400, detail="No job matches found. Run match-jobs first.")

    all_matches: list[dict] = cached.match_results.get("matches") or []
    selected = [m for m in all_matches if m.get("job_id") in body.job_ids]
    if not selected:
        raise HTTPException(status_code=400, detail="No valid jobs selected.")

    # Create batch
    batch = await job_match_repo.insert_batch(
        db,
        resume_id=resume.id,
        user_id=current_user_id,
        total_tasks=len(selected),
    )

    # Create tasks
    await job_match_repo.insert_tasks(db, batch_id=batch.id, jobs=selected)

    # Load parsed resume data (needed by the worker)
    parsed = await parsed_resume_repo.get_parsed_by_resume_id(db, resume_id=resume.id)
    parsed_data = parsed.parsed_data if parsed else {}

    await db.commit()

    # Kick off background worker (after commit so it sees the rows)
    asyncio.create_task(
        _process_batch(
            batch_id=batch.id,
            resume_id=resume.id,
            user_id=current_user_id,
            parsed_data=parsed_data,
        )
    )

    return {"batch_id": str(batch.id), "total_tasks": len(selected)}


async def _process_batch(
    *,
    batch_id: uuid.UUID,
    resume_id: uuid.UUID,
    user_id: str,
    parsed_data: dict,
):
    """Background worker — processes one task at a time, sequentially."""
    async with AsyncSessionLocal() as db:
        try:
            await job_match_repo.update_batch_status(
                db, batch_id=batch_id, status="processing"
            )
            await db.commit()

            while True:
                task = await job_match_repo.get_next_pending_task(db, batch_id)
                if task is None:
                    break

                await _process_single_task(
                    db, task, resume_id=resume_id, user_id=user_id, parsed_data=parsed_data
                )
                await db.commit()

            # All tasks done
            completed = await job_match_repo.count_completed_tasks(db, batch_id)
            tasks = await job_match_repo.list_tasks_by_batch(db, batch_id)
            all_done = sum(1 for t in tasks if t.status in ("completed", "failed"))
            final_status = "completed" if all(t.status in ("completed",) for t in tasks) else "partial"
            await job_match_repo.update_batch_status(
                db,
                batch_id=batch_id,
                status=final_status,
                completed_tasks=all_done,
            )
            await db.commit()

        except Exception:
            logger.exception("Batch %s failed", batch_id)
            try:
                await job_match_repo.update_batch_status(
                    db, batch_id=batch_id, status="partial"
                )
                await db.commit()
            except Exception:
                pass


async def _process_single_task(
    db: AsyncSession,
    task: JobMatchTask,
    *,
    resume_id: uuid.UUID,
    user_id: str,
    parsed_data: dict,
):
    """Enhance resume → generate PDF → store. Skip on failure, continue batch."""
    try:
        await job_match_repo.update_task_status(
            db, task_id=task.id, status="processing"
        )
        await db.commit()

        # 1) LLM enhance the resume data
        enhanced = await enhance_resume_for_job(
            resume_data=parsed_data,
            job_title=task.job_title or "",
            company=task.company or "",
            missing_skills=task.missing_skills or [],
        )

        # 2) Map to resume-builder format and generate PDF
        builder_payload = _parsed_to_builder(enhanced)
        pdf_bytes = await _generate_pdf(builder_payload, user_id)

        # 3) Upload PDF to S3
        s3_key = f"generated-resumes/{user_id}/{uuid.uuid4()}.pdf"
        await upload_file(pdf_bytes, s3_key, "application/pdf")

        # Delete old S3 object if overwriting an existing generated resume
        existing = await job_match_repo.get_existing_generated_resume(
            db, resume_id=resume_id, job_id=task.job_id
        )
        if existing and existing.s3_key:
            try:
                await delete_file(existing.s3_key)
            except Exception:
                logger.warning("Failed to delete old S3 key: %s", existing.s3_key)

        # 4) Store generated resume (UPSERT on resume_id + job_id)
        generated = await job_match_repo.insert_generated_resume(
            db,
            resume_id=resume_id,
            user_id=user_id,
            job_id=task.job_id,
            job_title=task.job_title,
            company=task.company,
            location=task.location,
            match_score=task.match_score,
            generated_data=enhanced,
            s3_key=s3_key,
        )

        await job_match_repo.update_task_status(
            db,
            task_id=task.id,
            status="completed",
            generated_id=generated.id,
        )
        await db.commit()

    except Exception as exc:
        logger.exception("Task %s failed", task.id)
        try:
            await job_match_repo.update_task_status(
                db,
                task_id=task.id,
                status="failed",
                error_message=str(exc),
            )
            await db.commit()
        except Exception:
            pass


async def _generate_pdf(data: dict, user_id: str) -> bytes:
    """Call resume-builder-service and return raw PDF bytes."""
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            f"{settings.RESUME_BUILDER_SERVICE_URL}/generate",
            json=data,
        )
    if resp.status_code != 200:
        raise RuntimeError(f"PDF generation failed: {resp.status_code}")
    return resp.content


# ═══════════════════════════════════════════════════════════════════════════
# GET /api/batches/{batch_id}
# ═══════════════════════════════════════════════════════════════════════════


@batches_router.get("/{batch_id}")
async def get_batch_status(
    batch_id: str,
    db: AsyncSession = Depends(get_db),
    current_user_id: str = Depends(get_current_user_id),
):
    try:
        bid = uuid.UUID(batch_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid batch_id format.")

    batch = await job_match_repo.get_batch(db, bid)
    if batch is None or batch.user_id != current_user_id:
        raise HTTPException(status_code=404, detail="Batch not found.")

    tasks = await job_match_repo.list_tasks_by_batch(db, bid)

    def _serialize_task(t: JobMatchTask) -> dict:
        return {
            "task_id": str(t.id),
            "job_id": t.job_id,
            "job_title": t.job_title,
            "company": t.company,
            "location": t.location,
            "match_score": t.match_score,
            "status": t.status,
            "generated_id": str(t.generated_id) if t.generated_id else None,
            "error_message": t.error_message,
            "created_at": t.created_at.isoformat() if t.created_at else None,
            "completed_at": t.completed_at.isoformat() if t.completed_at else None,
        }

    return {
        "batch_id": str(batch.id),
        "resume_id": str(batch.resume_id),
        "status": batch.status,
        "total_tasks": batch.total_tasks,
        "completed_tasks": batch.completed_tasks,
        "tasks": [_serialize_task(t) for t in tasks],
    }


# ═══════════════════════════════════════════════════════════════════════════
# GET /api/generated-resumes/{generated_id}
# ═══════════════════════════════════════════════════════════════════════════

generated_router = APIRouter(prefix="/generated-resumes", tags=["job-matching"])


@generated_router.get("/{generated_id}")
async def get_generated_resume(
    generated_id: str,
    db: AsyncSession = Depends(get_db),
    current_user_id: str = Depends(get_current_user_id),
):
    try:
        gid = uuid.UUID(generated_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid generated_id format.")

    record = await job_match_repo.get_generated_resume(db, gid)
    if record is None or record.user_id != current_user_id:
        raise HTTPException(status_code=404, detail="Generated resume not found.")

    presigned_url = None
    if record.s3_key:
        presigned_url = await get_presigned_url(record.s3_key)

    return {
        "generated_id": str(record.id),
        "resume_id": str(record.resume_id),
        "job_id": record.job_id,
        "job_title": record.job_title,
        "company": record.company,
        "location": record.location,
        "match_score": record.match_score,
        "generated_data": record.generated_data,
        "pdf_url": presigned_url,
        "created_at": record.created_at.isoformat() if record.created_at else None,
    }


# ═══════════════════════════════════════════════════════════════════════════
# Parsed resume → resume-builder payload mapping (Python mirror of parsedToBuilder.ts)
# ═══════════════════════════════════════════════════════════════════════════

_SKILL_CATS = [
    ("Languages", {"c", "c++", "c#", "python", "java", "javascript", "typescript", "go",
     "golang", "rust", "ruby", "php", "swift", "kotlin", "scala", "r", "bash", "sql", "html", "css"}),
    ("Frameworks", {"react", "angular", "vue", "django", "flask", "fastapi", "spring",
     "express", "rails", "laravel", "tensorflow", "pytorch", "pandas", "numpy"}),
    ("Platforms", {"aws", "gcp", "azure", "linux", "docker", "kubernetes", "heroku"}),
    ("Concepts", {"rest", "graphql", "microservices", "distributed systems", "system design",
     "machine learning", "agile", "ci/cd", "tdd"}),
    ("Soft Skills", {"leadership", "communication", "teamwork", "mentoring"}),
]


def _classify_skill(skill: str) -> str:
    s = skill.lower().strip()
    for cat, keywords in _SKILL_CATS:
        if s in keywords or any(kw in s for kw in keywords if len(kw) > 3):
            return cat
    return "Tools"


def _parsed_to_builder(parsed: dict) -> dict:
    skills = parsed.get("skills") or []
    buckets: dict[str, list[str]] = {c: [] for c, _ in _SKILL_CATS}
    buckets["Tools"] = []
    for s in skills:
        s = str(s).strip()
        if s:
            buckets[_classify_skill(s)].append(s)

    skill_categories = [
        {"category": cat, "items": ", ".join(items)}
        for cat, items in buckets.items()
    ]

    def _map_experience(exp_list: list) -> list:
        result = []
        for e in exp_list:
            desc = e.get("description")
            bullets = []
            if isinstance(desc, list):
                bullets = [d for d in desc if d]
            elif isinstance(desc, str) and desc.strip():
                bullets = [desc]
            result.append({
                "company": e.get("company", ""),
                "location": "",
                "title": e.get("title", ""),
                "duration": e.get("duration", ""),
                "bullets": bullets or [""],
            })
        return result or [{"company": "", "location": "", "title": "", "duration": "", "bullets": [""]}]

    def _map_education(edu_list: list) -> list:
        result = []
        for e in edu_list:
            result.append({
                "institution": e.get("institution", ""),
                "location": "",
                "degree": e.get("degree", ""),
                "gpa": "",
                "years": e.get("year", ""),
                "coursework": "",
            })
        return result or [{"institution": "", "location": "", "degree": "", "gpa": "", "years": "", "coursework": ""}]

    def _map_projects(projects: list) -> list:
        result = []
        for p in projects:
            tech = p.get("technologies")
            tech_str = ", ".join(tech) if isinstance(tech, list) else str(tech or "")
            result.append({
                "name": p.get("name", ""),
                "tags": "",
                "description": p.get("description", ""),
                "tech": tech_str,
                "date": "",
            })
        return result or [{"name": "", "tags": "", "description": "", "tech": "", "date": ""}]

    return {
        "basics": {
            "name": parsed.get("name", ""),
            "portfolio": "",
            "github": "",
            "linkedin": parsed.get("linkedin", ""),
            "email": parsed.get("email", ""),
            "phone": parsed.get("phone", ""),
        },
        "summary": parsed.get("summary", ""),
        "education": _map_education(parsed.get("education") or []),
        "skillCategories": skill_categories,
        "experience": _map_experience(parsed.get("experience") or []),
        "projects": _map_projects(parsed.get("projects") or []),
        "publications": [{"prefix": "Book", "title": "", "tags": "", "description": "", "tech": "", "date": ""}],
        "awards": [{"name": "", "date": ""}],
        "volunteer": [{"org": "", "location": "", "description": "", "duration": ""}],
    }
