import uuid
from enum import Enum as PyEnum

from sqlalchemy import Column, Enum, Float, ForeignKey, Index, Integer, Text, TIMESTAMP
from sqlalchemy.dialects.postgresql import JSONB, UUID
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


class ParsedResume(Base):
    __tablename__ = "parsed_resumes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    resume_id = Column(
        UUID(as_uuid=True),
        ForeignKey("resume_metadata.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id = Column(Text, nullable=False)
    raw_text = Column(Text, nullable=True)
    parsed_data = Column(JSONB, nullable=False)
    parsed_jd = Column(JSONB, nullable=True)
    parsed_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        Index("ix_parsed_resumes_resume_id", "resume_id"),
        Index("ix_parsed_resumes_user_id", "user_id"),
    )


class ATSEvaluation(Base):
    __tablename__ = "ats_evaluations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    resume_id = Column(
        UUID(as_uuid=True),
        ForeignKey("resume_metadata.id", ondelete="CASCADE"),
        nullable=False,
    )
    timestamp = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    ats_score = Column(Integer, nullable=False)
    strengths = Column(JSONB, nullable=False, default=list)
    weaknesses = Column(JSONB, nullable=False, default=list)
    missing_keywords = Column(JSONB, nullable=False, default=list)
    formatting_feedback = Column(Text, nullable=True)
    match_report = Column(Text, nullable=True)

    __table_args__ = (Index("ix_ats_evaluations_resume_id", "resume_id"),)
