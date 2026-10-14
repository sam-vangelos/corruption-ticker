import type { ActorRole, EvidenceGrade, EvidentiaryStatus, Item } from './types';

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

/** Roles that are not public officials (inclusion rubric, private-person rule). */
export const PRIVATE_ROLES: readonly ActorRole[] = ['family', 'private-associate', 'private-entity'];
/** A record naming only private actors needs this grade or better (a lower number)... */
export const PRIVATE_MAX_GRADE: EvidenceGrade = 3;
/** ...and a subject response other than these (null counts as "not recorded"). */
export const PRIVATE_DISALLOWED_RESPONSES = ['not-sought', null] as const;

/** The editor whose approval puts a record in the public dataset; named in the citation. */
export const EDITOR = 'Sam Vangelos';
export const SITE_NAME = 'The Ethics Record';
export const SITE_DECK = 'Sourced allegations, findings, and oversight changes in the second Trump administration.';
/** Schema major version of the dataset the app reads. */
export const SCHEMA_VERSION = 2;

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

const lowest = COUNTED_GRADES[0] ?? 1;
const highest = COUNTED_GRADES[COUNTED_GRADES.length - 1] ?? 4;
const leadGrades = GRADES.filter((g) => !g.counts).map((g) => g.grade).join(', ');

/** A rule as published on /method. `id` is a stable anchor. */
export interface Rule {
  id: string;
  /** Markdown-lite: `code` spans and *emphasis*, rendered by the method page. */
  text: string;
}

/**
 * Counting rules, copied verbatim from docs/schema.md § Counting rules
 * (clarified 2026-10-13 on main). data/metrics.ts implements them with the
 * constants above; if the schema text changes, change it here word for word.
 */
export const COUNTING_RULES: readonly Rule[] = [
  { id: 'qualifying', text: 'A record is *qualifying* when `evidence_grade` is 1 to 4, `evidentiary_status` is not `retracted`, `approved_by` is set, and `first_published_at` is set and not in the future.' },
  { id: 'events', text: 'Event count = number of trees (a root plus its children) containing at least one qualifying record.' },
  { id: 'records', text: 'Record count = all qualifying records, root or child.' },
  { id: 'public-file', text: 'The public dataset file contains only approved, rubric-passing records whose `first_published_at` is set and not after build time, projected to schema fields only. Leads (grade 5) and retracted records stay in it, labelled, because they are part of the record. Unapproved, unpublished, or rubric-failing records are never written to it, never get a record page, and are never named on any public page. An approved record that fails validation, or whose root is not public, fails the build rather than being dropped. Duplicate ids anywhere in the raw file fail the build.' },
  { id: 'feeds', text: 'Feeds contain qualifying records only.' },
  { id: 'interval', text: 'Average interval = hours since 2025-01-20T12:00:00-05:00 divided by event count.' },
  { id: 'money', text: 'Financial stakes = per `amount_type`, sum of `usd` over records in the metric set, counting each `overlap_group` once (largest figure wins). No grand total.' },
  { id: 'dates', text: 'Event dates are `date`; the seven-day cadence strip uses `first_published_at`.' },
];

export interface RubricPart {
  id: string;
  title: string;
  text: string;
  items?: readonly string[];
}

/** Inclusion rubric, docs/schema.md § Inclusion rubric. A record is included when both the prong and the evidence hold. */
export const RUBRIC: readonly RubricPart[] = [
  {
    id: 'prong',
    title: 'The prong',
    text: 'The record concerns one of two things, and its rubric_evidence field names the fact that satisfies it:',
    items: [
      'Private gain: use of public office, or proximity to it, for private gain.',
      'Abuse of office: abuse of office to punish oversight, reward allies, or evade accountability.',
    ],
  },
  {
    id: 'evidence',
    title: 'The evidence',
    text: `Grade ${lowest} to ${highest} to count in metrics; grade ${leadGrades} may be stored as a lead. Outlet identity is recorded with every source and is never the inclusion gate.`,
  },
  {
    id: 'private-persons',
    title: 'Private persons and entities',
    text: `A record whose actors are only family members, private associates or private entities needs evidence grade ${PRIVATE_MAX_GRADE} or better and a recorded subject response: sought and received, or sought and declined. Public-official status does not extend to family members or private entities.`,
  },
  {
    id: 'excluded',
    title: 'Excluded',
    text: 'The record leaves out:',
    items: [
      'Policy disagreements.',
      'Pure opinion.',
      'Unsourced social-media claims.',
      'First-term (2017 to 2021) conduct, unless a development from 2025 on exists; then that development is the record.',
    ],
  },
  {
    id: 'approval',
    title: 'Approval and archiving',
    text: 'A named editor approves every record before it is published; an unapproved record is not in the public dataset. Every source is archived when it is verified, and the archive link is published beside the original.',
  },
];

/**
 * The dataset version: schema major version plus the UTC minute of the latest
 * publication or edit, e.g. "v2-2026-10-14T03:00Z". A placeholder dataset says so.
 */
export function datasetVersion(items: readonly Item[]): string {
  let latest = 0;
  for (const it of items) latest = Math.max(latest, it.publishedMs ?? 0, it.modifiedMs ?? 0);
  const stamp = latest > 0 ? `${new Date(latest).toISOString().slice(0, 16)}Z` : 'empty';
  const fake = items.some((it) => it.placeholder) ? '-placeholder' : '';
  return `v${SCHEMA_VERSION}-${stamp}${fake}`;
}

/** The recommended citation, as one plain-text line. */
export function citation(version: string, url: string, accessed: string): string {
  return `${SITE_NAME}: ${SITE_DECK.replace(/\.$/, '')}. Edited by ${EDITOR}. Dataset version ${version}. ${url}. Accessed ${accessed}.`;
}
