/**
 * The editor's review queue: pure logic, development only. The dev-server
 * middleware (scripts/review-middleware.mjs) loads this through Vite's SSR
 * loader and does the file I/O; nothing here is imported by the app, so none
 * of it reaches dist/ (scripts/verify.mjs checks).
 *
 * Every predicate is the build's own: validation is validateForApproval (the
 * loader), the language lint is summaryProblem, and approval is
 * approveRecordById, the same function `npm run approve` calls.
 */
import { EVIDENCE_GRADES, type EvidenceGrade } from '../types';
import { validateForApproval } from '../data/load';
import { summaryProblem } from '../data/lint';
import { EDITOR_NAME } from '../data/approval';
import { approveRecordById, withoutApproval } from '../data/approve-core';

export { approveRecordById };

type Raw = Record<string, unknown>;

export interface RejectionEntry {
  id: string;
  reason: string;
  /** ISO 8601 timestamp of the decision. */
  at: string;
}

export interface RecordState {
  index: number;
  id: string;
  /** The raw record as it stands in the dataset file. */
  record: Raw;
  approved: boolean;
  /** Validation failures from the build's own validator (empty when it would pass). */
  errors: string[];
  /** The language lint's finding on the summary, or null. */
  lint: string | null;
  /** The latest rejection, while the record stays unapproved. */
  rejected: { reason: string; at: string } | null;
}

export interface QueueView {
  editor: string;
  /** Unapproved records, in file order. */
  records: RecordState[];
  progress: { approved: number; rejected: number; remaining: number; total: number };
}

const isRaw = (v: unknown): v is Raw => !!v && typeof v === 'object' && !Array.isArray(v);
const idOf = (r: unknown) => (isRaw(r) && typeof r.id === 'string' ? r.id : '');
const isApproved = (r: unknown) => isRaw(r) && r.approved_by !== null && r.approved_by !== undefined;

function lastRejection(rejections: readonly RejectionEntry[], id: string) {
  for (let i = rejections.length - 1; i >= 0; i--) {
    const r = rejections[i];
    if (r && r.id === id) return { reason: r.reason, at: r.at };
  }
  return null;
}

/** One record's state: validation and lint by the build's own rules. */
export function stateAt(entries: readonly unknown[], rejections: readonly RejectionEntry[], index: number): RecordState {
  const raw = entries[index];
  const record = isRaw(raw) ? raw : {};
  const v = validateForApproval(raw);
  const grade = record.evidence_grade;
  const lint = typeof record.summary === 'string' && (EVIDENCE_GRADES as readonly unknown[]).includes(grade)
    ? summaryProblem(record.summary, grade as EvidenceGrade)
    : null;
  // The validator stops at its first failure, which may be the lint itself;
  // show that once, under the lint.
  const errors = 'code' in v && v.reason !== lint ? [v.reason] : [];
  const approved = isApproved(raw);
  return {
    index,
    id: idOf(raw),
    record,
    approved,
    errors,
    lint,
    rejected: approved ? null : lastRejection(rejections, idOf(raw)),
  };
}

export function stateById(entries: readonly unknown[], rejections: readonly RejectionEntry[], id: string): RecordState | null {
  const i = entries.findIndex((r) => idOf(r) === id);
  return i < 0 ? null : stateAt(entries, rejections, i);
}

/** The queue: every unapproved record with its state, and the progress line. */
export function queueView(entries: readonly unknown[], rejections: readonly RejectionEntry[]): QueueView {
  const records: RecordState[] = [];
  let approved = 0;
  entries.forEach((r, i) => {
    if (isApproved(r)) approved += 1;
    else records.push(stateAt(entries, rejections, i));
  });
  const rejected = records.filter((r) => r.rejected).length;
  return {
    editor: EDITOR_NAME,
    records,
    progress: { approved, rejected, remaining: records.length - rejected, total: entries.length },
  };
}

export type WriteResult = { ok: true } | { ok: false; status: number; error: string };

/** Reject: clear any approval and log {id, reason, at}. The reason is required. */
export function rejectById(entries: unknown[], rejections: RejectionEntry[], id: string, reason: unknown, at: string): WriteResult {
  if (typeof reason !== 'string' || reason.trim() === '') return { ok: false, status: 400, error: 'a rejection needs a reason' };
  const i = entries.findIndex((r) => idOf(r) === id);
  if (i < 0) return { ok: false, status: 404, error: `no record has id "${id}"` };
  entries[i] = withoutApproval(entries[i] as Raw);
  rejections.push({ id, reason: reason.trim(), at });
  return { ok: true };
}

/** The fields edit mode may change. Everything else (id, tree links, publication and approval fields) is not editable here. */
export const EDITABLE_FIELDS = [
  'title', 'summary', 'date', 'date_precision', 'category', 'rubric_prong', 'rubric_evidence',
  'actors', 'actor_roles', 'entities', 'offices', 'evidence_grade', 'evidence_note',
  'evidentiary_status', 'procedural_status', 'subject_response', 'status_note', 'amounts', 'sources',
] as const;

/**
 * Edit: apply a patch of editable fields, clear the approval (an edited record
 * is never approved), and leave validation to the caller's re-read. The save
 * succeeds even when the record is still invalid; it simply cannot be approved.
 */
export function editById(entries: unknown[], id: string, patch: unknown): WriteResult {
  if (!isRaw(patch)) return { ok: false, status: 400, error: 'patch must be an object of field values' };
  const bad = Object.keys(patch).filter((k) => !(EDITABLE_FIELDS as readonly string[]).includes(k));
  if (bad.length) return { ok: false, status: 400, error: `not editable here: ${bad.join(', ')}` };
  const i = entries.findIndex((r) => idOf(r) === id);
  if (i < 0) return { ok: false, status: 404, error: `no record has id "${id}"` };
  const next: Raw = { ...(entries[i] as Raw) };
  for (const [k, v] of Object.entries(patch)) next[k] = v;
  entries[i] = withoutApproval(next);
  return { ok: true };
}

/** "https://web.archive.org/web/<ts>/<url>" from the Wayback Machine's final URL after /save/, or null. */
export function archiveUrlFrom(finalUrl: string, url: string): string | null {
  const m = /\/web\/(\d{14})(?:[a-z_]*)\//.exec(finalUrl);
  return m ? `https://web.archive.org/web/${m[1]}/${url}` : null;
}

/**
 * Fill archive_url on every source with this url and no archive_url, in
 * unapproved records only (an approved record is never edited in place).
 * Returns the ids touched.
 */
export function fillArchive(entries: unknown[], url: string, archiveUrl: string): string[] {
  const touched: string[] = [];
  entries.forEach((r, i) => {
    if (!isRaw(r) || isApproved(r) || !Array.isArray(r.sources)) return;
    let hit = false;
    const sources = r.sources.map((s) => {
      if (isRaw(s) && s.url === url && (typeof s.archive_url !== 'string' || s.archive_url.trim() === '')) {
        hit = true;
        return { ...s, archive_url: archiveUrl };
      }
      return s;
    });
    if (hit) {
      entries[i] = { ...r, sources };
      touched.push(idOf(r));
    }
  });
  return touched;
}
