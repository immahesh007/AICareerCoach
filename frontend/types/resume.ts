export interface Basics {
  name: string;
  portfolio: string;
  github: string;
  email: string;
  phone: string;
}

export interface EducationItem {
  institution: string;
  location: string;
  degree: string;
  gpa: string;
  years: string;
  coursework: string;
}

export interface SkillCategory {
  category: string;
  items: string;
}

export interface ExperienceItem {
  company: string;
  location: string;
  title: string;
  duration: string;
  bullets: string[];
}

export interface ProjectItem {
  name: string;
  tags: string;
  description: string;
  tech: string;
  date: string;
}

export interface PublicationItem {
  prefix: string;
  title: string;
  tags: string;
  description: string;
  tech: string;
  date: string;
}

export interface Award {
  name: string;
  date: string;
}

export interface VolunteerItem {
  org: string;
  location: string;
  description: string;
  duration: string;
}

export interface ResumeData {
  basics: Basics;
  education: EducationItem[];
  skillCategories: SkillCategory[];
  experience: ExperienceItem[];
  projects: ProjectItem[];
  publications: PublicationItem[];
  awards: Award[];
  volunteer: VolunteerItem[];
}

export interface GenerateResponse {
  pdf_url: string;
}

// Legacy — kept for backward compat with old backend route
export interface SkillLevel {
  emoji: string;
  level: string;
  items: string;
}
