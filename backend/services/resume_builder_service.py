import uuid

import httpx
from fastapi import HTTPException

from core.config import settings
from services import s3_service


async def generate_pdf(data: dict, user_id: str) -> str:
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            f"{settings.RESUME_BUILDER_SERVICE_URL}/generate",
            json=data,
        )

    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail="PDF generation failed")

    key = f"generated-resumes/{user_id}/{uuid.uuid4()}.pdf"
    await s3_service.upload_file(resp.content, key, "application/pdf")
    return await s3_service.get_presigned_url(key)
