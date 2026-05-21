export interface Basics {
  name: string;
  portfolio: string;
  github: string;
  linkedin: string;
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
  summary: string;
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

export type FontSize = 'small' | 'normal' | 'large';
export type MarginSize = 'normal' | 'tight' | 'none';
export type FontFamily = 'texgyre' | 'latinmodern' | 'roboto' | 'times';
export type BulletStyle = 'dot' | 'dash' | 'arrow' | 'diamond';
export type SpacingMode = 'normal' | 'compact';

export interface ResumeDesignSettings {
  fontSize: FontSize;
  marginSize: MarginSize;
  fontFamily: FontFamily;
  bulletStyle: BulletStyle;
  spacing: SpacingMode;
}

export const DEFAULT_DESIGN_SETTINGS: ResumeDesignSettings = {
  fontSize: 'large',
  marginSize: 'tight',
  fontFamily: 'texgyre',
  bulletStyle: 'dash',
  spacing: 'normal',
};

export const FONT_SIZE_MAP: Record<FontSize, { latex: string; css: string }> = {
  small: { latex: '10pt', css: '9.5px' },
  normal: { latex: '11pt', css: '10.5px' },
  large: { latex: '12pt', css: '11.5px' },
};

export const MARGIN_MAP: Record<MarginSize, { top: number; bottom: number; left: number; right: number }> = {
  normal: { top: 16.51, bottom: 16.51, left: 19.05, right: 19.05 },
  tight: { top: 9, bottom: 9, left: 12, right: 12 },
  none: { top: 4, bottom: 4, left: 6, right: 6 },
};

export const FONT_FAMILY_MAP: Record<FontFamily, { latex: string; css: string }> = {
  texgyre: { latex: 'TeX Gyre Heros', css: "'TeX Gyre Heros', 'Helvetica Neue', Helvetica, Arial, sans-serif" },
  latinmodern: { latex: 'Latin Modern Roman', css: "'Latin Modern Roman', 'CMU Serif', Georgia, 'Times New Roman', serif" },
  roboto: { latex: 'Roboto', css: "'Roboto', 'Helvetica Neue', Helvetica, Arial, sans-serif" },
  times: { latex: 'TeX Gyre Termes', css: "'Times New Roman', Times, Georgia, serif" },
};

export const BULLET_STYLE_MAP: Record<BulletStyle, { symbol: string; latexLabel: string }> = {
  dot: { symbol: '•', latexLabel: '\\textbullet' },
  dash: { symbol: '–', latexLabel: '--' },
  arrow: { symbol: '→', latexLabel: '$\\rightarrow$' },
  diamond: { symbol: '◆', latexLabel: '$\\diamond$' },
};

export const SPACING_MAP: Record<SpacingMode, { lineHeight: string; sectionGap: number; itemGap: number }> = {
  normal: { lineHeight: '1.45', sectionGap: 9, itemGap: 4 },
  compact: { lineHeight: '1.25', sectionGap: 5, itemGap: 2 },
};

// ── AI Suggestions ────────────────────────────────────────────────────────────

export interface SuggestionItem {
  original: string;
  suggested: string;
}

export interface ExperienceSuggestion {
  exp_index: number;
  bullets: Array<{
    bullet_index: number;
    original: string;
    suggested: string;
  }>;
}

export interface ProjectSuggestion {
  proj_index: number;
  description?: SuggestionItem;
  tech?: SuggestionItem;
}

export interface AwardSuggestion {
  award_index: number;
  name?: SuggestionItem;
  date?: SuggestionItem;
}

export interface VolunteerSuggestion {
  vol_index: number;
  description: SuggestionItem;
}

export interface SkillReclassification {
  skill: string;
  from_category: string;
  to_category: string;
}

export interface ResumeSuggestions {
  summary?: SuggestionItem | null;
  experience?: ExperienceSuggestion[];
  projects?: ProjectSuggestion[];
  awards?: AwardSuggestion[];
  volunteer?: VolunteerSuggestion[];
  skills?: {
    reclassifications: SkillReclassification[];
  };
}

// Legacy — kept for backward compat with old backend route
export interface SkillLevel {
  emoji: string;
  level: string;
  items: string;
}
