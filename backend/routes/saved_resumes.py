import uuid
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from core.auth_dep import get_current_user_id
from db.connection import get_db
from db.repositories.saved_resume_repo import (
    delete_saved_resume,
    get_saved_resume,
    insert_saved_resume,
    list_saved_resumes,
)

router = APIRouter(prefix="/saved-resumes", tags=["saved-resumes"])


class SaveResumeRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    company: Optional[str] = Field(default=None, max_length=120)
    resume_data: dict[str, Any]
    design: Optional[dict[str, Any]] = None


def _serialize_summary(record) -> dict:
    return {
        "id": str(record.id),
        "name": record.name,
        "company": record.company,
        "saved_at": record.saved_at.isoformat() if record.saved_at else None,
    }


def _serialize_full(record) -> dict:
    data = dict(record.resume_data) if record.resume_data else {}
    design = data.pop("_design", None)
    return {
        **_serialize_summary(record),
        "resume_data": data,
        "design": design,
    }


def _parse_id(saved_resume_id: str) -> uuid.UUID:
    try:
        return uuid.UUID(saved_resume_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid saved_resume id format.")


@router.post("")
async def save_resume(
    body: SaveResumeRequest,
    db: AsyncSession = Depends(get_db),
    current_user_id: str = Depends(get_current_user_id),
):
    resume_data = dict(body.resume_data)
    if body.design:
        resume_data["_design"] = body.design
    record = await insert_saved_resume(
        db,
        user_id=current_user_id,
        name=body.name.strip(),
        company=(body.company.strip() or None) if body.company else None,
        resume_data=resume_data,
    )
    return _serialize_full(record)


@router.get("")
async def list_user_saved_resumes(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    current_user_id: str = Depends(get_current_user_id),
):
    offset = (page - 1) * page_size
    items, total = await list_saved_resumes(
        db, user_id=current_user_id, limit=page_size, offset=offset
    )
    return {
        "items": [_serialize_summary(r) for r in items],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/{saved_resume_id}")
async def get_one_saved_resume(
    saved_resume_id: str,
    db: AsyncSession = Depends(get_db),
    current_user_id: str = Depends(get_current_user_id),
):
    record = await get_saved_resume(db, saved_resume_id=_parse_id(saved_resume_id))
    # 404 (not 403) — don't leak existence of other users' saved resumes
    if record is None or record.user_id != current_user_id:
        raise HTTPException(status_code=404, detail="Saved resume not found.")
    return _serialize_full(record)


@router.delete("/{saved_resume_id}")
async def remove_saved_resume(
    saved_resume_id: str,
    db: AsyncSession = Depends(get_db),
    current_user_id: str = Depends(get_current_user_id),
):
    saved_uuid = _parse_id(saved_resume_id)
    record = await get_saved_resume(db, saved_resume_id=saved_uuid)
    if record is None or record.user_id != current_user_id:
        raise HTTPException(status_code=404, detail="Saved resume not found.")
    await delete_saved_resume(db, saved_resume_id=saved_uuid)
    return {"deleted": True, "id": str(saved_uuid)}
