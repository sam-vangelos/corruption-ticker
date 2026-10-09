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
