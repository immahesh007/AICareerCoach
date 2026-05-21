-- Migration: 012_generated_resumes_unique
-- Enforce one generated resume per (resume, job) pair.
-- Idempotent — safe to re-run.

-- If duplicates already exist, keep only the most recent per (resume_id, job_id).
DELETE FROM job_generated_resumes a
USING job_generated_resumes b
WHERE a.resume_id = b.resume_id
  AND a.job_id = b.job_id
  AND a.created_at < b.created_at;

-- Drop the constraint or index if it exists in any form, then recreate.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_job_generated_resumes_resume_job'
    ) THEN
        ALTER TABLE job_generated_resumes DROP CONSTRAINT uq_job_generated_resumes_resume_job;
    END IF;
END $$;

-- Drop the index form if it exists (from a previous run of this migration).
DROP INDEX IF EXISTS uq_job_generated_resumes_resume_job;

-- Create the unique constraint (not just an index) so ON CONFLICT ON CONSTRAINT works.
ALTER TABLE job_generated_resumes
    ADD CONSTRAINT uq_job_generated_resumes_resume_job UNIQUE (resume_id, job_id);
