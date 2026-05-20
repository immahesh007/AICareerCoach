import uuid
from enum import Enum as PyEnum

from sqlalchemy import Column, Enum, Float, ForeignKey, Index, Integer, String, Text, TIMESTAMP, UniqueConstraint
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
    original_filename = Column(Text, nullable=True)

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
    match_percentage = Column(Integer, nullable=True)
    matching_skills = Column(JSONB, nullable=False, default=list)
    experience_fit = Column(Text, nullable=True)
    strengths = Column(JSONB, nullable=False, default=list)
    weaknesses = Column(JSONB, nullable=False, default=list)
    missing_keywords = Column(JSONB, nullable=False, default=list)
    formatting_feedback = Column(Text, nullable=True)
    match_report = Column(Text, nullable=True)
    jd_text = Column(Text, nullable=True)
    jd_title = Column(Text, nullable=True)

    __table_args__ = (Index("ix_ats_evaluations_resume_id", "resume_id"),)


class ResumeSuggestion(Base):
    __tablename__ = "resume_suggestions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    evaluation_id = Column(
        UUID(as_uuid=True),
        ForeignKey("ats_evaluations.id", ondelete="CASCADE"),
        nullable=False,
    )
    resume_id = Column(
        UUID(as_uuid=True),
        ForeignKey("resume_metadata.id", ondelete="CASCADE"),
        nullable=False,
    )
    suggestions = Column(JSONB, nullable=False)
    decisions = Column(JSONB, nullable=True)
    model = Column(Text, nullable=False)
    generated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    decided_at = Column(TIMESTAMP(timezone=True), nullable=True)

    __table_args__ = (
        Index("ix_resume_suggestions_evaluation", "evaluation_id", "generated_at"),
        Index("ix_resume_suggestions_resume", "resume_id"),
    )


class SavedResume(Base):
    __tablename__ = "saved_resumes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(Text, nullable=False)
    name = Column(Text, nullable=False)
    company = Column(Text, nullable=True)
    resume_data = Column(JSONB, nullable=False)
    saved_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (Index("ix_saved_resumes_user_saved_at", "user_id", "saved_at"),)


class JobMatch(Base):
    __tablename__ = "job_matches"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    resume_id = Column(
        UUID(as_uuid=True),
        ForeignKey("resume_metadata.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id = Column(Text, nullable=False)
    match_results = Column(JSONB, nullable=False)
    matched_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (Index("ix_job_matches_resume_id", "resume_id"),)


class JobMatchBatch(Base):
    __tablename__ = "job_match_batches"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    resume_id = Column(
        UUID(as_uuid=True),
        ForeignKey("resume_metadata.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id = Column(Text, nullable=False)
    total_tasks = Column(Integer, nullable=False, default=0)
    completed_tasks = Column(Integer, nullable=False, default=0)
    status = Column(Text, nullable=False, default="pending")
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (Index("ix_job_match_batches_resume_id", "resume_id"),)


class JobMatchTask(Base):
    __tablename__ = "job_match_tasks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    batch_id = Column(
        UUID(as_uuid=True),
        ForeignKey("job_match_batches.id", ondelete="CASCADE"),
        nullable=False,
    )
    job_id = Column(Text, nullable=False)
    job_title = Column(Text)
    company = Column(Text)
    location = Column(Text)
    match_score = Column(Float)
    missing_skills = Column(JSONB, nullable=False, default=list)
    status = Column(Text, nullable=False, default="pending")
    generated_id = Column(UUID(as_uuid=True))
    error_message = Column(Text)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    completed_at = Column(TIMESTAMP(timezone=True))

    __table_args__ = (Index("ix_job_match_tasks_batch_id", "batch_id"),)


class JobGeneratedResume(Base):
    __tablename__ = "job_generated_resumes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    resume_id = Column(
        UUID(as_uuid=True),
        ForeignKey("resume_metadata.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id = Column(Text, nullable=False)
    job_id = Column(Text, nullable=False)
    job_title = Column(Text)
    company = Column(Text)
    location = Column(Text)
    match_score = Column(Float)
    generated_data = Column(JSONB, nullable=False)
    s3_key = Column(Text)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        Index("ix_job_generated_resumes_resume_id", "resume_id"),
        UniqueConstraint("resume_id", "job_id", name="uq_job_generated_resumes_resume_job"),
    )


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False, unique=True)
    password_hash = Column(Text, nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.now(), nullable=False)

    __table_args__ = (Index("ix_users_email", "email"),)


class LoginHistory(Base):
    __tablename__ = "login_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    login_at = Column(TIMESTAMP, server_default=func.now(), nullable=False)
    ip_address = Column(String(45), nullable=True)

    __table_args__ = (Index("ix_login_history_user_id", "user_id"),)
