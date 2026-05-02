-- Migration: 005_add_new_ats_metrics
-- Adds match_percentage, matching_skills, experience_fit to ats_evaluations.
-- Idempotent — safe to re-run.

ALTER TABLE ats_evaluations
    ADD COLUMN IF NOT EXISTS match_percentage  INTEGER,
    ADD COLUMN IF NOT EXISTS matching_skills   JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS experience_fit    TEXT;

COMMENT ON COLUMN ats_evaluations.match_percentage IS
    'Percentage of JD required skills and keywords the candidate demonstrably meets (0-100).';
COMMENT ON COLUMN ats_evaluations.matching_skills IS
    'Skills/keywords present in both the resume and the JD requirements.';
COMMENT ON COLUMN ats_evaluations.experience_fit IS
    'One-sentence verdict on whether the candidate years/seniority aligns with the role.';
