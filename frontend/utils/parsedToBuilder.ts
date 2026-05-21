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
const EMPTY_PROJECT: ProjectItem = { name: '', tags: '', description: '', tech: '', date: '', bullets: [] };
const EMPTY_PUB: PublicationItem = {
  prefix: 'Book', title: '', tags: '', description: '', tech: '', date: '',
};
const EMPTY_AWARD: Award = { name: '', date: '' };
const EMPTY_VOL: VolunteerItem = { org: '', location: '', description: '', duration: '' };

const DEFAULT_SKILL_CATS: SkillCategory[] = [
  { category: 'Languages', items: '' },
  { category: 'Frameworks & Technologies', items: '' },
  { category: 'Cloud & DevOps', items: '' },
  { category: 'Tools & Platforms', items: '' },
  { category: 'Software Engineering Concepts', items: '' },
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

type SkillBucket = 'Languages' | 'Frameworks & Technologies' | 'Cloud & DevOps' | 'Tools & Platforms' | 'Software Engineering Concepts';

const LANGUAGE_SKILLS = new Set([
  'c', 'c++', 'c/c++', 'c#', 'python', 'java', 'javascript', 'js', 'typescript', 'ts',
  'go', 'golang', 'rust', 'ruby', 'php', 'swift', 'kotlin', 'scala', 'r', 'matlab',
  'perl', 'bash', 'shell', 'sql', 'mysql', 'postgresql', 'plsql', 'pl/sql', 'tsql',
  't-sql', 'html', 'html5', 'css', 'css3', 'sass', 'scss', 'less', 'lua', 'dart',
  'objective-c', 'haskell', 'elixir', 'erlang', 'clojure', 'f#', 'vb', 'vb.net',
  'assembly', 'cobol', 'fortran', 'groovy', 'solidity',
]);

const FRAMEWORK_TECH_SKILLS = new Set([
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
  // Big data / streaming
  'pyspark', 'spark', 'spark streaming', 'apache spark', 'apache kafka', 'kafka',
  'hadoop', 'hive', 'airflow',
  // Databases
  'mongodb', 'cassandra', 'redis', 'elasticsearch', 'dynamodb', 'couchdb',
  'neo4j', 'snowflake', 'bigquery', 'redshift',
  // ML / AI frameworks
  'spacy', 'nltk', 'opencv', 'hugging face', 'transformers', 'langchain',
  'llamaindex', 'mlflow', 'kubeflow', 'dagster',
  // Mobile / desktop
  'swiftui', 'uikit', 'jetpack compose',
  // Other
  'grpc', 'protobuf', 'thrift', 'rabbitmq', 'celery',
]);

const CLOUD_DEVOPS_SKILLS = new Set([
  'aws', 'amazon web services', 'gcp', 'google cloud', 'google cloud platform',
  'azure', 'microsoft azure', 'linux', 'unix', 'ubuntu', 'debian', 'centos',
  'redhat', 'rhel', 'fedora', 'heroku', 'netlify', 'vercel', 'firebase',
  'digitalocean', 'cloudflare', 'oracle cloud', 'ibm cloud', 'alibaba cloud',
  'openshift',
  // Containerization & orchestration
  'docker', 'kubernetes', 'k8s', 'docker compose', 'podman', 'containerd',
  'helm', 'istio', 'terraform', 'ansible', 'puppet', 'chef', 'cloudformation',
  'pulumi',
  // CI/CD
  'ci/cd', 'ci/cd pipeline', 'continuous integration', 'continuous deployment',
  'continuous delivery', 'jenkins', 'github actions', 'gitlab ci', 'gitlab',
  'circleci', 'travis ci', 'bamboo', 'argo cd', 'argocd', 'spinnaker',
  'bitbucket pipelines', 'azure devops',
  // Version control
  'git', 'github', 'gitlab', 'bitbucket', 'svn', 'subversion',
]);

const TOOLS_PLATFORMS_SKILLS = new Set([
  'jira', 'confluence', 'trello', 'asana', 'notion', 'slack', 'teams',
  'postman', 'insomnia', 'swagger', 'openapi',
  'vs code', 'visual studio code', 'intellij', 'intellij idea', 'eclipse',
  'pycharm', 'webstorm', 'android studio', 'xcode', 'vim', 'neovim',
  'figma', 'sketch', 'adobe xd', 'zeplin', 'invision',
  'maven', 'gradle', 'npm', 'yarn', 'pnpm', 'pip', 'conda', 'poetry',
  'webpack', 'vite', 'esbuild', 'babel', 'eslint', 'prettier',
  'splunk', 'datadog', 'grafana', 'prometheus', 'new relic',
  'nginx', 'apache', 'tomcat', 'iis',
]);

const ENGINEERING_CONCEPT_SKILLS = new Set([
  'oop', 'oops', 'object-oriented programming', 'object oriented programming',
  'functional programming', 'fp', 'procedural programming',
  'design patterns', 'design pattern',
  'ddd', 'domain-driven design', 'domain driven design',
  'rest', 'restful', 'rest api', 'rest apis', 'restful api', 'restful apis',
  'graphql api', 'soap',
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
]);

function _classifySkill(skill: string): SkillBucket {
  const s = skill.toLowerCase().trim();
  if (LANGUAGE_SKILLS.has(s)) return 'Languages';
  if (FRAMEWORK_TECH_SKILLS.has(s)) return 'Frameworks & Technologies';
  if (CLOUD_DEVOPS_SKILLS.has(s)) return 'Cloud & DevOps';
  if (TOOLS_PLATFORMS_SKILLS.has(s)) return 'Tools & Platforms';
  if (ENGINEERING_CONCEPT_SKILLS.has(s)) return 'Software Engineering Concepts';
  // Fuzzy concept catches for variants ("RESTful Web Services", "Microservices Architecture")
  if (/\b(restful|rest\s+api|microservices|distributed|design\s+patterns?|system\s+design|data\s+structures|algorithms|domain.driven)\b/.test(s)) {
    return 'Software Engineering Concepts';
  }
  // Fuzzy cloud/devops catches (e.g. "AWS Lambda", "Azure Functions", "Google Cloud Run")
  if (/\b(aws|azure|gcp|docker|kubernetes|linux|ubuntu|debian|cloud|ci\/cd|jenkins|terraform|ansible|git\b|github)\b/.test(s)) return 'Cloud & DevOps';
  // Fuzzy framework/tech catches (e.g. "Apache Spark", "Spring Cloud")
  if (/\b(spark|kafka|flask|django|react|angular|spring|node\b|express|pytorch|tensorflow|mongodb)\b/.test(s)) return 'Frameworks & Technologies';
  // Default: uncategorized technical skill goes into Tools & Platforms
  return 'Tools & Platforms';
}

const _PREFIX_RE = /^[\w\s&/()+]+[:：]\s*/;

function _splitCompoundSkills(skills: string[]): string[] {
  const result: string[] = [];
  for (const skill of skills) {
    let cleaned = skill;
    // Strip category prefix like "Backend: " or "Data & Streaming: "
    if (_PREFIX_RE.test(cleaned)) {
      cleaned = cleaned.replace(_PREFIX_RE, '').trim();
    }
    // If comma-separated, split into individual skills
    if (cleaned.includes(',')) {
      const parts = cleaned.split(',').map(s => s.trim()).filter(Boolean);
      result.push(...parts);
    } else {
      result.push(cleaned);
    }
  }
  return result;
}

function mapSkills(p: ParsedResumeData): SkillCategory[] {
  const raw = (p.skills ?? [])
    .map(s => String(s).trim())
    .filter(Boolean);
  const skills = _splitCompoundSkills(raw);
  if (skills.length === 0) return DEFAULT_SKILL_CATS.map(s => ({ ...s }));

  const buckets: Record<SkillBucket, string[]> = {
    'Languages': [],
    'Frameworks & Technologies': [],
    'Cloud & DevOps': [],
    'Tools & Platforms': [],
    'Software Engineering Concepts': [],
  };
  for (const skill of skills) {
    const bucket = _classifySkill(skill);
    if (buckets[bucket]) {
      buckets[bucket].push(skill);
    }
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

export function classifySkill(skill: string): string {
  return _classifySkill(skill);
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
