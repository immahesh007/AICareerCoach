-- Migration: 011_dedup_job_matches
-- Adds a unique constraint on job_matches.resume_id so upserts never
-- create duplicate cache rows. Also cleans up any existing duplicates.

DELETE FROM job_matches a
USING job_matches b
WHERE a.resume_id = b.resume_id AND a.matched_at < b.matched_at;

ALTER TABLE job_matches
    DROP CONSTRAINT IF EXISTS uq_job_matches_resume_id,
    ADD CONSTRAINT uq_job_matches_resume_id UNIQUE (resume_id);
