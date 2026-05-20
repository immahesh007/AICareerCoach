-- Migration: 010_create_job_matching
-- Cached job-match results, batch generation queue, and generated resumes.
-- Idempotent — safe to re-run.

CREATE TABLE IF NOT EXISTS job_matches (
    id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    resume_id     UUID         NOT NULL REFERENCES resume_metadata(id) ON DELETE CASCADE,
    user_id       TEXT         NOT NULL,
    match_results JSONB        NOT NULL,
    matched_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_job_matches_resume_id
    ON job_matches (resume_id);

COMMENT ON TABLE job_matches IS
    'Cached response from the job-matching microservice, keyed by resume.';
COMMENT ON COLUMN job_matches.match_results IS
    'Full JSON response from /api/jobs/match (matches array + total_matched + candidate_summary).';


CREATE TABLE IF NOT EXISTS job_match_batches (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    resume_id       UUID         NOT NULL REFERENCES resume_metadata(id) ON DELETE CASCADE,
    user_id         TEXT         NOT NULL,
    total_tasks     INTEGER      NOT NULL DEFAULT 0,
    completed_tasks INTEGER      NOT NULL DEFAULT 0,
    status          TEXT         NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'processing', 'completed', 'partial')),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_job_match_batches_resume_id
    ON job_match_batches (resume_id);

COMMENT ON TABLE job_match_batches IS
    'One row per "Generate Resumes" click. Tracks overall batch progress.';
COMMENT ON COLUMN job_match_batches.status IS
    'pending | processing | completed | partial';


CREATE TABLE IF NOT EXISTS job_match_tasks (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id        UUID         NOT NULL REFERENCES job_match_batches(id) ON DELETE CASCADE,
    job_id          TEXT         NOT NULL,
    job_title       TEXT,
    company         TEXT,
    location        TEXT,
    match_score     NUMERIC(5,1),
    missing_skills  JSONB        NOT NULL DEFAULT '[]',
    status          TEXT         NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    generated_id    UUID,
    error_message   TEXT,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ix_job_match_tasks_batch_id
    ON job_match_tasks (batch_id);

COMMENT ON TABLE job_match_tasks IS
    'One row per job selected for resume generation within a batch.';
COMMENT ON COLUMN job_match_tasks.generated_id IS
    'FK to job_generated_resumes.id once generation completes.';


CREATE TABLE IF NOT EXISTS job_generated_resumes (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    resume_id       UUID         NOT NULL REFERENCES resume_metadata(id) ON DELETE CASCADE,
    user_id         TEXT         NOT NULL,
    job_id          TEXT         NOT NULL,
    job_title       TEXT,
    company         TEXT,
    location        TEXT,
    match_score     NUMERIC(5,1),
    generated_data  JSONB        NOT NULL,
    s3_key          TEXT,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_job_generated_resumes_resume_id
    ON job_generated_resumes (resume_id);

COMMENT ON TABLE job_generated_resumes IS
    'LLM-enhanced resume data + rendered PDF (S3) per matched job.';
COMMENT ON COLUMN job_generated_resumes.generated_data IS
    'Enhanced ResumeData JSON ready to load into the resume builder.';
COMMENT ON COLUMN job_generated_resumes.s3_key IS
    'S3 key for the rendered PDF. NULL until the resume-builder-service call succeeds.';
