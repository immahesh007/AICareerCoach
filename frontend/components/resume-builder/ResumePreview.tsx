'use client';

import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { ResumeData, ResumeDesignSettings } from '@/types/resume';
import { DEFAULT_DESIGN_SETTINGS, FONT_SIZE_MAP, MARGIN_MAP, FONT_FAMILY_MAP, BULLET_STYLE_MAP, SPACING_MAP } from '@/types/resume';

// ─── A4 page geometry ───────────────────────────────────────────────────────

const PAGE_WIDTH_MM = 210;
const PAGE_HEIGHT_MM = 297;
const MM_PER_PX = 25.4 / 96;

function getMargins(design: ResumeDesignSettings) {
  return MARGIN_MAP[design.marginSize];
}

function getInnerHeightPx(design: ResumeDesignSettings) {
  const m = getMargins(design);
  return (PAGE_HEIGHT_MM - m.top - m.bottom) / MM_PER_PX;
}

// ─── style factory (recomputed when design changes) ──────────────────────────

function getS(design: ResumeDesignSettings) {
  const fontSize = FONT_SIZE_MAP[design.fontSize].css;
  const fontFamily = FONT_FAMILY_MAP[design.fontFamily].css;
  const spacing = SPACING_MAP[design.spacing];
  const bulletSymbol = BULLET_STYLE_MAP[design.bulletStyle].symbol;

  return {
    page: {
      fontFamily,
      fontSize,
      color: '#000',
      lineHeight: spacing.lineHeight,
      boxSizing: 'border-box' as const,
    },
    name: {
      fontSize: '23px',
      fontWeight: 'bold' as const,
      lineHeight: '1.2',
      marginBottom: '1px',
    },
    contactLine: {
      fontSize,
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
      marginTop: `${spacing.sectionGap}px`,
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
      marginBottom: `${spacing.itemGap}px`,
    },
    bullet: {
      flexShrink: 0,
      width: '10px',
      textAlign: 'center' as const,
      paddingTop: '0px',
    },
    bulletSymbol,
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
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function SectionHeader({ title, styles }: { title: string; styles: ReturnType<typeof getS> }) {
  return (
    <>
      <div style={styles.sectionTitle}>{title}</div>
      <hr style={styles.hr} />
    </>
  );
}

function BulletRow({ children, styles }: { children: ReactNode; styles: ReturnType<typeof getS> }) {
  return (
    <div style={styles.bulletRow}>
      <span style={styles.bullet}>{styles.bulletSymbol}</span>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}

// ─── block builder ────────────────────────────────────────────────────────────

type Block = {
  key: string;
  el: ReactNode;
  keepWithNext?: boolean;
};

function buildBlocks(data: ResumeData, S: ReturnType<typeof getS>): Block[] {
  const blocks: Block[] = [];
  const { basics, summary, education, skillCategories, experience, projects, publications, awards, volunteer } = data;

  // ── HEADER ─────────────────────────────────────────────────────────────────
  blocks.push({
    key: 'header',
    el: (
      <div style={S.headerWrap}>
        <div>
          <div style={S.name}>{basics.name || 'Your Name'}</div>
          {basics.portfolio && (
            <div style={S.contactLine}>Portfolio: {basics.portfolio}</div>
          )}
          {basics.github && (
            <div style={S.contactLine}>Github:&nbsp;&nbsp;&nbsp; {basics.github}</div>
          )}
          {basics.linkedin && (
            <div style={S.contactLine}>LinkedIn: {basics.linkedin}</div>
          )}
        </div>
        <div style={S.headerRight}>
          {basics.email && <div style={S.contactLine}>Email: {basics.email}</div>}
          {basics.phone && <div style={S.contactLine}>Mobile: &nbsp;{basics.phone}</div>}
        </div>
      </div>
    ),
  });

  // ── SUMMARY ────────────────────────────────────────────────────────────────
  if (summary && summary.trim()) {
    blocks.push({ key: 'summary-h', el: <SectionHeader title="Summary" styles={S} />, keepWithNext: true });
    blocks.push({
      key: 'summary',
      el: <div style={{ marginBottom: '4px' }}>{summary}</div>,
    });
  }

  // ── SKILLS SUMMARY ─────────────────────────────────────────────────────────
  const skills = skillCategories?.filter(s => s.items.trim()) ?? [];
  if (skills.length) {
    blocks.push({ key: 'skills-h', el: <SectionHeader title="Skills Summary" styles={S} />, keepWithNext: true });
    skills.forEach((skill, i) => {
      blocks.push({
        key: `skill-${i}`,
        el: (
          <BulletRow styles={S}>
            <span>
              <strong>{skill.category}</strong>:&nbsp;&nbsp;&nbsp;{skill.items}
            </span>
          </BulletRow>
        ),
        keepWithNext: i === 0 ? false : false,
      });
    });
  }

  // ── EXPERIENCE ─────────────────────────────────────────────────────────────
  if (experience?.length) {
    blocks.push({ key: 'exp-h', el: <SectionHeader title="Experience" styles={S} />, keepWithNext: true });
    experience.forEach((exp, i) => {
      blocks.push({
        key: `exp-${i}`,
        el: (
          <BulletRow styles={S}>
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
        ),
      });
    });
  }

  // ── PROJECTS ───────────────────────────────────────────────────────────────
  const validProjects = projects?.filter(p => p.name.trim()) ?? [];
  if (validProjects.length) {
    blocks.push({ key: 'projects-h', el: <SectionHeader title="Projects" styles={S} />, keepWithNext: true });
    validProjects.forEach((proj, i) => {
      blocks.push({
        key: `proj-${i}`,
        el: (
          <BulletRow styles={S}>
            <span>
              <strong>{proj.name}</strong>
              {proj.tags && ` (${proj.tags})`}
              {proj.description && `: ${proj.description}`}
              {proj.tech && ` Tech: ${proj.tech}`}
              {proj.date && ` (${proj.date})`}
            </span>
          </BulletRow>
        ),
      });
    });
  }

  // ── PUBLICATIONS ───────────────────────────────────────────────────────────
  const validPubs = publications?.filter(p => p.title.trim()) ?? [];
  if (validPubs.length) {
    blocks.push({ key: 'pubs-h', el: <SectionHeader title="Publications" styles={S} />, keepWithNext: true });
    validPubs.forEach((pub, i) => {
      blocks.push({
        key: `pub-${i}`,
        el: (
          <BulletRow styles={S}>
            <span>
              {pub.prefix && <><strong>{pub.prefix}:</strong>{' '}</>}
              <strong>{pub.title}</strong>
              {pub.tags && ` (${pub.tags})`}
              {pub.description && `: ${pub.description}`}
              {pub.tech && ` Tech: ${pub.tech}`}
              {pub.date && ` (${pub.date})`}
            </span>
          </BulletRow>
        ),
      });
    });
  }

  // ── EDUCATION ──────────────────────────────────────────────────────────────
  if (education?.length) {
    blocks.push({ key: 'edu-h', el: <SectionHeader title="Education" styles={S} />, keepWithNext: true });
    education.forEach((edu, i) => {
      blocks.push({
        key: `edu-${i}`,
        el: (
          <BulletRow styles={S}>
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
        ),
      });
    });
  }

  // ── HONORS AND AWARDS ─────────────────────────────────────────────────────
  const validAwards = awards?.filter(a => a.name.trim()) ?? [];
  if (validAwards.length) {
    blocks.push({ key: 'awards-h', el: <SectionHeader title="Honors And Awards" styles={S} />, keepWithNext: true });
    validAwards.forEach((award, i) => {
      blocks.push({
        key: `award-${i}`,
        el: (
          <BulletRow styles={S}>
            <span>
              {award.name}
              {award.date && ` - ${award.date}`}
            </span>
          </BulletRow>
        ),
      });
    });
  }

  // ── VOLUNTEER EXPERIENCE ──────────────────────────────────────────────────
  const validVol = volunteer?.filter(v => v.org.trim()) ?? [];
  if (validVol.length) {
    blocks.push({ key: 'vol-h', el: <SectionHeader title="Volunteer Experience" styles={S} />, keepWithNext: true });
    validVol.forEach((vol, i) => {
      blocks.push({
        key: `vol-${i}`,
        el: (
          <BulletRow styles={S}>
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
        ),
      });
    });
  }

  return blocks;
}

// ─── page packing ─────────────────────────────────────────────────────────────

function packIntoPages(
  blocks: Block[],
  heights: number[],
  pageInnerPx: number,
): number[][] {
  if (blocks.length === 0) return [[]];
  const pages: number[][] = [];
  let current: number[] = [];
  let currentH = 0;

  let i = 0;
  while (i < blocks.length) {
    let unitEnd = i;
    let unitH = heights[i] ?? 0;
    while (blocks[unitEnd]?.keepWithNext && unitEnd + 1 < blocks.length) {
      unitEnd++;
      unitH += heights[unitEnd] ?? 0;
    }

    const fits = currentH + unitH <= pageInnerPx;
    if (!fits && current.length > 0) {
      pages.push(current);
      current = [];
      currentH = 0;
    }

    for (let j = i; j <= unitEnd; j++) {
      current.push(j);
      currentH += heights[j] ?? 0;
    }
    i = unitEnd + 1;
  }

  if (current.length > 0) pages.push(current);
  return pages.length ? pages : [[]];
}

// ─── main component ──────────────────────────────────────────────────────────

export default function ResumePreview({
  data,
  design = DEFAULT_DESIGN_SETTINGS,
}: {
  data: ResumeData;
  design?: ResumeDesignSettings;
}) {
  const S = useMemo(() => getS(design), [design]);
  const paddingV = MARGIN_MAP[design.marginSize].top;
  const paddingH = MARGIN_MAP[design.marginSize].left;
  const innerHeightPx = useMemo(() => getInnerHeightPx(design), [design]);
  const printWidthPx = PAGE_WIDTH_MM - 2 * paddingH;

  const blocks = useMemo(() => buildBlocks(data, S), [data, S]);
  const measureRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [pages, setPages] = useState<number[][]>(() => [blocks.map((_, i) => i)]);

  useLayoutEffect(() => {
    const recompute = () => {
      const heights = blocks.map((_, i) => measureRefs.current[i]?.offsetHeight ?? 0);
      setPages(prev => {
        const next = packIntoPages(blocks, heights, innerHeightPx);
        if (
          prev.length === next.length &&
          prev.every((p, i) => p.length === next[i].length && p.every((v, j) => v === next[i][j]))
        ) {
          return prev;
        }
        return next;
      });
    };
    recompute();
    const ro = new ResizeObserver(recompute);
    measureRefs.current.forEach(el => el && ro.observe(el));
    return () => ro.disconnect();
  }, [blocks, innerHeightPx]);

  return (
    <>
      {/* Hidden measurement column */}
      <div
        id="resume-print"
        aria-hidden
        style={{
          position: 'fixed',
          top: 0,
          left: '-99999px',
          width: `${printWidthPx}mm`,
          visibility: 'hidden',
          pointerEvents: 'none',
        }}
      >
        <div style={S.page}>
          {blocks.map((b, i) => (
            <div
              key={b.key}
              ref={el => {
                measureRefs.current[i] = el;
              }}
            >
              {b.el}
            </div>
          ))}
        </div>
      </div>

      {/* Visible: stack of A4 pages */}
      <div
        id="resume-preview"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
        }}
      >
        {pages.map((pageBlockIdxs, pi) => (
          <div
            key={pi}
            style={{
              width: `${PAGE_WIDTH_MM}mm`,
              minHeight: `${PAGE_HEIGHT_MM}mm`,
              background: '#fff',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.18)',
              borderRadius: '2px',
              padding: `${paddingV}mm ${paddingH}mm`,
              boxSizing: 'border-box',
              flexShrink: 0,
            }}
          >
            <div style={S.page}>
              {pageBlockIdxs.map(idx => (
                <div key={blocks[idx].key}>{blocks[idx].el}</div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
