-- Migration: 001_create_resume_metadata
-- Requires: PostgreSQL 13+ (gen_random_uuid built-in) or pgcrypto on older versions
-- Safe to run multiple times (idempotent).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'resume_status_enum') THEN
        CREATE TYPE resume_status_enum AS ENUM ('PENDING', 'SUCCESS', 'FAILED');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS resume_metadata (
    id          UUID                 PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     TEXT                 NOT NULL,
    s3_key      TEXT                 UNIQUE,        -- NULL while PENDING or FAILED
    status      resume_status_enum   NOT NULL,
    uploaded_at TIMESTAMPTZ          NOT NULL DEFAULT NOW(),
    size        FLOAT
);

CREATE INDEX IF NOT EXISTS ix_resume_metadata_user_id ON resume_metadata (user_id);

COMMENT ON TABLE resume_metadata IS
    'Tracks resume upload events: S3 storage key, processing status, and uploader identity.';
COMMENT ON COLUMN resume_metadata.user_id IS
    'Authenticated user ID or guest_<suffix> for unauthenticated uploads.';
COMMENT ON COLUMN resume_metadata.s3_key IS
    'S3 object key: resumes/{user_id}/{file_id}.{ext}. NULL while status=PENDING or FAILED.';
COMMENT ON COLUMN resume_metadata.status IS
    'PENDING: S3 upload in progress. SUCCESS: stored in S3. FAILED: S3 upload error.';
