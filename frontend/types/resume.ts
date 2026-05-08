export interface Basics {
  name: string;
  email: string;
  phone: string;
  linkedin: string;
  summary: string;
}

export interface ExperienceItem {
  title: string;
  company: string;
  duration: string;
  description: string;
}

export interface EducationItem {
  year: string;
  degree: string;
  institution: string;
}

export interface ResumeData {
  basics: Basics;
  skills: string[];
  experience: ExperienceItem[];
  education: EducationItem[];
  certifications: string[];
}

export interface GenerateResponse {
  pdf_url: string;
}
