-- Migration: 009_create_saved_resumes
-- Stores user-built resumes (final, named snapshots from the resume builder).
-- Idempotent — safe to re-run.

CREATE TABLE IF NOT EXISTS saved_resumes (
    id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      TEXT         NOT NULL,
    name         TEXT         NOT NULL,
    company      TEXT,
    resume_data  JSONB        NOT NULL,
    saved_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_saved_resumes_user_saved_at
    ON saved_resumes (user_id, saved_at DESC);

COMMENT ON TABLE  saved_resumes IS
    'User-built resumes saved from the Resume Builder page.';
COMMENT ON COLUMN saved_resumes.user_id IS
    'TEXT to match the resume_metadata convention (real UUID for authed users).';
COMMENT ON COLUMN saved_resumes.name IS
    'User-supplied name (e.g. "Backend Engineer — Stripe").';
COMMENT ON COLUMN saved_resumes.company IS
    'Optional company / target this resume is tailored for.';
COMMENT ON COLUMN saved_resumes.resume_data IS
    'Full ResumeData JSON snapshot — basics, summary, skillCategories, experience, projects, publications, education, awards, volunteer.';
