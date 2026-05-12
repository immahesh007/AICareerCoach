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
  summary?: string;
  skills?: string[];
  experience?: ParsedExperience[];
  education?: ParsedEducation[];
  projects?: ParsedProject[];
}

const EMPTY_BASICS: Basics = { name: '', portfolio: '', github: '', linkedin: '', email: '', phone: '' };
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
  { category: 'Concepts', items: '' },
  { category: 'Soft Skills', items: '' },
];

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
    linkedin: p.linkedin ?? '',
    portfolio: '',
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

type SkillBucket = 'Languages' | 'Frameworks' | 'Tools' | 'Platforms' | 'Concepts' | 'Soft Skills';

const LANGUAGE_SKILLS = new Set([
  'c', 'c++', 'c/c++', 'c#', 'python', 'java', 'javascript', 'js', 'typescript', 'ts',
  'go', 'golang', 'rust', 'ruby', 'php', 'swift', 'kotlin', 'scala', 'r', 'matlab',
  'perl', 'bash', 'shell', 'sql', 'plsql', 'pl/sql', 'tsql', 't-sql', 'html', 'html5',
  'css', 'css3', 'sass', 'scss', 'less', 'lua', 'dart', 'objective-c', 'haskell',
  'elixir', 'erlang', 'clojure', 'f#', 'vb', 'vb.net', 'assembly', 'cobol', 'fortran',
  'groovy', 'solidity',
]);

const FRAMEWORK_SKILLS = new Set([
  'react', 'react.js', 'reactjs', 'angular', 'angular.js', 'angularjs', 'vue', 'vue.js',
  'vuejs', 'svelte', 'next.js', 'nextjs', 'nuxt', 'nuxt.js', 'gatsby', 'remix',
  'django', 'flask', 'fastapi', 'spring', 'spring boot', 'spring mvc', 'spring data',
  'express', 'express.js', 'node.js', 'nodejs', 'nest.js', 'nestjs', 'rails',
  'ruby on rails', 'laravel', 'symfony', '.net', 'asp.net', 'asp.net core',
  'tensorflow', 'pytorch', 'keras', 'scikit-learn', 'sklearn', 'pandas', 'numpy',
  'scipy', 'matplotlib', 'jquery', 'bootstrap', 'tailwind', 'tailwindcss',
  'material-ui', 'mui', 'chakra ui', 'redux', 'mobx', 'rxjs', 'graphql', 'apollo',
  'sequelize', 'mongoose', 'hibernate', 'jpa', 'flutter', 'react native', 'xamarin',
  'electron', 'qt', 'jest', 'mocha', 'cypress', 'playwright', 'selenium', 'junit',
  'pytest', 'rspec',
]);

const PLATFORM_SKILLS = new Set([
  'aws', 'amazon web services', 'gcp', 'google cloud', 'google cloud platform',
  'azure', 'microsoft azure', 'linux', 'unix', 'windows', 'macos', 'mac os',
  'ubuntu', 'debian', 'centos', 'redhat', 'rhel', 'fedora', 'android', 'ios',
  'heroku', 'netlify', 'vercel', 'firebase', 'digitalocean', 'cloudflare',
  'oracle cloud', 'ibm cloud', 'alibaba cloud', 'openshift',
]);

const CONCEPT_SKILLS = new Set([
  'oop', 'oops', 'object-oriented programming', 'object oriented programming',
  'functional programming', 'fp', 'procedural programming',
  'design patterns', 'design pattern',
  'rest', 'restful', 'rest api', 'rest apis', 'restful api', 'restful apis',
  'graphql api', 'soap', 'grpc',
  'distributed systems', 'distributed computing', 'distributed system',
  'system design', 'microservices', 'monolithic architecture',
  'soa', 'service-oriented architecture', 'event-driven architecture',
  'event driven architecture', 'mvc', 'mvvm', 'mvp',
  'data structures', 'algorithms', 'dsa', 'data structures and algorithms',
  'concurrency', 'parallelism', 'multithreading', 'asynchronous programming',
  'tdd', 'bdd', 'test-driven development', 'behavior-driven development',
  'agile', 'scrum', 'kanban', 'waterfall', 'sdlc',
  'machine learning', 'ml', 'deep learning', 'artificial intelligence', 'ai',
  'nlp', 'natural language processing', 'computer vision',
  'cryptography', 'networking', 'tcp/ip', 'operating systems',
  'database design', 'normalization', 'big data', 'etl',
  'ci/cd', 'continuous integration', 'continuous deployment',
]);

const SOFT_SKILL_HINTS = [
  'leadership', 'communication', 'management', 'teamwork', 'collaboration',
  'problem solving', 'problem-solving', 'critical thinking', 'time management',
  'organization', 'organizational', 'creativity', 'adaptability', 'mentoring',
  'mentorship', 'public speaking', 'presentation', 'negotiation', 'analytical',
  'interpersonal', 'decision making', 'decision-making', 'conflict resolution',
  'emotional intelligence',
];

function classifySkill(skill: string): SkillBucket {
  const s = skill.toLowerCase().trim();
  if (LANGUAGE_SKILLS.has(s)) return 'Languages';
  if (FRAMEWORK_SKILLS.has(s)) return 'Frameworks';
  if (PLATFORM_SKILLS.has(s)) return 'Platforms';
  if (CONCEPT_SKILLS.has(s)) return 'Concepts';
  if (SOFT_SKILL_HINTS.some(k => s.includes(k))) return 'Soft Skills';
  // Fuzzy concept catches for variants ("RESTful Web Services", "Microservices Architecture")
  if (/\b(restful|rest\s+api|microservices|distributed|design\s+patterns?|system\s+design|data\s+structures|algorithms)\b/.test(s)) {
    return 'Concepts';
  }
  // Fuzzy platform catches (e.g. "AWS Lambda", "Azure Functions", "Google Cloud Run")
  if (/\b(aws|azure|gcp|linux|ubuntu|debian|cloud)\b/.test(s)) return 'Platforms';
  // Default: technical-but-uncategorized goes into Tools
  return 'Tools';
}

function mapSkills(p: ParsedResumeData): SkillCategory[] {
  const skills = (p.skills ?? [])
    .map(s => String(s).trim())
    .filter(Boolean);
  if (skills.length === 0) return DEFAULT_SKILL_CATS.map(s => ({ ...s }));

  const buckets: Record<SkillBucket, string[]> = {
    'Languages': [],
    'Frameworks': [],
    'Tools': [],
    'Platforms': [],
    'Concepts': [],
    'Soft Skills': [],
  };
  for (const skill of skills) {
    buckets[classifySkill(skill)].push(skill);
  }

  return DEFAULT_SKILL_CATS.map(({ category }) => ({
    category,
    items: buckets[category as SkillBucket].join(', '),
  }));
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
    summary: (p.summary ?? '').trim(),
    education: mapEducation(p),
    skillCategories: mapSkills(p),
    experience: mapExperience(p),
    projects: mapProjects(p),
    publications: [{ ...EMPTY_PUB }],
    awards: [{ ...EMPTY_AWARD }],
    volunteer: [{ ...EMPTY_VOL }],
  };
}
