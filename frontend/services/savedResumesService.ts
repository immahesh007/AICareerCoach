import type { ResumeData, ResumeDesignSettings } from '@/types/resume';

export interface SavedResumeSummary {
  id: string;
  name: string;
  company: string | null;
  saved_at: string | null;
}

export interface SavedResumeFull extends SavedResumeSummary {
  resume_data: ResumeData;
  design?: ResumeDesignSettings | null;
}

export interface SavedResumeListResponse {
  items: SavedResumeSummary[];
  total: number;
  page: number;
  page_size: number;
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

export async function saveResume(
  name: string,
  company: string | null,
  resumeData: ResumeData,
  design?: ResumeDesignSettings,
): Promise<SavedResumeFull> {
  const body: Record<string, unknown> = { name, company, resume_data: resumeData };
  if (design) {
    body.design = design;
  }
  const res = await fetch('/api/saved-resumes', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  return parseOrThrow<SavedResumeFull>(res, 'Failed to save resume.');
}

export async function listSavedResumes(
  page = 1,
  pageSize = 20,
): Promise<SavedResumeListResponse> {
  const res = await fetch(`/api/saved-resumes?page=${page}&page_size=${pageSize}`, {
    headers: authHeaders(),
  });
  return parseOrThrow<SavedResumeListResponse>(res, 'Failed to load saved resumes.');
}

export async function getSavedResume(id: string): Promise<SavedResumeFull> {
  const res = await fetch(`/api/saved-resumes/${id}`, {
    headers: authHeaders(),
  });
  return parseOrThrow<SavedResumeFull>(res, 'Failed to load saved resume.');
}

export async function deleteSavedResume(id: string): Promise<void> {
  const res = await fetch(`/api/saved-resumes/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { detail?: string }).detail ?? 'Failed to delete saved resume.');
  }
}
