export interface ATSResult {
  file_id: string;
  parsed_jd: Record<string, unknown>;
  ats_score: number;
  match_percentage: number;
  matching_skills: string[];
  experience_fit: string;
  strengths: string[];
  weaknesses: string[];
  missing_keywords: string[];
  formatting_feedback: string;
  match_report: string;
  message: string;
}

export async function analyzeATS(
  fileId: string,
  jobDescription: string,
): Promise<ATSResult> {
  if (jobDescription.length < 1 || jobDescription.length > 5000) {
    throw new Error('Job description must be between 1 and 5,000 characters.');
  }

  const res = await fetch('/api/know-ats', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file_id: fileId, jobDescription }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { detail?: string }).detail ?? 'ATS analysis failed.');
  }

  return res.json();
}
