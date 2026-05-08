-- Migration: 008_create_resume_suggestions
-- Persists LLM-generated resume modification suggestions and the user's
-- approve/reject decisions. Idempotent — safe to re-run.

CREATE TABLE IF NOT EXISTS resume_suggestions (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    evaluation_id   UUID        NOT NULL REFERENCES ats_evaluations(id)  ON DELETE CASCADE,
    resume_id       UUID        NOT NULL REFERENCES resume_metadata(id)  ON DELETE CASCADE,
    suggestions     JSONB       NOT NULL,
    decisions       JSONB,
    model           TEXT        NOT NULL,
    generated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    decided_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ix_resume_suggestions_evaluation
    ON resume_suggestions (evaluation_id, generated_at DESC);

CREATE INDEX IF NOT EXISTS ix_resume_suggestions_resume
    ON resume_suggestions (resume_id);

COMMENT ON TABLE  resume_suggestions IS
    'LLM-generated resume modification suggestions tied to an ATS evaluation.';
COMMENT ON COLUMN resume_suggestions.suggestions IS
    'Full suggestion bundle: { summary: {...}|null, skills: [...], experience: [...] }.';
COMMENT ON COLUMN resume_suggestions.decisions IS
    'Approve/reject map keyed by suggestion_id (e.g. {"sk_1": true, "ex_2": false}). NULL until the user decides.';
COMMENT ON COLUMN resume_suggestions.model IS
    'LLM model used to generate the suggestions (for offline analysis / model A-B).';
