import type { EvidenceGrade, EvidentiaryStatus } from './types';

/**
 * The methodology's single source of truth. The counting code (data/metrics.ts)
 * reads these constants; the /method page renders them.
 */

/** Grades that count in metrics. Grade 5 is a lead: kept, shown, never counted. */
export const COUNTED_GRADES: readonly EvidenceGrade[] = [1, 2, 3, 4];

/** Evidentiary statuses excluded from every metric. */
export const EXCLUDED_STATUSES: readonly EvidentiaryStatus[] = ['retracted'];

/** The average interval is measured from this instant (noon Eastern, inauguration day). */
export const INTERVAL_START = '2025-01-20T12:00:00-05:00';
export const INTERVAL_START_MS = Date.parse(INTERVAL_START);

/** How the start of the counting window is written in prose. */
export const START_LABEL = '20 January 2025';

export interface GradeDef {
  grade: EvidenceGrade;
  /** Short name used in labels: "Grade 2: primary records". */
  name: string;
  /** The schema's definition, verbatim. */
  meaning: string;
  /** The verb the editorial rule assigns to this grade. */
  verb: string;
  /** Whether records at this grade count in metrics, and the schema's wording for it. */
  counts: boolean;
  countsText: string;
}

/** Evidence grades, docs/schema.md § Evidence grades. */
export const GRADES: readonly GradeDef[] = [
  {
    grade: 1,
    name: 'official finding',
    meaning: 'Adjudicated or official finding (court judgment, IG/GAO/OGE finding, admission)',
    verb: 'found',
    counts: true,
    countsText: 'yes',
  },
  {
    grade: 2,
    name: 'primary records',
    meaning: 'Primary records establishing the material facts (filings, disclosures, contracts, FOIA documents) reported on by a journalistic outlet',
    verb: 'documented',
    counts: true,
    countsText: 'yes',
  },
  {
    grade: 3,
    name: 'document-based investigation',
    meaning: 'Document-based journalistic investigation',
    verb: 'reported',
    counts: true,
    countsText: 'yes',
  },
  {
    grade: 4,
    name: 'corroborated allegation',
    meaning: 'Allegation independently corroborated by two or more outlets with separate reporting (not the same wire copy republished) or by unrelated witnesses',
    verb: 'alleged (corroborated)',
    counts: true,
    countsText: 'yes',
  },
  {
    grade: 5,
    name: 'single-source allegation',
    meaning: 'Single-source allegation',
    verb: 'alleged',
    counts: false,
    countsText: 'no; retained as a lead',
  },
];

export function gradeDef(g: EvidenceGrade): GradeDef {
  return GRADES[g - 1] as GradeDef;
}

/** "Grade 2: primary records" */
export function gradeLabel(g: EvidenceGrade): string {
  return `Grade ${g}: ${gradeDef(g).name}`;
}
