-- Migration: 004_create_ats_evaluations
-- Idempotent — safe to re-run.

CREATE TABLE IF NOT EXISTS ats_evaluations (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    resume_id           UUID        NOT NULL REFERENCES resume_metadata(id) ON DELETE CASCADE,
    timestamp           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ats_score           INTEGER     NOT NULL,
    strengths           JSONB       NOT NULL DEFAULT '[]'::jsonb,
    weaknesses          JSONB       NOT NULL DEFAULT '[]'::jsonb,
    missing_keywords    JSONB       NOT NULL DEFAULT '[]'::jsonb,
    formatting_feedback TEXT,
    match_report        TEXT
);

CREATE INDEX IF NOT EXISTS ix_ats_evaluations_resume_id ON ats_evaluations (resume_id);

COMMENT ON TABLE ats_evaluations IS
    'ATS scoring results combining BGE-M3 vector similarity and LLM recruiter evaluation.';
COMMENT ON COLUMN ats_evaluations.resume_id IS
    'FK to resume_metadata.id. Cascades on delete.';
COMMENT ON COLUMN ats_evaluations.ats_score IS
    'Final ATS score 0-100 as determined by the LLM recruiter evaluation.';
