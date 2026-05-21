import type { GenerateResponse, ResumeData, ResumeDesignSettings, ResumeSuggestions } from '@/types/resume';
import { DEFAULT_DESIGN_SETTINGS, FONT_SIZE_MAP, FONT_FAMILY_MAP } from '@/types/resume';

export async function generatePDF(
  data: ResumeData,
  userId?: string,
  token?: string,
  design?: ResumeDesignSettings,
): Promise<GenerateResponse> {
  const ds = design ?? DEFAULT_DESIGN_SETTINGS;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (userId) headers['X-User-Id'] = userId;
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch('/api/resume-builder/generate', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      ...data,
      font_size: FONT_SIZE_MAP[ds.fontSize].latex,
      margin_size: ds.marginSize,
      font_family: FONT_FAMILY_MAP[ds.fontFamily].latex,
      bullet_style: ds.bulletStyle,
      spacing: ds.spacing,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { detail?: string }).detail ?? 'PDF generation failed');
  }

  return res.json() as Promise<GenerateResponse>;
}

export async function generateSuggestions(
  data: ResumeData,
  userId?: string,
  token?: string,
): Promise<ResumeSuggestions> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (userId) headers['X-User-Id'] = userId;
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch('/api/resume-builder/suggestions', {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { detail?: string }).detail ?? 'Suggestion generation failed');
  }

  const json = await res.json();
  return json.suggestions as ResumeSuggestions;
}
