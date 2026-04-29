import uuid
from enum import Enum as PyEnum

from sqlalchemy import Column, Enum, Float, Index, Text, TIMESTAMP
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import declarative_base
from sqlalchemy.sql import func

Base = declarative_base()


class ResumeStatus(PyEnum):
    PENDING = "PENDING"
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"


class ResumeMetadata(Base):
    __tablename__ = "resume_metadata"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(Text, nullable=False)
    s3_key = Column(Text, unique=True, nullable=True)  # NULL until S3 upload succeeds
    status = Column(
        Enum(ResumeStatus, name="resume_status_enum", create_type=False),
        nullable=False,
    )
    uploaded_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    size = Column(Float, nullable=True)

    __table_args__ = (Index("ix_resume_metadata_user_id", "user_id"),)
