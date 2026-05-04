import logging
import uuid
from typing import Optional

from fastapi import HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from db.repositories import resume_repo, parsed_resume_repo
from services import s3_service, extraction_service, llm_service

logger = logging.getLogger(__name__)

MAX_SIZE = 10 * 1024 * 1024  # 10 MB


def _resolve_user_id(user_id: Optional[str]) -> str:
    if user_id and user_id.strip():
        return user_id.strip()
    suffix = str(uuid.uuid4()).replace("-", "")[:6]
    return f"guest_{suffix}"


async def save_upload(
    file: UploadFile,
    db: AsyncSession,
    user_id: Optional[str] = None,
) -> dict:
    content = await file.read()

    if len(content) > MAX_SIZE:
        raise HTTPException(status_code=400, detail="File exceeds the 10 MB limit.")

    resolved_user_id = _resolve_user_id(user_id)
    ext = "." + (file.filename or "file").rsplit(".", 1)[-1].lower()
    content_type = file.content_type or "application/octet-stream"

    record = await resume_repo.create_pending(
        db,
        user_id=resolved_user_id,
        size=float(len(content)),
        original_filename=file.filename,
    )
    file_id: uuid.UUID = record.id
    s3_key = f"resumes/{resolved_user_id}/{file_id}{ext}"

    try:
        await s3_service.upload_file(content, s3_key, content_type)
    except Exception as exc:
        logger.error("S3 upload failed for file_id=%s: %s", file_id, exc)
        await resume_repo.update_failed(db, file_id=file_id)
        # Commit explicitly so the FAILED status is persisted before get_db's
        # rollback fires (which would otherwise undo the status update).
        await db.commit()
        raise HTTPException(status_code=500, detail="File storage failed. Please try again later.")

    await resume_repo.update_success(db, file_id=file_id, s3_key=s3_key)

    # Extraction pipeline — non-fatal; savepoint isolates DB failures from the main transaction
    parsed_data = None
    try:
        raw_text = await extraction_service.extract_text(content, content_type)
        parsed_data = await llm_service.extract_resume_data(raw_text)
        async with db.begin_nested():  # SAVEPOINT: rollback only this block on error
            await parsed_resume_repo.insert_parsed(
                db,
                resume_id=file_id,
                user_id=resolved_user_id,
                raw_text=raw_text,
                parsed_data=parsed_data,
            )
    except Exception as exc:
        logger.error("Parsing pipeline failed for file_id=%s: %s", file_id, exc, exc_info=True)
        parsed_data = None

    result: dict = {
        "file_id": str(file_id),
        "filename": file.filename,
        "s3_key": s3_key,
        "user_id": resolved_user_id,
        "message": "Resume uploaded successfully",
    }
    if parsed_data is not None:
        result["parsed_data"] = parsed_data
    return result
