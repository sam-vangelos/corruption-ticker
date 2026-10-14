import type { Entry, Item } from '../types';
import { COUNTED_GRADES, EXCLUDED_STATUSES, INTERVAL_START_MS } from '../method';
import { localDay } from './dates';

const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 86_400_000;

/** In the metric set: grade 1 to 4 and not retracted (docs/schema.md, counting rules). */
export function isQualifying(e: Pick<Entry, 'evidence_grade' | 'evidentiary_status'>): boolean {
  return COUNTED_GRADES.includes(e.evidence_grade) && !EXCLUDED_STATUSES.includes(e.evidentiary_status);
}

export interface Headline {
  /** Root and child records in the metric set. */
  records: number;
  /** Root records in the metric set: one per distinct underlying matter. */
  events: number;
  /** Hours from the interval start to `nowMs`. */
  hours: number;
  /** hours / events, or null when there are no events. */
  intervalHours: number | null;
}

/** The front-page numbers. Always over the whole record, never a filtered slice. */
export function computeHeadline(items: readonly Item[], nowMs: number): Headline {
  let records = 0;
  let events = 0;
  for (const it of items) {
    if (!it.qualifying) continue;
    records += 1;
    if (it.isRoot) events += 1;
  }
  const hours = Math.max(0, (nowMs - INTERVAL_START_MS) / MS_PER_HOUR);
  return { records, events, hours, intervalHours: events > 0 ? hours / events : null };
}

export interface CadenceDay {
  /** Calendar day in the viewer's zone, as a UTC day number. */
  day: number;
  /** Qualifying records first published that day, oldest first. */
  items: Item[];
}

/**
 * The cadence strip: one column per calendar day for the last `days` days
 * (today last), each holding the qualifying records added to the record that
 * day by `first_published_at`. Event dates play no part here.
 */
export function cadence(items: readonly Item[], nowMs: number, days = 7): CadenceDay[] {
  const today = localDay(nowMs);
  const cols: CadenceDay[] = [];
  for (let d = today - days + 1; d <= today; d++) cols.push({ day: d, items: [] });
  const first = today - days + 1;
  for (const it of items) {
    if (!it.qualifying || it.publishedMs > nowMs) continue;
    const d = localDay(it.publishedMs);
    if (d < first || d > today) continue;
    cols[d - first]?.items.push(it);
  }
  for (const c of cols) c.items.sort((a, b) => a.publishedMs - b.publishedMs || a.id.localeCompare(b.id));
  return cols;
}

export interface Stats {
  /** Today (UTC day number) when the stats were computed. */
  now: number;
  /** Whole days from 20 Jan 2025 to today. Independent of filters. */
  daysSince: number;
  /** Qualifying records in the slice. */
  total: number;
  /** Qualifying records carrying at least one stated figure. */
  withAmount: number;
  /** Qualifying records first published in the 30 days before now. */
  added30: number;
  /** Qualifying records whose procedural status is under investigation or litigation. */
  inProcess: number;
}

/** Counter values for a (filtered) list. Only qualifying records count. */
export function computeStats(items: readonly Item[], opts: { now: number; nowMs: number; inauguration: number }): Stats {
  let total = 0;
  let withAmount = 0;
  let added30 = 0;
  let inProcess = 0;
  const since = opts.nowMs - 30 * MS_PER_DAY;
  for (const it of items) {
    if (!it.qualifying) continue;
    total += 1;
    if (it.amounts.length > 0) withAmount += 1;
    if (it.publishedMs > since && it.publishedMs <= opts.nowMs) added30 += 1;
    if (it.procedural_status === 'under-investigation' || it.procedural_status === 'litigation') inProcess += 1;
  }
  return { now: opts.now, daysSince: Math.max(0, opts.now - opts.inauguration), total, withAmount, added30, inProcess };
}
