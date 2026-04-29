-- Migration: 002_create_parsed_resumes
-- Depends on: 001_create_resume_metadata (resume_metadata table must exist)
-- Idempotent — safe to run multiple times.

CREATE TABLE IF NOT EXISTS parsed_resumes (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    resume_id   UUID        NOT NULL REFERENCES resume_metadata(id) ON DELETE CASCADE,
    user_id     TEXT        NOT NULL,
    raw_text    TEXT,
    parsed_data JSONB       NOT NULL,
    parsed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_parsed_resumes_resume_id ON parsed_resumes (resume_id);
CREATE INDEX IF NOT EXISTS ix_parsed_resumes_user_id   ON parsed_resumes (user_id);

-- GIN index for fast array containment queries on skills:
-- e.g. WHERE parsed_data->'skills' @> '["Python"]'::jsonb
-- Uses -> (JSONB operator) not ->> (text operator) — @> requires JSONB.
CREATE INDEX IF NOT EXISTS ix_parsed_resumes_skills
    ON parsed_resumes USING GIN ((parsed_data -> 'skills'));

COMMENT ON TABLE parsed_resumes IS
    'LLM-extracted structured fields from uploaded resume files.';
COMMENT ON COLUMN parsed_resumes.resume_id IS
    'FK to resume_metadata.id. Cascades on delete.';
COMMENT ON COLUMN parsed_resumes.raw_text IS
    'Full extracted text (PDF or DOCX). NULL if extraction was skipped.';
COMMENT ON COLUMN parsed_resumes.parsed_data IS
    'Structured resume data extracted by the LLM. JSONB for queryable fields (skills, etc.).';
