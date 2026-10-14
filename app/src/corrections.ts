import type { Correction, JsonValue } from './types';
import { formatDate, parseDay } from './data/dates';

/** A field path as prose: "amounts[0].usd" -> "amounts 1 usd"; "evidentiary_status" -> "evidentiary status". */
export function fieldLabel(field: string): string {
  return field
    .replace(/\[(\d+)\]/g, (_, n: string) => ` ${Number(n) + 1}`)
    .replace(/[._]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** A JSON value for display: strings quoted, numbers grouped, null as "none". */
export function valueLabel(v: JsonValue): string {
  if (v === null) return 'none';
  if (typeof v === 'string') return `“${v}”`;
  if (typeof v === 'number') return v.toLocaleString('en-US');
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return JSON.stringify(v);
}

/** "13 Oct 2026" for a correction's YYYY-MM-DD date. */
export function correctionDate(c: Correction): string {
  const d = parseDay(c.date);
  return d === null ? c.date : formatDate(d);
}

/** One sentence for a record page or drawer: what changed, from what, to what, and why. */
export function correctionSentence(c: Correction): string {
  return `Corrected ${correctionDate(c)}: ${fieldLabel(c.field)} changed from ${valueLabel(c.old_value)} to ${valueLabel(c.new_value)}. ${c.reason}`;
}

/** Corrections for one record, newest first. */
export function correctionsFor(all: readonly Correction[], id: string): Correction[] {
  return all.filter((c) => c.record_id === id);
}
