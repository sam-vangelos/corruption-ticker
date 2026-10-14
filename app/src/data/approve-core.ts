/**
 * The one approval code path. `npm run approve` (scripts/approve.mjs, via the
 * compiled site module) and the editor's review queue (the dev-server
 * middleware, via Vite's SSR loader) both approve through these functions, so
 * the build's admission gate is the only gate and nothing approves twice.
 */
import { EDITOR_NAME, correctionDigest, recordDigest } from './approval';
import { correctionProblem, validateForApproval } from './load';

type Raw = Record<string, unknown>;

/** A copy of `obj` with approved_by and approved_digest set, placed where approved_by sits (or at the end). */
export function withApproval(obj: Raw, editor: string, digest: string): Raw {
  const out: Raw = {};
  let placed = false;
  for (const [k, v] of Object.entries(obj)) {
    if (k === 'approved_digest') continue;
    if (k === 'approved_by') {
      out.approved_by = editor;
      out.approved_digest = digest;
      placed = true;
    } else {
      out[k] = v;
    }
  }
  if (!placed) { out.approved_by = editor; out.approved_digest = digest; }
  return out;
}

/** A copy of `obj` with its approval cleared (approved_by and approved_digest null), in place. */
export function withoutApproval(obj: Raw): Raw {
  const out: Raw = {};
  let placed = false;
  for (const [k, v] of Object.entries(obj)) {
    if (k === 'approved_digest') continue;
    if (k === 'approved_by') { out.approved_by = null; out.approved_digest = null; placed = true; } else out[k] = v;
  }
  if (!placed) { out.approved_by = null; out.approved_digest = null; }
  return out;
}

/** The digest a raw record would be approved with, or why it cannot be approved. */
export function recordDigestOf(raw: unknown): { digest: string } | { error: string } {
  const v = validateForApproval(raw);
  return 'code' in v ? { error: `[${v.code}] ${v.reason}` } : { digest: recordDigest(v) };
}

/** The digest a raw correction would be approved with, or why it cannot be approved. */
export function correctionDigestOf(raw: unknown): { digest: string } | { error: string } {
  const why = correctionProblem(raw);
  if (why) return { error: why };
  return { digest: correctionDigest(raw as Parameters<typeof correctionDigest>[0]) };
}

export type ApproveResult = { ok: true; index: number; digest: string } | { ok: false; error: string };

/**
 * Approve the record with `id` in `entries`, in place: validate it in full
 * (an invalid record cannot be approved), compute its digest, and write the
 * configured editor's name and the digest.
 */
export function approveRecordById(entries: unknown[], id: string): ApproveResult {
  const at = entries.map((r, i) => (r && typeof r === 'object' && (r as Raw).id === id ? i : -1)).filter((i) => i >= 0);
  if (at.length === 0) return { ok: false, error: `no record has id "${id}"` };
  if (at.length > 1) return { ok: false, error: `id "${id}" appears at records #${at.join(' and #')}; fix the duplicate first` };
  const index = at[0] as number;
  const d = recordDigestOf(entries[index]);
  if ('error' in d) return { ok: false, error: `record ${id} cannot be approved: ${d.error}` };
  entries[index] = withApproval(entries[index] as Raw, EDITOR_NAME, d.digest);
  return { ok: true, index, digest: d.digest };
}

/** Approve correction #n in place. */
export function approveCorrectionAt(corrections: unknown[], n: number): ApproveResult {
  const c = corrections[n];
  if (!c || typeof c !== 'object') return { ok: false, error: `there is no correction #${n}` };
  const d = correctionDigestOf(c);
  if ('error' in d) return { ok: false, error: `correction #${n} cannot be approved: ${d.error}` };
  corrections[n] = withApproval(c as Raw, EDITOR_NAME, d.digest);
  return { ok: true, index: n, digest: d.digest };
}
