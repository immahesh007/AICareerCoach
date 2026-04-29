from typing import Optional

from fastapi import APIRouter, Depends, File, Header, HTTPException, Query, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from db.connection import get_db
from services.file_service import save_upload

router = APIRouter()

ALLOWED_CONTENT_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}
ALLOWED_EXTENSIONS = {".pdf", ".docx"}


@router.post("/upload-resume")
async def upload_resume(
    file: UploadFile = File(...),
    user_id: Optional[str] = Query(default=None, description="Optional user ID"),
    x_user_id: Optional[str] = Header(default=None, description="Optional user ID via X-User-Id header"),
    db: AsyncSession = Depends(get_db),
):
    ext = "." + (file.filename or "").rsplit(".", 1)[-1].lower()
    if file.content_type not in ALLOWED_CONTENT_TYPES and ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="Invalid file type. Only PDF and DOCX files are accepted.",
        )

    # Header takes precedence over query param; both are optional
    return await save_upload(file, db=db, user_id=x_user_id or user_id)
