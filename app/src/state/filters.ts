import { useCallback, useEffect, useState } from 'react';
import { CATEGORIES, STATUSES, type Category, type Item, type Status } from '../types';
import { parseDay } from '../data/dates';

/** Every filter the bar exposes. Empty list / null / '' means "not filtering". */
export interface Filters {
  categories: Category[];
  actors: string[];
  entities: string[];
  statuses: Status[];
  /** YYYY-MM-DD, inclusive */
  from: string | null;
  /** YYYY-MM-DD, inclusive */
  to: string | null;
  minUsd: number | null;
  q: string;
}

export const EMPTY_FILTERS: Filters = {
  categories: [],
  actors: [],
  entities: [],
  statuses: [],
  from: null,
  to: null,
  minUsd: null,
  q: '',
};

/** URL keys. Multi-value keys repeat (actor=A&actor=B) so names may contain commas. */
const KEYS = { categories: 'cat', actors: 'actor', entities: 'entity', statuses: 'status', from: 'from', to: 'to', minUsd: 'min', q: 'q' } as const;
const FILTER_KEYS = new Set<string>(Object.values(KEYS));

export function isFiltering(f: Filters): boolean {
  return (
    f.categories.length > 0 || f.actors.length > 0 || f.entities.length > 0 || f.statuses.length > 0 ||
    f.from !== null || f.to !== null || f.minUsd !== null || f.q.trim() !== ''
  );
}

const uniq = <T,>(xs: T[]) => [...new Set(xs)];

export function parseFilters(search: string): Filters {
  const p = new URLSearchParams(search);
  const date = (k: string) => {
    const v = p.get(k);
    return v && /^\d{4}-\d{2}-\d{2}$/.test(v) && parseDay(v) !== null ? v : null;
  };
  const min = Number(p.get(KEYS.minUsd));
  return {
    categories: uniq(p.getAll(KEYS.categories).filter((c): c is Category => (CATEGORIES as readonly string[]).includes(c))),
    actors: uniq(p.getAll(KEYS.actors).filter(Boolean)),
    entities: uniq(p.getAll(KEYS.entities).filter(Boolean)),
    statuses: uniq(p.getAll(KEYS.statuses).filter((s): s is Status => (STATUSES as readonly string[]).includes(s))),
    from: date(KEYS.from),
    to: date(KEYS.to),
    minUsd: p.has(KEYS.minUsd) && Number.isFinite(min) && min > 0 ? min : null,
    q: p.get(KEYS.q) ?? '',
  };
}

/** Write filters into a query string, keeping any non-filter params (e.g. item=). */
export function serializeFilters(f: Filters, existing: string): string {
  const p = new URLSearchParams(existing);
  for (const k of FILTER_KEYS) p.delete(k);
  for (const c of f.categories) p.append(KEYS.categories, c);
  for (const a of f.actors) p.append(KEYS.actors, a);
  for (const e of f.entities) p.append(KEYS.entities, e);
  for (const s of f.statuses) p.append(KEYS.statuses, s);
  if (f.from) p.set(KEYS.from, f.from);
  if (f.to) p.set(KEYS.to, f.to);
  if (f.minUsd !== null) p.set(KEYS.minUsd, String(f.minUsd));
  if (f.q.trim() !== '') p.set(KEYS.q, f.q);
  const s = p.toString();
  return s ? `?${s}` : '';
}

/** Filters held in React state and mirrored to the URL (replaceState; restored on load and on back/forward). */
export function useUrlFilters(): [Filters, (next: Filters | ((prev: Filters) => Filters)) => void] {
  const [filters, setFiltersState] = useState<Filters>(() => parseFilters(window.location.search));

  useEffect(() => {
    const onPop = () => setFiltersState(parseFilters(window.location.search));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    const qs = serializeFilters(filters, window.location.search);
    if (qs !== window.location.search) {
      window.history.replaceState(window.history.state, '', `${window.location.pathname}${qs}${window.location.hash}`);
    }
  }, [filters]);

  const setFilters = useCallback((next: Filters | ((prev: Filters) => Filters)) => {
    setFiltersState((prev) => (typeof next === 'function' ? next(prev) : next));
  }, []);

  return [filters, setFilters];
}

/**
 * OR within a facet, AND across facets. Free text: every whitespace-separated
 * term must appear in title + summary + actors + entities. A minimum dollar
 * amount excludes items that carry no figure.
 */
export function applyFilters(items: Item[], f: Filters): Item[] {
  if (!isFiltering(f)) return items;
  const cats = new Set(f.categories);
  const actors = new Set(f.actors);
  const entities = new Set(f.entities);
  const statuses = new Set(f.statuses);
  const from = f.from ? parseDay(f.from) : null;
  const to = f.to ? parseDay(f.to) : null;
  const terms = f.q.toLowerCase().split(/\s+/).filter(Boolean);
  return items.filter((it) => {
    if (cats.size && !cats.has(it.category)) return false;
    if (statuses.size && !statuses.has(it.status)) return false;
    if (actors.size && !it.actors.some((a) => actors.has(a))) return false;
    if (entities.size && !it.entities.some((e) => entities.has(e))) return false;
    if (from !== null && it.day < from) return false;
    if (to !== null && it.day > to) return false;
    if (f.minUsd !== null && !(it.hasDollar && (it.dollar_amount_usd ?? 0) >= f.minUsd)) return false;
    for (const t of terms) if (!it.haystack.includes(t)) return false;
    return true;
  });
}
