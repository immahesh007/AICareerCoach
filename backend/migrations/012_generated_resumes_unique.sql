-- Migration: 012_generated_resumes_unique
-- Enforce one generated resume per (resume, job) pair.
-- Idempotent — safe to re-run.

-- If duplicates already exist, keep only the most recent per (resume_id, job_id).
DELETE FROM job_generated_resumes a
USING job_generated_resumes b
WHERE a.resume_id = b.resume_id
  AND a.job_id = b.job_id
  AND a.created_at < b.created_at;

CREATE UNIQUE INDEX IF NOT EXISTS uq_job_generated_resumes_resume_job
    ON job_generated_resumes (resume_id, job_id);
