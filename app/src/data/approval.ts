import type { Item } from '../types';
import editorConfig from '../../editor.json';
import { projectEntry } from './project';
import { canonicalJson, sha256Hex } from './sha256';

/** The configured editor (app/editor.json). Only this name approves. */
export const EDITOR_NAME: string = editorConfig.editor;

/**
 * The approval digest of a validated record: SHA-256 hex of the canonical
 * JSON (sorted keys) of its schema projection, excluding approved_by and
 * approved_digest. related_ids are taken as written (unfiltered), so the
 * digest does not depend on which records happen to be public at build time.
 * The fixture-only `placeholder` flag, when present, is bound too.
 */
export function recordDigest(it: Item): string {
  const p = projectEntry(it, null) as unknown as Record<string, unknown>;
  delete p.approved_by;
  delete p.approved_digest;
  return sha256Hex(canonicalJson(p));
}

/** The fields a correction's approval binds (docs/schema.md § Admission controls). */
export interface CorrectionContent {
  record_id: string;
  date: string;
  field: string;
  old_value: unknown;
  new_value: unknown;
  reason: string;
}

export function correctionDigest(c: CorrectionContent): string {
  return sha256Hex(canonicalJson({
    record_id: c.record_id, date: c.date, field: c.field, old_value: c.old_value, new_value: c.new_value, reason: c.reason,
  }));
}
