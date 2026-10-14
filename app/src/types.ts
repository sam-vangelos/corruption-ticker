/**
 * Mirror of docs/schema.md (dataset schema v2). One Entry is one *record*: a
 * discrete, dated, sourced claim or development. Records form a tree: one root
 * per distinct underlying matter (`root_id: null`) and child records for later
 * developments in that matter (`root_id` names the root).
 *
 * Field-by-field correspondence with the schema. Where the schema's example
 * shows `null` (or lists `null` among the allowed values) the type allows null.
 * Two readings the schema leaves implicit:
 *   - `amounts[].overlap_group` is `string | null`: a figure that overlaps no
 *     other figure has no group.
 *   - A record with no defensible figure has `amounts: []`.
 * The one addition is `placeholder`, which the app brief requires on fake
 * fixture data so it can never pass for reporting.
 */

/** Category enum, in schema order. This order is also the fixed palette order. */
export const CATEGORIES = [
  'self-enrichment',
  'foreign-emoluments',
  'crypto',
  'pardons-clemency',
  'pay-to-play',
  'nepotism-cronyism',
  'contracts-procurement',
  'oversight-retaliation',
  'abuse-of-office',
  'conflicts-of-interest',
  'misuse-of-funds',
] as const;
export type Category = (typeof CATEGORIES)[number];

export const RUBRIC_PRONGS = ['private-gain', 'abuse-of-office'] as const;
export type RubricProng = (typeof RUBRIC_PRONGS)[number];

export const ACTOR_ROLES = ['public-official', 'family', 'private-associate', 'private-entity'] as const;
export type ActorRole = (typeof ACTOR_ROLES)[number];

/** 1 strongest (adjudicated or official finding) to 5 weakest (single-source allegation, a lead). */
export const EVIDENCE_GRADES = [1, 2, 3, 4, 5] as const;
export type EvidenceGrade = (typeof EVIDENCE_GRADES)[number];

/** What the evidence establishes. */
export const EVIDENTIARY_STATUSES = ['finding', 'documented', 'corroborated', 'alleged', 'retracted'] as const;
export type EvidentiaryStatus = (typeof EVIDENTIARY_STATUSES)[number];

/** Where the matter stands procedurally. */
export const PROCEDURAL_STATUSES = ['none', 'under-investigation', 'litigation', 'resolved', 'dismissed'] as const;
export type ProceduralStatus = (typeof PROCEDURAL_STATUSES)[number];

/** What the subject said. `null` means no response is recorded. */
export const SUBJECT_RESPONSES = ['denied', 'no-comment', 'admitted', 'not-sought', 'retracted-by-outlet'] as const;
export type SubjectResponse = (typeof SUBJECT_RESPONSES)[number];

export const AMOUNT_TYPES = ['private-benefit', 'public-funds', 'face-value', 'exposure'] as const;
export type AmountType = (typeof AMOUNT_TYPES)[number];

export const ACTUAL_OR_ESTIMATED = ['actual', 'estimated'] as const;
export type ActualOrEstimated = (typeof ACTUAL_OR_ESTIMATED)[number];

export const SOURCE_KINDS = ['news', 'investigation', 'court-filing', 'official-report', 'disclosure', 'congressional'] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];

export type DatePrecision = 'day' | 'month';

export interface Amount {
  usd: number;
  amount_type: AmountType;
  actual_or_estimated: ActualOrEstimated;
  /** What the number represents and who reported it. */
  basis: string;
  /** Figures sharing a group describe the same money; counted once (largest wins). */
  overlap_group: string | null;
}

export interface Source {
  outlet: string;
  title: string;
  url: string;
  /** Required for publication. */
  archive_url: string;
  /** YYYY-MM-DD */
  date: string;
  author: string;
  kind: SourceKind;
}

export interface Entry {
  /** e.g. "2025-01-17-trump-meme-coin-launch" */
  id: string;
  /** null for a root record; otherwise the id of this matter's root record. */
  root_id: string | null;
  /** YYYY-MM-DD; month precision uses the 1st. Conduct or first-report date, never the ledger date. */
  date: string;
  date_precision: DatePrecision;
  /** Short headline, <= 90 chars */
  title: string;
  /** 2-4 sentence neutral, attributive summary; the verb matches the evidence grade. */
  summary: string;
  category: Category;
  rubric_prong: RubricProng;
  /** One sentence: which fact satisfies the prong. */
  rubric_evidence: string;
  actors: string[];
  actor_roles: Record<string, ActorRole>;
  entities: string[];
  offices: string[];
  evidence_grade: EvidenceGrade;
  /** Why this grade. */
  evidence_note: string;
  evidentiary_status: EvidentiaryStatus;
  procedural_status: ProceduralStatus;
  subject_response: SubjectResponse | null;
  /** Latest known development, or null */
  status_note: string | null;
  amounts: Amount[];
  sources: Source[];
  /** ISO 8601 timestamp; set when the record is published. */
  first_published_at: string | null;
  /** ISO 8601 timestamp of the latest post-publication edit, or null. */
  last_modified_at: string | null;
  /** ISO 8601 timestamp of the latest source verification. */
  last_verified_at: string;
  /** The named editor who approved the record; null means not in the public dataset. */
  approved_by: string | null;
  related_ids: string[];
  tags: string[];
  /** Fixture-only flag (app brief): true on fake placeholder entries. */
  placeholder?: boolean;
}

/** An Entry plus fields derived once at load time. */
export interface Item extends Entry {
  /** Whole UTC days since 1970-01-01 for `date`. */
  day: number;
  /** "YYYY-MM" */
  month: string;
  /** True for a root record (`root_id === null`). */
  isRoot: boolean;
  /** In the metric set: grade 1 to 4 and not retracted. */
  qualifying: boolean;
  /** Largest stated figure across `amounts`, or null when there is none. */
  maxUsd: number | null;
  /** ms since epoch for `first_published_at` (always set on a loaded item). */
  publishedMs: number;
  /** ms since epoch for `last_modified_at`, or null. */
  modifiedMs: number | null;
  /** Lower-cased title + summary + actors + entities + offices + outlets, for free-text search. */
  haystack: string;
}

/** One post-publication change, appended to data/corrections.json (schema v2 editorial rules). */
export type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };

export interface Correction {
  /** YYYY-MM-DD */
  date: string;
  record_id: string;
  field: string;
  old_value: JsonValue;
  new_value: JsonValue;
  reason: string;
  /** Fixture-only flag, as on entries. */
  placeholder?: boolean;
}

export type LoadState =
  | { kind: 'loading' }
  | { kind: 'missing'; httpStatus: number | null; detail: string }
  | { kind: 'invalid'; detail: string }
  | { kind: 'empty' }
  | { kind: 'ready'; items: Item[]; skipped: SkippedEntry[] };

/**
 * Why a record was left out. `unapproved` and `rubric` are the normal,
 * private exclusions (drafts, records failing the private-actor rule); the
 * rest are data errors.
 */
export type SkipCode = 'invalid' | 'v1' | 'id' | 'url' | 'unapproved' | 'rubric' | 'duplicate' | 'orphan';

export interface SkippedEntry {
  index: number;
  id: string | null;
  code: SkipCode;
  reason: string;
}

export type CorrectionsState =
  | { kind: 'loading' }
  | { kind: 'unavailable'; detail: string }
  | { kind: 'ready'; corrections: Correction[]; skipped: number };
