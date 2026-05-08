'use client';

import type { ResumeData } from '@/types/resume';

// ─── style constants ──────────────────────────────────────────────────────────

const S = {
  page: {
    fontFamily: "'TeX Gyre Heros', 'Helvetica Neue', Helvetica, Arial, sans-serif",
    fontSize: '10.5px',
    color: '#000',
    lineHeight: '1.45',
    backgroundColor: '#fff',
    padding: '38px 52px',
    width: '100%',
    boxSizing: 'border-box' as const,
  },
  name: {
    fontSize: '23px',
    fontWeight: 'bold' as const,
    lineHeight: '1.2',
    marginBottom: '1px',
  },
  contactLine: {
    fontSize: '10.5px',
    marginTop: '1px',
  },
  headerWrap: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '3px',
  },
  headerRight: {
    textAlign: 'right' as const,
  },
  sectionTitle: {
    fontVariant: 'small-caps' as const,
    fontWeight: 'bold' as const,
    fontSize: '11.5px',
    letterSpacing: '0.03em',
    marginTop: '9px',
    marginBottom: '2px',
  },
  hr: {
    border: 'none',
    borderTop: '0.7px solid #000',
    margin: '0 0 5px 0',
  },
  bulletRow: {
    display: 'flex',
    gap: '5px',
    marginBottom: '4px',
  },
  bullet: {
    flexShrink: 0,
    width: '10px',
    textAlign: 'center' as const,
    paddingTop: '0px',
  },
  twoCol: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    width: '100%',
    gap: '8px',
  },
  subBulletWrap: {
    display: 'flex',
    gap: '5px',
    marginTop: '2px',
  },
  subBullet: {
    flexShrink: 0,
    width: '10px',
    textAlign: 'center' as const,
  },
};

// ─── helpers ──────────────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <>
      <div style={S.sectionTitle}>{title}</div>
      <hr style={S.hr} />
    </>
  );
}

function BulletRow({ children }: { children: React.ReactNode }) {
  return (
    <div style={S.bulletRow}>
      <span style={S.bullet}>•</span>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export default function ResumePreview({ data }: { data: ResumeData }) {
  const { basics, education, skillCategories, experience, projects, publications, awards, volunteer } = data;

  const any = (arr?: unknown[]) => arr && arr.length > 0;

  return (
    <div id="resume-preview" style={S.page}>

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div style={S.headerWrap}>
        <div>
          <div style={S.name}>{basics.name || 'Your Name'}</div>
          {basics.portfolio && (
            <div style={S.contactLine}>Portfolio: {basics.portfolio}</div>
          )}
          {basics.github && (
            <div style={S.contactLine}>Github:&nbsp;&nbsp;&nbsp; {basics.github}</div>
          )}
        </div>
        <div style={S.headerRight}>
          {basics.email && <div style={S.contactLine}>Email: {basics.email}</div>}
          {basics.phone && <div style={S.contactLine}>Mobile: &nbsp;{basics.phone}</div>}
        </div>
      </div>

      {/* ── EDUCATION ──────────────────────────────────────────────────────── */}
      {any(education) && (
        <>
          <SectionHeader title="Education" />
          {education.map((edu, i) => (
            <BulletRow key={i}>
              <div style={S.twoCol}>
                <span style={{ fontWeight: 'bold' }}>{edu.institution}</span>
                <span style={{ whiteSpace: 'nowrap' as const }}>{edu.location}</span>
              </div>
              <div style={S.twoCol}>
                <span style={{ fontStyle: 'italic' }}>
                  {edu.degree}{edu.gpa ? `; GPA: ${edu.gpa}` : ''}
                </span>
                <span style={{ fontStyle: 'italic', whiteSpace: 'nowrap' as const }}>{edu.years}</span>
              </div>
              {edu.coursework && (
                <div style={{ fontStyle: 'italic', marginTop: '1px' }}>
                  <span style={{ fontStyle: 'italic' }}>Courses:</span> {edu.coursework}
                </div>
              )}
            </BulletRow>
          ))}
        </>
      )}

      {/* ── SKILLS SUMMARY ─────────────────────────────────────────────────── */}
      {any(skillCategories) && skillCategories.some(s => s.items.trim()) && (
        <>
          <SectionHeader title="Skills Summary" />
          {skillCategories.filter(s => s.items.trim()).map((skill, i) => (
            <BulletRow key={i}>
              <span>
                <strong>{skill.category}</strong>:&nbsp;&nbsp;&nbsp;{skill.items}
              </span>
            </BulletRow>
          ))}
        </>
      )}

      {/* ── EXPERIENCE ─────────────────────────────────────────────────────── */}
      {any(experience) && (
        <>
          <SectionHeader title="Experience" />
          {experience.map((exp, i) => (
            <BulletRow key={i}>
              <div style={S.twoCol}>
                <span style={{ fontWeight: 'bold' }}>{exp.company}</span>
                <span style={{ whiteSpace: 'nowrap' as const }}>{exp.location}</span>
              </div>
              <div style={S.twoCol}>
                <span style={{ fontStyle: 'italic' }}>{exp.title}</span>
                <span style={{ fontStyle: 'italic', whiteSpace: 'nowrap' as const }}>{exp.duration}</span>
              </div>
              {exp.bullets.filter(b => b.trim()).map((b, bi) => (
                <div key={bi} style={S.subBulletWrap}>
                  <span style={S.subBullet}>○</span>
                  <span style={{ flex: 1 }}>
                    {/* Bold the "Title:" prefix if present */}
                    {b.includes(': ') ? (
                      <>
                        <strong>{b.split(': ')[0]}</strong>
                        {': '}{b.split(': ').slice(1).join(': ')}
                      </>
                    ) : b}
                  </span>
                </div>
              ))}
            </BulletRow>
          ))}
        </>
      )}

      {/* ── PROJECTS ───────────────────────────────────────────────────────── */}
      {any(projects) && projects.some(p => p.name.trim()) && (
        <>
          <SectionHeader title="Projects" />
          {projects.filter(p => p.name.trim()).map((proj, i) => (
            <BulletRow key={i}>
              <span>
                <strong>{proj.name}</strong>
                {proj.tags && ` (${proj.tags})`}
                {proj.description && `: ${proj.description}`}
                {proj.tech && ` Tech: ${proj.tech}`}
                {proj.date && ` (${proj.date})`}
              </span>
            </BulletRow>
          ))}
        </>
      )}

      {/* ── PUBLICATIONS ───────────────────────────────────────────────────── */}
      {any(publications) && publications.some(p => p.title.trim()) && (
        <>
          <SectionHeader title="Publications" />
          {publications.filter(p => p.title.trim()).map((pub, i) => (
            <BulletRow key={i}>
              <span>
                {pub.prefix && <><strong>{pub.prefix}:</strong>{' '}</>}
                <strong>{pub.title}</strong>
                {pub.tags && ` (${pub.tags})`}
                {pub.description && `: ${pub.description}`}
                {pub.tech && ` Tech: ${pub.tech}`}
                {pub.date && ` (${pub.date})`}
              </span>
            </BulletRow>
          ))}
        </>
      )}

      {/* ── HONORS AND AWARDS ──────────────────────────────────────────────── */}
      {any(awards) && awards.some(a => a.name.trim()) && (
        <>
          <SectionHeader title="Honors And Awards" />
          {awards.filter(a => a.name.trim()).map((award, i) => (
            <BulletRow key={i}>
              <span>
                {award.name}
                {award.date && ` - ${award.date}`}
              </span>
            </BulletRow>
          ))}
        </>
      )}

      {/* ── VOLUNTEER EXPERIENCE ───────────────────────────────────────────── */}
      {any(volunteer) && volunteer.some(v => v.org.trim()) && (
        <>
          <SectionHeader title="Volunteer Experience" />
          {volunteer.filter(v => v.org.trim()).map((vol, i) => (
            <BulletRow key={i}>
              <div style={S.twoCol}>
                <span style={{ fontWeight: 'bold' }}>{vol.org}</span>
                <span style={{ whiteSpace: 'nowrap' as const }}>{vol.location}</span>
              </div>
              <div style={S.twoCol}>
                <span style={{ fontStyle: 'italic' }}>{vol.description}</span>
                <span style={{ fontStyle: 'italic', whiteSpace: 'nowrap' as const, marginLeft: '8px' }}>
                  {vol.duration}
                </span>
              </div>
            </BulletRow>
          ))}
        </>
      )}
    </div>
  );
}
