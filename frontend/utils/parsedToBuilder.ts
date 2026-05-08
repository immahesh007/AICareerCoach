import type {
  Award,
  Basics,
  EducationItem,
  ExperienceItem,
  ProjectItem,
  PublicationItem,
  ResumeData,
  SkillCategory,
  VolunteerItem,
} from '@/types/resume';

// Shape produced by backend services/llm_service.py extract_resume_data
interface ParsedExperience {
  title?: string;
  company?: string;
  duration?: string;
  description?: string | string[];
  bullets?: string[];
  responsibilities?: string[];
  achievements?: string[];
}

interface ParsedEducation {
  degree?: string;
  institution?: string;
  year?: string;
}

interface ParsedProject {
  name?: string;
  description?: string;
  technologies?: string[] | string;
}

interface ParsedResumeData {
  name?: string;
  email?: string;
  phone?: string;
  linkedin?: string;
  skills?: string[];
  experience?: ParsedExperience[];
  education?: ParsedEducation[];
  projects?: ParsedProject[];
}

const EMPTY_BASICS: Basics = { name: '', portfolio: '', github: '', email: '', phone: '' };
const EMPTY_EDU: EducationItem = {
  institution: '', location: '', degree: '', gpa: '', years: '', coursework: '',
};
const EMPTY_EXP: ExperienceItem = {
  company: '', location: '', title: '', duration: '', bullets: [''],
};
const EMPTY_PROJECT: ProjectItem = { name: '', tags: '', description: '', tech: '', date: '' };
const EMPTY_PUB: PublicationItem = {
  prefix: 'Book', title: '', tags: '', description: '', tech: '', date: '',
};
const EMPTY_AWARD: Award = { name: '', date: '' };
const EMPTY_VOL: VolunteerItem = { org: '', location: '', description: '', duration: '' };

const DEFAULT_SKILL_CATS: SkillCategory[] = [
  { category: 'Languages', items: '' },
  { category: 'Frameworks', items: '' },
  { category: 'Tools', items: '' },
  { category: 'Platforms', items: '' },
  { category: 'Soft Skills', items: '' },
];

function isLinkedinUrl(s: string | undefined): boolean {
  if (!s) return false;
  return /linkedin\.com/i.test(s);
}

// LLM may emit description as one paragraph or pre-split bullets joined by newlines / bullet glyphs.
// When neither is present, fall back to sentence-boundary splitting so prose still becomes multiple bullets.
function descriptionToBullets(description: string | undefined): string[] {
  if (!description || !description.trim()) return [''];

  // 1) Try explicit delimiters: newlines, semicolons, or bullet glyphs.
  let parts = description
    .split(/\r?\n+|;\s+|(?:^|\s)[•·▪‣◦●\-*]\s+/)
    .map(s => s.trim())
    .filter(Boolean);

  // 2) If only one part came out, split on sentence boundaries:
  //    period/!/? followed by whitespace then a capital letter or digit.
  if (parts.length <= 1) {
    parts = description
      .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
      .map(s => s.trim())
      .filter(Boolean);
  }

  return parts.length > 0 ? parts : [description.trim()];
}

function bulletsFor(e: ParsedExperience): string[] {
  // Prefer explicit array fields if the LLM provided them.
  for (const arr of [e.bullets, e.responsibilities, e.achievements]) {
    if (Array.isArray(arr)) {
      const filtered = arr.map(s => String(s).trim()).filter(Boolean);
      if (filtered.length > 0) return filtered;
    }
  }
  if (Array.isArray(e.description)) {
    const filtered = e.description.map(s => String(s).trim()).filter(Boolean);
    if (filtered.length > 0) return filtered;
  }
  if (typeof e.description === 'string') {
    return descriptionToBullets(e.description);
  }
  return [''];
}

function toCommaList(value: string[] | string | undefined): string {
  if (Array.isArray(value)) return value.filter(Boolean).join(', ');
  return value ?? '';
}

function mapBasics(p: ParsedResumeData): Basics {
  return {
    ...EMPTY_BASICS,
    name: p.name ?? '',
    email: p.email ?? '',
    phone: p.phone ?? '',
    portfolio: isLinkedinUrl(p.linkedin) ? (p.linkedin as string) : '',
  };
}

function mapEducation(p: ParsedResumeData): EducationItem[] {
  const list = p.education ?? [];
  if (list.length === 0) return [{ ...EMPTY_EDU }];
  return list.map(e => ({
    ...EMPTY_EDU,
    institution: e.institution ?? '',
    degree: e.degree ?? '',
    years: e.year ?? '',
  }));
}

function mapSkills(p: ParsedResumeData): SkillCategory[] {
  const skills = (p.skills ?? []).filter(Boolean);
  if (skills.length === 0) return DEFAULT_SKILL_CATS.map(s => ({ ...s }));
  // Drop everything into a single "Skills" bucket — the LLM doesn't classify them.
  // User can recategorize manually before generating.
  return [{ category: 'Skills', items: skills.join(', ') }];
}

function mapExperience(p: ParsedResumeData): ExperienceItem[] {
  const list = p.experience ?? [];
  if (list.length === 0) return [{ ...EMPTY_EXP, bullets: [''] }];
  return list.map(e => ({
    ...EMPTY_EXP,
    company: e.company ?? '',
    title: e.title ?? '',
    duration: e.duration ?? '',
    bullets: bulletsFor(e),
  }));
}

function mapProjects(p: ParsedResumeData): ProjectItem[] {
  const list = p.projects ?? [];
  if (list.length === 0) return [{ ...EMPTY_PROJECT }];
  return list.map(pr => ({
    ...EMPTY_PROJECT,
    name: pr.name ?? '',
    description: pr.description ?? '',
    tech: toCommaList(pr.technologies),
  }));
}

export function parsedToBuilder(parsed: Record<string, unknown>): ResumeData {
  const p = (parsed ?? {}) as ParsedResumeData;
  return {
    basics: mapBasics(p),
    education: mapEducation(p),
    skillCategories: mapSkills(p),
    experience: mapExperience(p),
    projects: mapProjects(p),
    publications: [{ ...EMPTY_PUB }],
    awards: [{ ...EMPTY_AWARD }],
    volunteer: [{ ...EMPTY_VOL }],
  };
}
