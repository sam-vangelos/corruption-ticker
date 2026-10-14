/** Date helpers. All dates are handled as whole UTC days to avoid timezone drift. */

const MS_PER_DAY = 86_400_000;

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/** The day the counting window opens. */
export const INAUGURATION = '2025-01-20';

const DATE_RE = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/;

/** Parse "YYYY-MM-DD" or "YYYY-MM" to a UTC day number, or null when malformed. */
export function parseDay(value: string): number | null {
  const m = DATE_RE.exec(value);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = m[3] ? Number(m[3]) : 1;
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const ms = Date.UTC(y, mo - 1, d);
  const check = new Date(ms);
  if (check.getUTCMonth() !== mo - 1) return null;
  return Math.round(ms / MS_PER_DAY);
}

export function dayToIso(day: number): string {
  return new Date(day * MS_PER_DAY).toISOString().slice(0, 10);
}

export function monthKey(day: number): string {
  return dayToIso(day).slice(0, 7);
}

/** Today in the viewer's calendar, as a UTC day number. */
export function today(): number {
  const now = new Date();
  return Math.round(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / MS_PER_DAY);
}

/** The calendar day (viewer's zone) containing the instant `ms`, as a UTC day number. */
export function localDay(ms: number): number {
  const d = new Date(ms);
  return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / MS_PER_DAY);
}

export function inaugurationDay(): number {
  return parseDay(INAUGURATION) as number;
}

/** "October 2026" */
export function monthLabel(key: string): string {
  const [y, m] = key.split('-');
  return `${MONTH_NAMES[Number(m) - 1] ?? '?'} ${y}`;
}

/** "Oct 2026" */
export function monthShort(key: string): string {
  const [y, m] = key.split('-');
  return `${MONTH_SHORT[Number(m) - 1] ?? '?'} ${y}`;
}

/** "14 Mar 2025", or "Mar 2025" for month-precision dates. */
export function formatDate(day: number, precision: 'day' | 'month' = 'day'): string {
  const d = new Date(day * MS_PER_DAY);
  const mon = MONTH_SHORT[d.getUTCMonth()];
  if (precision === 'month') return `${mon} ${d.getUTCFullYear()}`;
  return `${d.getUTCDate()} ${mon} ${d.getUTCFullYear()}`;
}

/** Every "YYYY-MM" key from the month of `from` through the month of `to`, inclusive. */
export function monthRange(from: number, to: number): string[] {
  const out: string[] = [];
  const a = new Date(from * MS_PER_DAY);
  let y = a.getUTCFullYear();
  let m = a.getUTCMonth();
  const end = monthKey(to);
  for (let guard = 0; guard < 1200; guard++) {
    const key = `${y}-${String(m + 1).padStart(2, '0')}`;
    out.push(key);
    if (key >= end) break;
    m += 1;
    if (m === 12) { m = 0; y += 1; }
  }
  return out;
}
