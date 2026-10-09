/**
 * Mirror of docs/schema.md (dataset schema v1). One Entry is one reported item:
 * a discrete, dated, sourced allegation or finding.
 *
 * Field-by-field correspondence with the schema; where the schema text allows
 * "or null" the type allows null. The one addition is `placeholder`, which the
 * app brief requires on fake fixture data so it can never pass for reporting.
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

/** Status enum, in schema order. `status` is the latest known development. */
export const STATUSES = [
  'reported',
  'under-investigation',
  'litigation',
  'confirmed',
  'disputed',
  'retracted',
] as const;
export type Status = (typeof STATUSES)[number];

export type DatePrecision = 'day' | 'month';

export interface Source {
  outlet: string;
  title: string;
  url: string;
  /** YYYY-MM-DD */
  date: string;
  author: string;
}

export interface Entry {
  /** e.g. "2025-01-17-trump-meme-coin-launch" */
  id: string;
  /** YYYY-MM-DD (or YYYY-MM when date_precision is "month") */
  date: string;
  date_precision: DatePrecision;
  /** Short headline, <= 90 chars */
  title: string;
  /** 2-4 sentence neutral, attributive summary */
  summary: string;
  category: Category;
  actors: string[];
  entities: string[];
  /** Reported dollar figure; 0 or null means the entry carries no figure. */
  dollar_amount_usd: number | null;
  /** What the number represents and where it came from, or null */
  dollar_basis: string | null;
  status: Status;
  /** Latest known development, or null */
  status_note: string | null;
  sources: Source[];
  related_ids: string[];
  tags: string[];
  /** Fixture-only flag (app brief): true on fake placeholder entries. */
  placeholder?: boolean;
}

/** An Entry plus fields derived once at load time. */
export interface Item extends Entry {
  /** Whole UTC days since 1970-01-01 for `date` (first of month for month precision). */
  day: number;
  /** "YYYY-MM" */
  month: string;
  /** True when dollar_amount_usd is a positive number. */
  hasDollar: boolean;
  /** Lower-cased title + summary + actors + entities, for free-text search. */
  haystack: string;
}

export type LoadState =
  | { kind: 'loading' }
  | { kind: 'missing'; httpStatus: number | null; detail: string }
  | { kind: 'invalid'; detail: string }
  | { kind: 'empty' }
  | { kind: 'ready'; items: Item[]; skipped: SkippedEntry[] };

export interface SkippedEntry {
  index: number;
  id: string | null;
  reason: string;
}
