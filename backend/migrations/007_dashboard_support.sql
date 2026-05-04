-- Migration: 007_dashboard_support
-- Adds JD persistence to ats_evaluations and original_filename to resume_metadata,
-- plus an index supporting "latest score per resume" lookups.
-- Idempotent — safe to re-run.

ALTER TABLE ats_evaluations
    ADD COLUMN IF NOT EXISTS jd_text  TEXT,
    ADD COLUMN IF NOT EXISTS jd_title TEXT;

ALTER TABLE resume_metadata
    ADD COLUMN IF NOT EXISTS original_filename TEXT;

CREATE INDEX IF NOT EXISTS ix_ats_evaluations_resume_timestamp
    ON ats_evaluations (resume_id, timestamp DESC);

COMMENT ON COLUMN ats_evaluations.jd_text IS
    'Raw job description text submitted with the analysis. NULL for rows created before migration 007.';
COMMENT ON COLUMN ats_evaluations.jd_title IS
    'Optional user-provided label for the JD (e.g. "Senior PM @ Stripe"). UI falls back to "Analysis on <date>" when NULL.';
COMMENT ON COLUMN resume_metadata.original_filename IS
    'Filename as uploaded by the user. NULL for rows uploaded before migration 007; UI falls back to a date-based label.';
