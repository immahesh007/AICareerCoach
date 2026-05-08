import type { GenerateResponse, ResumeData } from '@/types/resume';

export async function generatePDF(
  data: ResumeData,
  userId?: string,
  token?: string
): Promise<GenerateResponse> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (userId) headers['X-User-Id'] = userId;
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch('/api/resume-builder/generate', {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { detail?: string }).detail ?? 'PDF generation failed');
  }

  return res.json() as Promise<GenerateResponse>;
}
