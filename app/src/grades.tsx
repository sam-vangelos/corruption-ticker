import type { EvidenceGrade, Item } from './types';
import { gradeDef, gradeLabel } from './method';

/**
 * Evidence-grade marks: a four-bar strength meter drawn in ink, not color.
 * Grade 1 fills all four bars, grade 4 fills one, grade 5 (a lead) fills none
 * and its outline is dashed. Five distinct shapes, no hue, so a grade can
 * never be mistaken for a category (which owns hue) or a status, and it
 * survives color-vision deficiency and forced-colors mode unchanged.
 */
const BARS = [
  { x: 1, h: 4 },
  { x: 5.5, h: 7 },
  { x: 10, h: 10 },
  { x: 14.5, h: 13 },
];

export function GradeMark({ grade, className }: { grade: EvidenceGrade; className?: string }) {
  const filled = 5 - grade;
  return (
    <svg
      className={`grade-mark${className ? ` ${className}` : ''}`}
      data-grade={grade}
      viewBox="0 0 18 14"
      width="18"
      height="14"
      aria-hidden="true"
      focusable="false"
    >
      {BARS.map((b, i) => (
        <rect
          key={b.x}
          x={b.x + 0.5}
          y={14 - b.h + 0.5}
          width={2.5}
          height={b.h - 1}
          rx={0.6}
          fill={i < filled ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth={1}
          strokeDasharray={grade === 5 ? '1.4 1.1' : undefined}
        />
      ))}
    </svg>
  );
}

/** "Documented", "Alleged (corroborated)": the grade's verb, capitalised, as the editorial rule assigns it. */
export function gradeVerb(g: EvidenceGrade): string {
  const v = gradeDef(g).verb;
  return v.charAt(0).toUpperCase() + v.slice(1);
}

/** Why a record is outside the metrics, or null when it counts. */
export function notCountedReason(it: Pick<Item, 'evidence_grade' | 'evidentiary_status' | 'qualifying'>): string | null {
  if (!gradeDef(it.evidence_grade).counts) return 'Lead, not counted';
  if (it.evidentiary_status === 'retracted') return 'Retracted, not counted';
  if (!it.qualifying) return 'Not yet published, not counted';
  return null;
}

/**
 * The grade as a card or drawer shows it: mark, the grade's verb and number,
 * and a visible "lead, not counted" / "retracted, not counted" tag.
 */
export function GradeBadge({ item }: { item: Pick<Item, 'evidence_grade' | 'evidentiary_status' | 'qualifying'> }) {
  const g = item.evidence_grade;
  const out = notCountedReason(item);
  return (
    <span className="grade-badge" title={gradeLabel(g)}>
      <GradeMark grade={g} />
      <span className="visually-hidden">Evidence {gradeLabel(g)}. The record says: </span>
      <span className="grade-badge__verb">{gradeVerb(g)}</span>
      <span className="grade-badge__n" aria-hidden="true">grade {g}</span>
      {out && <strong className="lead-tag">{out}</strong>}
    </span>
  );
}
