import {
  ACTOR_ROLES, ACTUAL_OR_ESTIMATED, AMOUNT_TYPES, CATEGORIES, EVIDENCE_GRADES, EVIDENTIARY_STATUSES,
  PROCEDURAL_STATUSES, RUBRIC_PRONGS, SOURCE_KINDS, SUBJECT_RESPONSES,
  type ActorRole, type Amount, type Correction, type CorrectionsState, type Entry, type EvidenceGrade,
  type Item, type JsonValue, type LoadState, type SkipCode, type SkippedEntry, type Source,
} from '../types';
import { monthKey, parseDay } from './dates';
import { isQualifying } from './metrics';
import { PRIVATE_DISALLOWED_RESPONSES, PRIVATE_MAX_GRADE, PRIVATE_ROLES } from '../method';

export const DATA_URL = `${import.meta.env.BASE_URL}data/entries.json`;
export const CORRECTIONS_URL = `${import.meta.env.BASE_URL}data/corrections.json`;

const isStr = (v: unknown): v is string => typeof v === 'string';
const nonEmpty = (v: unknown): v is string => isStr(v) && v.trim() !== '';
const strOrNull = (v: unknown): string | null => (nonEmpty(v) ? v : null);
const strList = (v: unknown): string[] => (Array.isArray(v) ? v.filter(isStr) : []);
const oneOf = <T extends string | number>(list: readonly T[], v: unknown): v is T => (list as readonly unknown[]).includes(v);

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

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
 * Validate one raw record against schema v2; return an Item or why it was
 * left out. Cross-record checks (root_id resolution, duplicate ids) happen in
 * `interpret`. Approval is checked first: a draft is "unapproved" however
 * incomplete it is.
 */
export function toItem(raw: unknown, nowMs: number = Date.now()): Item | Rejection {
  const bad = (reason: string): Rejection => ({ code: 'invalid', reason });
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return bad('not an object');
  const o = raw as Record<string, unknown>;
  if (!nonEmpty(o.id)) return bad('missing id');
  if (!ID_RE.test(o.id)) return { code: 'id', reason: `id "${o.id}" must match ${String(ID_RE)} (lowercase letters, digits, hyphens)` };
  if (looksLikeV1(o)) return { code: 'v1', reason: V1_REASON };
  if (!nonEmpty(o.approved_by)) return { code: 'unapproved', reason: 'approved_by is null, so the record is not in the public dataset' };
  const res = validate(o, o.id, nowMs);
  return typeof res === 'string' ? bad(res) : res;
}

function validate(o: Record<string, unknown>, id: string, nowMs: number): Item | Rejection | string {
  if (!nonEmpty(o.title)) return 'missing title';
  if (o.root_id !== null && !nonEmpty(o.root_id)) return 'root_id must be null (a root record) or the id of a root record';
  if (o.root_id === id) return 'root_id names the record itself';

  if (!isStr(o.date) || !DAY_RE.test(o.date)) return `date "${String(o.date)}" is not YYYY-MM-DD`;
  const day = parseDay(o.date);
  if (day === null) return `unparseable date "${o.date}"`;
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

  const actors = strList(o.actors);
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
    entities: strList(o.entities),
    offices: strList(o.offices),
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
    approved_by: o.approved_by as string,
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
export function interpret(body: unknown, nowMs: number = Date.now()): LoadState {
  if (!Array.isArray(body)) {
    return { kind: 'invalid', detail: 'The file parsed as JSON but is not an array of entries.' };
  }
  if (body.length === 0) return { kind: 'empty' };
  const candidates: Array<{ index: number; item: Item }> = [];
  const skipped: SkippedEntry[] = [];
  const seen = new Set<string>();
  const idOf = (raw: unknown) => (raw && typeof raw === 'object' && isStr((raw as Record<string, unknown>).id)
    ? ((raw as Record<string, unknown>).id as string)
    : null);
  body.forEach((raw, index) => {
    const res = toItem(raw, nowMs);
    if ('code' in res) {
      skipped.push({ index, id: idOf(raw), code: res.code, reason: res.reason });
    } else if (seen.has(res.id)) {
      skipped.push({ index, id: res.id, code: 'duplicate', reason: 'duplicate id' });
    } else {
      seen.add(res.id);
      candidates.push({ index, item: res });
    }
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
  return interpret(body);
}

const isJson = (v: unknown): v is JsonValue => v === null || ['string', 'number', 'boolean', 'object'].includes(typeof v);

export interface CorrectionProblem {
  index: number;
  reason: string;
  raw: unknown;
}

/**
 * Validate the corrections log: an array of {date, record_id, field,
 * old_value, new_value, reason}. Returns the good entries (newest first) and
 * every malformed one with the reason. The build fails on any problem; the app
 * shows only the good entries.
 */
export function checkCorrections(body: unknown): { corrections: Correction[]; problems: CorrectionProblem[] } | null {
  if (!Array.isArray(body)) return null;
  const corrections: Correction[] = [];
  const problems: CorrectionProblem[] = [];
  body.forEach((raw, index) => {
    const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
    const reason = !o ? 'not an object'
      : !isStr(o.date) || !DAY_RE.test(o.date) || parseDay(o.date) === null ? 'date is not YYYY-MM-DD'
      : !nonEmpty(o.record_id) ? 'missing record_id'
      : !nonEmpty(o.field) ? 'missing field'
      : !nonEmpty(o.reason) ? 'missing reason'
      : !('old_value' in o) || !isJson(o.old_value) ? 'missing old_value'
      : !('new_value' in o) || !isJson(o.new_value) ? 'missing new_value'
      : null;
    if (reason || !o) {
      problems.push({ index, reason: reason ?? 'not an object', raw });
      return;
    }
    corrections.push({
      date: o.date as string,
      record_id: o.record_id as string,
      field: o.field as string,
      old_value: o.old_value as JsonValue,
      new_value: o.new_value as JsonValue,
      reason: o.reason as string,
      placeholder: o.placeholder === true ? true : undefined,
    });
  });
  // Newest first; stable by record id then field.
  corrections.sort((a, b) => b.date.localeCompare(a.date) || a.record_id.localeCompare(b.record_id) || a.field.localeCompare(b.field));
  return { corrections, problems };
}

/** The app's view of the corrections log. */
export function interpretCorrections(body: unknown): CorrectionsState {
  const res = checkCorrections(body);
  if (!res) return { kind: 'unavailable', detail: 'The corrections file is not an array.' };
  return { kind: 'ready', corrections: res.corrections, skipped: res.problems.length };
}

export async function loadCorrections(url = CORRECTIONS_URL): Promise<CorrectionsState> {
  try {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) return { kind: 'unavailable', detail: `The server answered HTTP ${res.status}.` };
    return interpretCorrections(JSON.parse(await res.text()));
  } catch (err) {
    return { kind: 'unavailable', detail: `The corrections log could not be read (${(err as Error).message}).` };
  }
}
