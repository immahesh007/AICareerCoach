export interface MatchJob {
  job_id: string;
  title: string;
  company: string;
  location: string;
  description: string;
  url: string;
  final_score: number;
  score_breakdown: {
    skills_score: number;
    experience_score: number;
    semantic_score: number;
    education_score: number;
  };
  matched_skills: string[];
  missing_skills: string[];
  reason: string;
}

export interface MatchJobsResponse {
  resume_id: string;
  cached: boolean;
  matched_at: string | null;
  items: MatchJob[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface BatchTask {
  task_id: string;
  job_id: string;
  job_title: string | null;
  company: string | null;
  location: string | null;
  match_score: number | null;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  generated_id: string | null;
  error_message: string | null;
  created_at: string | null;
  completed_at: string | null;
}

export interface BatchStatusResponse {
  batch_id: string;
  resume_id: string;
  status: 'pending' | 'processing' | 'completed' | 'partial';
  total_tasks: number;
  completed_tasks: number;
  tasks: BatchTask[];
}

export interface GenerateResponse {
  batch_id: string;
  total_tasks: number;
}

export interface GeneratedResumeResponse {
  generated_id: string;
  resume_id: string;
  job_id: string;
  job_title: string | null;
  company: string | null;
  location: string | null;
  match_score: number | null;
  generated_data: Record<string, unknown>;
  pdf_url: string | null;
  created_at: string | null;
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

export async function triggerMatchJobs(resumeId: string): Promise<MatchJobsResponse> {
  const res = await fetch(`/api/resumes/${resumeId}/job/match`, {
    method: 'POST',
    headers: authHeaders(),
  });
  return parseOrThrow<MatchJobsResponse>(res, 'Failed to find matching jobs.');
}

export async function getMatchingJobs(
  resumeId: string,
  page = 1,
  pageSize = 10,
): Promise<MatchJobsResponse> {
  const res = await fetch(
    `/api/resumes/${resumeId}/matching-jobs?page=${page}&page_size=${pageSize}`,
    { headers: authHeaders() },
  );
  return parseOrThrow<MatchJobsResponse>(res, 'Failed to load matching jobs.');
}

export async function generateResumes(
  resumeId: string,
  jobIds: string[],
): Promise<GenerateResponse> {
  const res = await fetch(`/api/resumes/${resumeId}/matching-jobs/generate`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ job_ids: jobIds }),
  });
  return parseOrThrow<GenerateResponse>(res, 'Failed to start resume generation.');
}

export async function getBatchStatus(batchId: string): Promise<BatchStatusResponse> {
  const res = await fetch(`/api/batches/${batchId}`, {
    headers: authHeaders(),
  });
  return parseOrThrow<BatchStatusResponse>(res, 'Failed to load batch status.');
}

export async function getGeneratedResume(generatedId: string): Promise<GeneratedResumeResponse> {
  const res = await fetch(`/api/generated-resumes/${generatedId}`, {
    headers: authHeaders(),
  });
  return parseOrThrow<GeneratedResumeResponse>(res, 'Failed to load generated resume.');
}
