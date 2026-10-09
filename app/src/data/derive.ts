import type { Category, Item } from '../types';

/** Indexes over the full dataset, built once per load. */
export interface Indexes {
  byId: Map<string, Item>;
  byMonth: Map<string, Item[]>;
  byCategory: Map<Category, Item[]>;
  byActor: Map<string, Item[]>;
  byEntity: Map<string, Item[]>;
}

function push<K, V>(map: Map<K, V[]>, key: K, value: V) {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

/** Items must already be sorted reverse-chronologically; every list keeps that order. */
export function buildIndexes(items: Item[]): Indexes {
  const idx: Indexes = {
    byId: new Map(),
    byMonth: new Map(),
    byCategory: new Map(),
    byActor: new Map(),
    byEntity: new Map(),
  };
  for (const it of items) {
    idx.byId.set(it.id, it);
    push(idx.byMonth, it.month, it);
    push(idx.byCategory, it.category, it);
    for (const a of new Set(it.actors)) push(idx.byActor, a, it);
    for (const e of new Set(it.entities)) push(idx.byEntity, e, it);
  }
  return idx;
}

/** Option list for a searchable multi-select: name + count, most frequent first. */
export function optionsFrom(map: Map<string, Item[]>): Array<{ value: string; count: number }> {
  return [...map.entries()]
    .map(([value, list]) => ({ value, count: list.length }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

/** Group a reverse-chronological list into month buckets, newest month first. */
export function groupByMonth(items: Item[]): Array<{ month: string; items: Item[] }> {
  const out: Array<{ month: string; items: Item[] }> = [];
  for (const it of items) {
    const last = out[out.length - 1];
    if (last && last.month === it.month) last.items.push(it);
    else out.push({ month: it.month, items: [it] });
  }
  return out;
}

export interface Stats {
  /** Today (UTC day number) when the stats were computed. */
  now: number;
  /** Whole days from 20 Jan 2025 to today. Independent of filters. */
  daysSince: number;
  total: number;
  /** total / weeks in the active window */
  perWeek: number;
  /** Window used for the per-week rate (UTC day numbers, inclusive). */
  windowFrom: number;
  windowTo: number;
  dollars: number;
  withDollar: number;
  last30: number;
}

/**
 * Counter values for a (filtered) list. The per-week window opens at 20 Jan
 * 2025 or the filter's start date, whichever is later, and closes today or at
 * the filter's end date, whichever is earlier.
 */
export function computeStats(
  items: Item[],
  opts: { now: number; inauguration: number; from?: number | null; to?: number | null },
): Stats {
  const { now, inauguration } = opts;
  const windowFrom = Math.max(inauguration, opts.from ?? inauguration);
  const windowTo = Math.min(now, opts.to ?? now);
  const days = Math.max(1, windowTo - windowFrom + 1);
  let dollars = 0;
  let withDollar = 0;
  let last30 = 0;
  for (const it of items) {
    if (it.hasDollar && it.dollar_amount_usd !== null) {
      dollars += it.dollar_amount_usd;
      withDollar += 1;
    }
    if (it.day > now - 30 && it.day <= now) last30 += 1;
  }
  return {
    now,
    daysSince: Math.max(0, now - inauguration),
    total: items.length,
    perWeek: items.length / (days / 7),
    windowFrom,
    windowTo,
    dollars,
    withDollar,
    last30,
  };
}

export interface MonthBucket {
  month: string;
  count: number;
  cumulative: number;
  dollars: number;
  cumDollars: number;
}

/** Monthly counts and running totals for every month in [fromMonth, toMonth], zeros included. */
export function monthlySeries(items: Item[], months: string[]): MonthBucket[] {
  const counts = new Map<string, { count: number; dollars: number }>();
  let before = 0;
  let beforeDollars = 0;
  const first = months[0] ?? '';
  for (const it of items) {
    const usd = it.hasDollar ? (it.dollar_amount_usd ?? 0) : 0;
    if (it.month < first) { before += 1; beforeDollars += usd; continue; }
    const b = counts.get(it.month) ?? { count: 0, dollars: 0 };
    b.count += 1;
    b.dollars += usd;
    counts.set(it.month, b);
  }
  let cumulative = before;
  let cumDollars = beforeDollars;
  return months.map((month) => {
    const b = counts.get(month) ?? { count: 0, dollars: 0 };
    cumulative += b.count;
    cumDollars += b.dollars;
    return { month, count: b.count, cumulative, dollars: b.dollars, cumDollars };
  });
}

/** Items per category, all eleven categories, largest first (ties in schema order). */
export function categorySeries(items: Item[], order: readonly Category[]): Array<{ category: Category; count: number }> {
  const m = new Map<Category, number>();
  for (const it of items) m.set(it.category, (m.get(it.category) ?? 0) + 1);
  return order
    .map((category, i) => ({ category, count: m.get(category) ?? 0, i }))
    .sort((a, b) => b.count - a.count || a.i - b.i)
    .map(({ category, count }) => ({ category, count }));
}
