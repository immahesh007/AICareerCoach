import logging

import aioboto3

from core.config import settings

logger = logging.getLogger(__name__)

_session = aioboto3.Session(
    aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
    aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
    region_name=settings.AWS_REGION,
)


async def upload_file(content: bytes, key: str, content_type: str) -> str:
    async with _session.client("s3") as s3:
        await s3.put_object(
            Bucket=settings.S3_BUCKET_NAME,
            Key=key,
            Body=content,
            ContentType=content_type,
        )
    logger.info("Uploaded %d bytes to s3://%s/%s", len(content), settings.S3_BUCKET_NAME, key)
    return key


async def get_presigned_url(key: str, expires_in: int = 900) -> str:
    async with _session.client("s3") as s3:
        return await s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": settings.S3_BUCKET_NAME, "Key": key},
            ExpiresIn=expires_in,
        )


async def download_file(key: str) -> bytes:
    async with _session.client("s3") as s3:
        resp = await s3.get_object(Bucket=settings.S3_BUCKET_NAME, Key=key)
        async with resp["Body"] as stream:
            return await stream.read()
