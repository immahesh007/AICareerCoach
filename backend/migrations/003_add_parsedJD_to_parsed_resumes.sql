ALTER TABLE parsed_resumes
  ADD COLUMN IF NOT EXISTS parsed_jd JSONB;
