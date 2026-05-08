export interface ResumeListItem {
  resume_id: string;
  original_filename: string | null;
  uploaded_at: string | null;
  latest_ats_score: number | null;
  latest_analysis_at: string | null;
}

export interface ResumeListResponse {
  items: ResumeListItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface AnalysisRecord {
  id: string;
  resume_id: string;
  timestamp: string | null;
  ats_score: number;
  match_percentage: number | null;
  matching_skills: string[];
  experience_fit: string | null;
  strengths: string[];
  weaknesses: string[];
  missing_keywords: string[];
  formatting_feedback: string | null;
  match_report: string | null;
  jd_text: string | null;
  jd_title: string | null;
}

export interface AnalysesResponse {
  resume_id: string;
  original_filename: string | null;
  analyses: AnalysisRecord[];
}

export interface DownloadUrlResponse {
  url: string;
  expires_in: number;
}

export interface ParsedResumeResponse {
  resume_id: string;
  parsed_data: Record<string, unknown>;
}

function authHeaders(): HeadersInit {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('auth_token');
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function parseOrThrow<T>(res: Response, fallbackMsg: string): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { detail?: string }).detail ?? fallbackMsg);
  }
  return res.json() as Promise<T>;
}

export async function listResumes(page = 1, pageSize = 20): Promise<ResumeListResponse> {
  const res = await fetch(`/api/resumes?page=${page}&page_size=${pageSize}`, {
    headers: authHeaders(),
  });
  return parseOrThrow<ResumeListResponse>(res, 'Failed to load resumes.');
}

export async function listAnalyses(resumeId: string): Promise<AnalysesResponse> {
  const res = await fetch(`/api/resumes/${resumeId}/analyses`, {
    headers: authHeaders(),
  });
  return parseOrThrow<AnalysesResponse>(res, 'Failed to load analyses.');
}

export interface SingleAnalysisResponse extends AnalysisRecord {
  resume_filename: string | null;
}

export async function getAnalysis(analysisId: string): Promise<SingleAnalysisResponse> {
  const res = await fetch(`/api/analyses/${analysisId}`, {
    headers: authHeaders(),
  });
  return parseOrThrow<SingleAnalysisResponse>(res, 'Failed to load analysis.');
}

export async function getResumeDownloadUrl(resumeId: string): Promise<DownloadUrlResponse> {
  const res = await fetch(`/api/resumes/${resumeId}/download-url`, {
    headers: authHeaders(),
  });
  return parseOrThrow<DownloadUrlResponse>(res, 'Failed to get download link.');
}

export async function getParsedResume(resumeId: string): Promise<ParsedResumeResponse> {
  const res = await fetch(`/api/resumes/${resumeId}/parsed`, {
    headers: authHeaders(),
  });
  return parseOrThrow<ParsedResumeResponse>(res, 'Failed to load parsed resume.');
}

export async function reparseResume(resumeId: string): Promise<ParsedResumeResponse> {
  const res = await fetch(`/api/resumes/${resumeId}/reparse`, {
    method: 'POST',
    headers: authHeaders(),
  });
  return parseOrThrow<ParsedResumeResponse>(res, 'Failed to re-parse resume.');
}

export interface SummarySuggestion {
  suggestion_id: string;
  current: string | null;
  suggested: string;
  rationale: string;
}

export interface SkillSuggestion {
  suggestion_id: string;
  skill: string;
  rationale: string;
}

export interface ExperienceSuggestion {
  suggestion_id: string;
  experience_index: number;
  bullet_index: number;
  current: string;
  suggested: string;
  rationale: string;
}

export interface SuggestModificationsResponse {
  suggestion_id: string;
  evaluation_id: string;
  resume_id: string;
  suggestions: {
    summary: SummarySuggestion | null;
    skills: SkillSuggestion[];
    experience: ExperienceSuggestion[];
  };
  model: string;
  generated_at: string;
}

export async function suggestModifications(
  evaluationId: string,
): Promise<SuggestModificationsResponse> {
  const res = await fetch('/api/suggest-modifications', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ evaluation_id: evaluationId }),
  });
  return parseOrThrow<SuggestModificationsResponse>(res, 'Could not generate suggestions.');
}

export async function recordSuggestionDecisions(
  suggestionId: string,
  decisions: Record<string, boolean>,
): Promise<{ suggestion_id: string; recorded: number }> {
  const res = await fetch(`/api/suggest-modifications/${suggestionId}/decisions`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ decisions }),
  });
  return parseOrThrow(res, 'Could not record decisions.');
}

export async function triggerNewAnalysis(
  fileId: string,
  jobDescription: string,
  jdTitle?: string,
): Promise<{ evaluation_id: string; ats_score: number; [k: string]: unknown }> {
  if (jobDescription.length < 1 || jobDescription.length > 5000) {
    throw new Error('Job description must be between 1 and 5,000 characters.');
  }
  const res = await fetch('/api/know-ats', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      file_id: fileId,
      jobDescription,
      jd_title: jdTitle?.trim() || null,
    }),
  });
  return parseOrThrow(res, 'ATS analysis failed.');
}
