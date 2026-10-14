import {
  ACTOR_ROLES, ACTUAL_OR_ESTIMATED, AMOUNT_TYPES, CATEGORIES, EVIDENCE_GRADES, EVIDENTIARY_STATUSES,
  PROCEDURAL_STATUSES, RUBRIC_PRONGS, SOURCE_KINDS, SUBJECT_RESPONSES,
  type ActorRole, type Amount, type Correction, type CorrectionsState, type Entry, type EvidenceGrade,
  type Item, type JsonValue, type LoadState, type SkipCode, type SkippedEntry, type Source,
} from '../types';
import { monthKey, parseDay } from './dates';
import { isQualifying } from './metrics';
import { summaryProblem } from './lint';
import { EDITOR_NAME, correctionDigest, recordDigest } from './approval';
import { PRIVATE_DISALLOWED_RESPONSES, PRIVATE_MAX_GRADE, PRIVATE_ROLES } from '../method';

export const DATA_URL = `${import.meta.env.BASE_URL}data/entries.json`;
export const CORRECTIONS_URL = `${import.meta.env.BASE_URL}data/corrections.json`;

const isStr = (v: unknown): v is string => typeof v === 'string';
const nonEmpty = (v: unknown): v is string => isStr(v) && v.trim() !== '';
const strOrNull = (v: unknown): string | null => (nonEmpty(v) ? v : null);
const strList = (v: unknown): string[] => (Array.isArray(v) ? v.filter(isStr) : []);
const oneOf = <T extends string | number>(list: readonly T[], v: unknown): v is T => (list as readonly unknown[]).includes(v);

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** The date floor (docs/schema.md § Admission controls). */
export const DATE_FLOOR = '2025-01-20';
const DATE_FLOOR_DAY = parseDay(DATE_FLOOR) as number;

/**
 * A list of names (actors, entities, offices): an array of non-blank strings,
 * optionally non-empty and distinct. Anything else fails; nothing is coerced
 * or silently dropped.
 */
function nameList(v: unknown, field: string, opts: { nonEmpty?: boolean; distinct?: boolean }): { names: string[] } | string {
  if (!Array.isArray(v)) return `${field} must be an array of names`;
  if (opts.nonEmpty && v.length === 0) return `${field} must name at least one`;
  const names: string[] = [];
  for (const [i, x] of v.entries()) {
    if (typeof x !== 'string') return `${field}[${i}] is not a string (${JSON.stringify(x)})`;
    if (x.trim() === '') return `${field}[${i}] is blank`;
    if (opts.distinct && names.includes(x)) return `${field} lists "${x}" twice`;
    names.push(x);
  }
  return { names };
}

/**
 * Sources by grade (docs/schema.md § Admission controls): at least one
 * source; grade 1 needs a court filing or official report, or an admission;
 * grade 2 a disclosure, court filing, official report or congressional
 * record; grade 3 an investigation; grade 4 two sources from distinct outlets.
 */
function sourceRuleProblem(grade: EvidenceGrade, sources: Source[], response: unknown): string | null {
  if (sources.length === 0) return 'has no sources; every public record needs at least one, with an archive_url';
  const kinds = new Set(sources.map((s) => s.kind));
  const has = (...k: string[]) => k.some((x) => kinds.has(x as Source['kind']));
  switch (grade) {
    case 1:
      return has('court-filing', 'official-report') || response === 'admitted'
        ? null : 'grade 1 needs a source of kind court-filing or official-report, or subject_response "admitted"';
    case 2:
      return has('disclosure', 'court-filing', 'official-report', 'congressional')
        ? null : 'grade 2 needs a source of kind disclosure, court-filing, official-report or congressional';
    case 3:
      return has('investigation') ? null : 'grade 3 needs a source of kind investigation';
    case 4: {
      const outlets = new Set(sources.map((s) => s.outlet.trim().toLowerCase()));
      return outlets.size >= 2 ? null : 'grade 4 needs at least two sources from distinct outlets';
    }
    default:
      return null;
  }
}

/**
 * Record ids become URL path segments (/r/<id>/) and directory names in
 * dist/, so they are restricted: lowercase letters, digits and hyphens,
 * starting with a letter or digit, 3 to 121 characters. No "..", no spaces,
 * no case collisions.
 */
export const ID_RE = /^[a-z0-9][a-z0-9-]{2,120}$/;

/** Source and archive links must be absolute http(s) URLs. */
export function isHttpUrl(v: string): boolean {
  try {
    const u = new URL(v);
    return (u.protocol === 'http:' || u.protocol === 'https:') && u.hostname !== '';
  } catch {
    return false;
  }
}
const TS_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/;

/** ms since epoch for a strict ISO 8601 timestamp with a zone, or null. */
export function parseTimestamp(v: unknown): number | null {
  if (!isStr(v) || !TS_RE.test(v)) return null;
  const ms = Date.parse(v);
  return Number.isFinite(ms) ? ms : null;
}

/** A v1 record has `status` / `dollar_amount_usd` and none of the v2 grading fields. */
function looksLikeV1(o: Record<string, unknown>): boolean {
  return !('evidence_grade' in o) && ('status' in o || 'dollar_amount_usd' in o);
}

export const V1_REASON =
  'schema v1 record (it has "status" or "dollar_amount_usd" and no "evidence_grade"); migrate it to schema v2 per docs/schema.md';

function toSource(v: unknown, i: number): Source | Rejection | string {
  if (!v || typeof v !== 'object') return `source ${i + 1} is not an object`;
  const o = v as Record<string, unknown>;
  if (!nonEmpty(o.outlet)) return `source ${i + 1} has no outlet`;
  if (!nonEmpty(o.url)) return `source ${i + 1} has no url`;
  if (!isHttpUrl(o.url)) return { code: 'url', reason: `source ${i + 1} url "${o.url}" is not an http(s) URL` };
  if (!nonEmpty(o.archive_url)) return `source ${i + 1} has no archive_url (required for publication)`;
  if (!isHttpUrl(o.archive_url)) return { code: 'url', reason: `source ${i + 1} archive_url "${o.archive_url}" is not an http(s) URL` };
  if (!oneOf(SOURCE_KINDS, o.kind)) return `source ${i + 1} has unknown kind "${String(o.kind)}"`;
  if (o.date !== undefined && o.date !== '' && !(isStr(o.date) && DAY_RE.test(o.date) && parseDay(o.date) !== null)) {
    return `source ${i + 1} has unparseable date "${String(o.date)}"`;
  }
  return {
    outlet: o.outlet,
    title: isStr(o.title) ? o.title : '',
    url: o.url,
    archive_url: o.archive_url,
    date: isStr(o.date) ? o.date : '',
    author: isStr(o.author) ? o.author : '',
    kind: o.kind,
  };
}

function toAmount(v: unknown, i: number): Amount | string {
  if (!v || typeof v !== 'object') return `amount ${i + 1} is not an object`;
  const o = v as Record<string, unknown>;
  if (typeof o.usd !== 'number' || !Number.isFinite(o.usd) || o.usd <= 0) return `amount ${i + 1} has no positive usd figure`;
  if (!oneOf(AMOUNT_TYPES, o.amount_type)) return `amount ${i + 1} has unknown amount_type "${String(o.amount_type)}"`;
  if (!oneOf(ACTUAL_OR_ESTIMATED, o.actual_or_estimated)) return `amount ${i + 1} has unknown actual_or_estimated "${String(o.actual_or_estimated)}"`;
  if (!nonEmpty(o.basis)) return `amount ${i + 1} has no basis`;
  return {
    usd: o.usd,
    amount_type: o.amount_type,
    actual_or_estimated: o.actual_or_estimated,
    basis: o.basis,
    overlap_group: strOrNull(o.overlap_group),
  };
}

export interface Rejection {
  code: SkipCode;
  reason: string;
}

/**
 * How approval is judged. `verify` (the build, the approve tool, the dev
 * server): approved only when approved_by is the configured editor and
 * approved_digest matches the record's content. `trust` (production pages):
 * the public file holds only records the build verified, and its related_ids
 * are already filtered, so the browser does not recompute digests.
 */
export type ApprovalMode = 'verify' | 'trust';

/**
 * Validate one raw record against schema v2; return an Item or why it was
 * left out. Cross-record checks (root_id resolution, duplicate ids) happen in
 * `interpret`. A record with no approved_by is a draft, "unapproved" however
 * incomplete it is; a record that claims approval is validated in full, then
 * its approval is checked against its content.
 */
export function toItem(raw: unknown, nowMs: number = Date.now(), mode: ApprovalMode = 'verify'): Item | Rejection {
  const pre = preflight(raw);
  if ('code' in pre) return pre;
  const o = pre.o;
  if (o.approved_by === null || o.approved_by === undefined) {
    return { code: 'unapproved', reason: 'approved_by is null, so the record is not in the public dataset' };
  }
  const res = validate(o, o.id as string, nowMs);
  if (typeof res === 'string') return { code: 'invalid', reason: res };
  if ('code' in res || mode === 'trust') return res;
  if (res.approved_by !== EDITOR_NAME) {
    return { code: 'approval', reason: `approved_by "${String(o.approved_by)}" is not the configured editor (app/editor.json)` };
  }
  const digest = recordDigest(res);
  if (o.approved_digest !== digest) {
    return {
      code: 'approval',
      reason: o.approved_digest
        ? `approved_digest does not match the record's content (edited after approval); re-approve with npm run approve -- ${res.id}`
        : `approved_by is set but approved_digest is missing; approve with npm run approve -- ${res.id}`,
    };
  }
  return res;
}

/** The checks every record gets first, approved or not. */
function preflight(raw: unknown): { o: Record<string, unknown> } | Rejection {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { code: 'invalid', reason: 'not an object' };
  const o = raw as Record<string, unknown>;
  if (!nonEmpty(o.id)) return { code: 'invalid', reason: 'missing id' };
  if (!ID_RE.test(o.id)) return { code: 'id', reason: `id "${o.id}" must match ${String(ID_RE)} (lowercase letters, digits, hyphens)` };
  if (looksLikeV1(o)) return { code: 'v1', reason: V1_REASON };
  return { o };
}

/**
 * For the approve tool: validate a record in full whatever its approval
 * fields say, so its digest can be computed. An invalid record cannot be
 * approved.
 */
export function validateForApproval(raw: unknown, nowMs: number = Date.now()): Item | Rejection {
  const pre = preflight(raw);
  if ('code' in pre) return pre;
  const res = validate(pre.o, pre.o.id as string, nowMs);
  return typeof res === 'string' ? { code: 'invalid', reason: res } : res;
}

function validate(o: Record<string, unknown>, id: string, nowMs: number): Item | Rejection | string {
  if (!nonEmpty(o.title)) return 'missing title';
  if (o.root_id !== null && !nonEmpty(o.root_id)) return 'root_id must be null (a root record) or the id of a root record';
  if (o.root_id === id) return 'root_id names the record itself';

  if (!isStr(o.date) || !DAY_RE.test(o.date)) return `date "${String(o.date)}" is not YYYY-MM-DD`;
  const day = parseDay(o.date);
  if (day === null) return `unparseable date "${o.date}"`;
  // Date floor: first-term conduct is represented only by its 2025+ development.
  if (day < DATE_FLOOR_DAY) return `date ${o.date} is before ${DATE_FLOOR}; first-term conduct is represented only by its 2025+ development`;
  if (o.date_precision !== 'day' && o.date_precision !== 'month') return `unknown date_precision "${String(o.date_precision)}"`;
  if (o.date_precision === 'month' && !o.date.endsWith('-01')) return 'month-precision dates must use the 1st of the month';

  if (!oneOf(CATEGORIES, o.category)) return `unknown category "${String(o.category)}"`;
  if (!oneOf(RUBRIC_PRONGS, o.rubric_prong)) return `unknown rubric_prong "${String(o.rubric_prong)}"`;
  if (!nonEmpty(o.rubric_evidence)) return 'missing rubric_evidence';
  if (!oneOf(EVIDENCE_GRADES, o.evidence_grade)) return `evidence_grade must be an integer 1 to 5, got "${String(o.evidence_grade)}"`;
  if (!nonEmpty(o.evidence_note)) return 'missing evidence_note';
  if (!oneOf(EVIDENTIARY_STATUSES, o.evidentiary_status)) return `unknown evidentiary_status "${String(o.evidentiary_status)}"`;
  if (!oneOf(PROCEDURAL_STATUSES, o.procedural_status)) return `unknown procedural_status "${String(o.procedural_status)}"`;
  if (o.subject_response !== null && !oneOf(SUBJECT_RESPONSES, o.subject_response)) {
    return `unknown subject_response "${String(o.subject_response)}"`;
  }

  // Actors: a non-empty array of distinct, non-blank names. Never coerced.
  const actorsRes = nameList(o.actors, 'actors', { nonEmpty: true, distinct: true });
  if (typeof actorsRes === 'string') return actorsRes;
  const actors = actorsRes.names;
  const entitiesRes = nameList(o.entities, 'entities', {});
  if (typeof entitiesRes === 'string') return entitiesRes;
  const officesRes = nameList(o.offices, 'offices', {});
  if (typeof officesRes === 'string') return officesRes;
  const rolesRaw = o.actor_roles && typeof o.actor_roles === 'object' && !Array.isArray(o.actor_roles)
    ? (o.actor_roles as Record<string, unknown>)
    : null;
  if (!rolesRaw) return 'missing actor_roles';
  const actorRoles: Record<string, ActorRole> = {};
  for (const a of actors) {
    const r = rolesRaw[a];
    if (!oneOf(ACTOR_ROLES, r)) return `actor "${a}" has no valid role in actor_roles`;
    actorRoles[a] = r;
  }
  const grade = o.evidence_grade as EvidenceGrade;
  // Inclusion rubric: records naming only private persons or entities need
  // grade 3 or better and a recorded response (sought and received, or declined).
  if (actors.length > 0 && actors.every((a) => PRIVATE_ROLES.includes(actorRoles[a] as ActorRole))) {
    if (grade > PRIVATE_MAX_GRADE) {
      return { code: 'rubric', reason: `names only private actors, so it needs evidence grade ${PRIVATE_MAX_GRADE} or better` };
    }
    if ((PRIVATE_DISALLOWED_RESPONSES as readonly unknown[]).includes(o.subject_response)) {
      return { code: 'rubric', reason: 'names only private actors, so it needs a subject_response other than "not-sought" or null' };
    }
  }

  if (!Array.isArray(o.amounts)) return 'missing amounts (use [] when there is no figure)';
  const amounts: Amount[] = [];
  for (const [i, a] of o.amounts.entries()) {
    const res = toAmount(a, i);
    if (typeof res === 'string') return res;
    amounts.push(res);
  }
  if (!Array.isArray(o.sources)) return 'missing sources';
  const sources: Source[] = [];
  for (const [i, s] of o.sources.entries()) {
    const res = toSource(s, i);
    if (typeof res === 'string' || 'code' in res) return res;
    sources.push(res);
  }
  const sourcesProblem = sourceRuleProblem(grade, sources, o.subject_response);
  if (sourcesProblem) return sourcesProblem;
  const lint = summaryProblem(isStr(o.summary) ? o.summary : '', grade);
  if (lint) return lint;

  // Null while unpublished; a future time means scheduled. Neither counts yet.
  const publishedMs = o.first_published_at === null ? null : parseTimestamp(o.first_published_at);
  if (o.first_published_at !== null && publishedMs === null) {
    return `first_published_at "${String(o.first_published_at)}" is not an ISO 8601 timestamp or null`;
  }
  let modifiedMs: number | null = null;
  if (o.last_modified_at !== null) {
    modifiedMs = parseTimestamp(o.last_modified_at);
    if (modifiedMs === null) return `last_modified_at "${String(o.last_modified_at)}" is not an ISO 8601 timestamp or null`;
  }
  if (parseTimestamp(o.last_verified_at) === null) return `last_verified_at "${String(o.last_verified_at)}" is not an ISO 8601 timestamp`;

  const entry: Entry = {
    id,
    root_id: o.root_id as string | null,
    date: o.date,
    date_precision: o.date_precision,
    title: o.title,
    summary: isStr(o.summary) ? o.summary : '',
    category: o.category,
    rubric_prong: o.rubric_prong,
    rubric_evidence: o.rubric_evidence,
    actors,
    actor_roles: actorRoles,
    entities: entitiesRes.names,
    offices: officesRes.names,
    evidence_grade: grade,
    evidence_note: o.evidence_note,
    evidentiary_status: o.evidentiary_status,
    procedural_status: o.procedural_status,
    subject_response: o.subject_response as Entry['subject_response'],
    status_note: strOrNull(o.status_note),
    amounts,
    sources,
    first_published_at: (o.first_published_at as string | null) ?? null,
    last_modified_at: (o.last_modified_at as string | null) ?? null,
    last_verified_at: o.last_verified_at as string,
    approved_by: strOrNull(o.approved_by),
    approved_digest: strOrNull(o.approved_digest),
    related_ids: strList(o.related_ids),
    tags: strList(o.tags),
    placeholder: o.placeholder === true ? true : undefined,
  };
  const usd = amounts.map((a) => a.usd);
  return {
    ...entry,
    day,
    month: monthKey(day),
    isRoot: entry.root_id === null,
    treeId: entry.root_id ?? entry.id,
    qualifying: isQualifying(entry, publishedMs, nowMs),
    maxUsd: usd.length ? Math.max(...usd) : null,
    publishedMs,
    modifiedMs,
    haystack: [
      entry.title, entry.summary, ...entry.actors, ...entry.entities, ...entry.offices,
      ...entry.sources.map((s) => s.outlet),
    ].join('\n').toLowerCase(),
  };
}

/**
 * Turn the parsed JSON body into a LoadState. Exported for reuse (the
 * prerender uses it); pure given `nowMs`, the moment against which
 * "published, not in the future" is judged.
 */
export function interpret(body: unknown, nowMs: number = Date.now(), mode: ApprovalMode = 'verify'): LoadState {
  if (!Array.isArray(body)) {
    return { kind: 'invalid', detail: 'The file parsed as JSON but is not an array of entries.' };
  }
  if (body.length === 0) return { kind: 'empty' };
  const candidates: Array<{ index: number; item: Item }> = [];
  const skipped: SkippedEntry[] = [];
  const idOf = (raw: unknown) => (raw && typeof raw === 'object' && isStr((raw as Record<string, unknown>).id)
    ? ((raw as Record<string, unknown>).id as string)
    : null);

  // Duplicate ids first, over the raw file, before approval or any other
  // check: a draft and an approved record sharing an id must never let one
  // stand in for the other. Every copy is rejected, naming the others.
  const indicesById = new Map<string, number[]>();
  body.forEach((raw, index) => {
    const id = idOf(raw);
    if (id !== null) indicesById.set(id, [...(indicesById.get(id) ?? []), index]);
  });
  body.forEach((raw, index) => {
    const id = idOf(raw);
    const all = id !== null ? indicesById.get(id) ?? [] : [];
    if (id !== null && all.length > 1) {
      skipped.push({ index, id, code: 'duplicate', reason: `duplicate id "${id}" at records #${all.join(' and #')}` });
      return;
    }
    const res = toItem(raw, nowMs, mode);
    if ('code' in res) skipped.push({ index, id: idOf(raw), code: res.code, reason: res.reason });
    else candidates.push({ index, item: res });
  });

  // A child must name a root that loaded; children of children are not allowed.
  const roots = new Set(candidates.filter((c) => c.item.isRoot).map((c) => c.item.id));
  const items: Item[] = [];
  for (const c of candidates) {
    if (!c.item.isRoot && !roots.has(c.item.root_id as string)) {
      skipped.push({ index: c.index, id: c.item.id, code: 'orphan', reason: `root_id "${c.item.root_id}" does not name a root record in this file` });
    } else {
      items.push(c.item);
    }
  }
  skipped.sort((a, b) => a.index - b.index);

  if (items.length === 0) {
    if (skipped.length > 0 && skipped.every((s) => s.code === 'v1')) {
      return {
        kind: 'invalid',
        detail: 'Every record in the file uses dataset schema v1 (a single "status" and "dollar_amount_usd"). '
          + 'This version of the app reads schema v2 only: migrate the file per docs/schema.md.',
      };
    }
    return {
      kind: 'invalid',
      detail: body.length === 1
        ? `The only record failed validation (${skipped[0]?.reason ?? 'unknown reason'}), so nothing can be shown.`
        : `All ${body.length} records failed validation; none can be shown. First reason: ${skipped[0]?.reason ?? 'unknown'}.`,
    };
  }
  // Reverse-chronological by event date; ties broken by id so the order is stable.
  items.sort((a, b) => b.day - a.day || a.id.localeCompare(b.id));
  return { kind: 'ready', items, skipped };
}

export async function loadEntries(url = DATA_URL): Promise<LoadState> {
  let res: Response;
  try {
    res = await fetch(url, { cache: 'no-cache' });
  } catch (err) {
    return { kind: 'missing', httpStatus: null, detail: `The request failed before a response arrived (${String(err)}).` };
  }
  if (!res.ok) {
    return { kind: 'missing', httpStatus: res.status, detail: `The server answered HTTP ${res.status}.` };
  }
  const text = await res.text();
  if (text.trim() === '') return { kind: 'empty' };
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch (err) {
    // Vite's dev server answers unknown paths with index.html (HTTP 200), so a
    // missing file can surface here as HTML rather than as a 404.
    if (/^\s*</.test(text)) {
      return { kind: 'missing', httpStatus: res.status, detail: 'The server returned an HTML page instead of JSON, which usually means the file does not exist.' };
    }
    return { kind: 'invalid', detail: `The file is not valid JSON (${(err as Error).message}).` };
  }
  // Development reads the raw dataset and verifies approvals; production reads
  // the build's public file, every record of which the build verified.
  return interpret(body, Date.now(), import.meta.env.DEV ? 'verify' : 'trust');
}

const isJson = (v: unknown): v is JsonValue => v === null || ['string', 'number', 'boolean', 'object'].includes(typeof v);

export interface CorrectionProblem {
  index: number;
  reason: string;
  raw: unknown;
}

const TOP_FIELDS = [
  'id', 'root_id', 'date', 'date_precision', 'title', 'summary', 'category', 'rubric_prong', 'rubric_evidence',
  'actors', 'actor_roles', 'entities', 'offices', 'evidence_grade', 'evidence_note', 'evidentiary_status',
  'procedural_status', 'subject_response', 'status_note', 'amounts', 'sources', 'first_published_at',
  'last_modified_at', 'last_verified_at', 'related_ids', 'tags',
];
const AMOUNT_FIELDS = ['usd', 'amount_type', 'actual_or_estimated', 'basis', 'overlap_group'];
const SOURCE_FIELDS = ['outlet', 'title', 'url', 'archive_url', 'date', 'author', 'kind'];

/**
 * The paths a correction's `field` may name: a schema field ("summary"), an
 * element of a list ("actors[0]", "amounts[1]"), a field of an amount or source
 * ("amounts[0].usd", "sources[2].archive_url"), or one actor's role
 * ("actor_roles.<name>"). Nothing else: no free text, no invented fields.
 */
export const CORRECTION_FIELD_RE = new RegExp(
  `^(?:(?:${TOP_FIELDS.join('|')})`
  + `|(?:actors|entities|offices|tags|related_ids|amounts|sources)\\[\\d+\\]`
  + `|amounts\\[\\d+\\]\\.(?:${AMOUNT_FIELDS.join('|')})`
  + `|sources\\[\\d+\\]\\.(?:${SOURCE_FIELDS.join('|')})`
  + `|actor_roles\\.[^.\\[\\]]+)$`,
);

/** Why a raw correction is malformed, or null when its shape and field path are valid. Approval is separate. */
export function correctionProblem(raw: unknown): string | null {
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
  if (!o) return 'not an object';
  if (!isStr(o.date) || !DAY_RE.test(o.date) || parseDay(o.date) === null) return 'date is not YYYY-MM-DD';
  if (!nonEmpty(o.record_id)) return 'missing record_id';
  if (!nonEmpty(o.field)) return 'missing field';
  if (!CORRECTION_FIELD_RE.test(o.field)) return `field "${o.field}" is not a schema path (e.g. "summary", "amounts[0].usd", "sources[1].title")`;
  if (!nonEmpty(o.reason)) return 'missing reason';
  if (!('old_value' in o) || !isJson(o.old_value)) return 'missing old_value';
  if (!('new_value' in o) || !isJson(o.new_value)) return 'missing new_value';
  return null;
}

export interface CheckedCorrections {
  /** Approved corrections, newest first. */
  corrections: Correction[];
  /** Drafts (approved_by null): never published. */
  drafts: Array<{ index: number; raw: unknown }>;
  /** Malformed entries and failed approvals: the build fails on any. */
  problems: CorrectionProblem[];
}

/**
 * Validate the corrections log. Each entry needs a valid shape and field path;
 * one with approved_by null is a draft; one that claims approval must name
 * the configured editor and carry the matching digest (in `verify` mode).
 */
export function checkCorrections(body: unknown, mode: ApprovalMode = 'verify'): CheckedCorrections | null {
  if (!Array.isArray(body)) return null;
  const out: CheckedCorrections = { corrections: [], drafts: [], problems: [] };
  body.forEach((raw, index) => {
    const why = correctionProblem(raw);
    if (why) { out.problems.push({ index, reason: why, raw }); return; }
    const o = raw as Record<string, unknown>;
    if (o.approved_by === null || o.approved_by === undefined) { out.drafts.push({ index, raw }); return; }
    const c: Correction = {
      date: o.date as string,
      record_id: o.record_id as string,
      field: o.field as string,
      old_value: o.old_value as JsonValue,
      new_value: o.new_value as JsonValue,
      reason: o.reason as string,
      approved_by: strOrNull(o.approved_by),
      approved_digest: strOrNull(o.approved_digest),
      placeholder: o.placeholder === true ? true : undefined,
    };
    if (mode === 'verify') {
      if (c.approved_by !== EDITOR_NAME) {
        out.problems.push({ index, reason: `approved_by "${String(o.approved_by)}" is not the configured editor (app/editor.json)`, raw });
        return;
      }
      if (c.approved_digest !== correctionDigest(c)) {
        out.problems.push({ index, reason: `approved_digest does not match the correction's content; re-approve with npm run approve -- --correction ${index}`, raw });
        return;
      }
    }
    out.corrections.push(c);
  });
  // Newest first; stable by record id then field.
  out.corrections.sort((a, b) => b.date.localeCompare(a.date) || a.record_id.localeCompare(b.record_id) || a.field.localeCompare(b.field));
  return out;
}

/** The app's view of the corrections log. */
export function interpretCorrections(body: unknown, mode: ApprovalMode = 'verify'): CorrectionsState {
  const res = checkCorrections(body, mode);
  if (!res) return { kind: 'unavailable', detail: 'The corrections file is not an array.' };
  return { kind: 'ready', corrections: res.corrections, skipped: res.problems.length };
}

export async function loadCorrections(url = CORRECTIONS_URL): Promise<CorrectionsState> {
  try {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) return { kind: 'unavailable', detail: `The server answered HTTP ${res.status}.` };
    return interpretCorrections(JSON.parse(await res.text()), import.meta.env.DEV ? 'verify' : 'trust');
  } catch (err) {
    return { kind: 'unavailable', detail: `The corrections log could not be read (${(err as Error).message}).` };
  }
}
