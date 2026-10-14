import type { Category, Item } from './types';
import { CATEGORIES } from './types';

/** How many entries each feed carries. */
export const FEED_LIMIT = 50;
export const MAIN_FEED = '/feed.xml';

/** "Example Agency for Testing" -> "example-agency-for-testing". */
export function slugify(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'unnamed';
}

export interface FeedRef<K> {
  key: K;
  label: string;
  slug: string;
  path: string;
  /** Records carrying this office or category (all grades). */
  count: number;
}

export interface FeedIndex {
  offices: FeedRef<string>[];
  categories: FeedRef<Category>[];
}

/**
 * Every office and category present in the data, each with its feed path.
 * Office slugs that collide get a numeric suffix, assigned in name order so a
 * slug is stable for a given set of offices.
 */
export function feedIndex(items: readonly Item[]): FeedIndex {
  const officeCounts = new Map<string, number>();
  const catCounts = new Map<Category, number>();
  for (const it of items) {
    for (const o of new Set(it.offices)) officeCounts.set(o, (officeCounts.get(o) ?? 0) + 1);
    catCounts.set(it.category, (catCounts.get(it.category) ?? 0) + 1);
  }
  const used = new Set<string>();
  const offices = [...officeCounts.keys()].sort((a, b) => a.localeCompare(b)).map((name) => {
    const base = slugify(name);
    let slug = base;
    for (let n = 2; used.has(slug); n++) slug = `${base}-${n}`;
    used.add(slug);
    return { key: name, label: name, slug, path: `/feeds/office/${slug}.xml`, count: officeCounts.get(name) ?? 0 };
  });
  const categories = CATEGORIES.filter((c) => catCounts.has(c)).map((c) => ({
    key: c, label: c, slug: c, path: `/feeds/category/${c}.xml`, count: catCounts.get(c) ?? 0,
  }));
  return { offices, categories };
}

/** Newest first by first_published_at, ties by id; at most `limit`. */
export function feedItems(items: readonly Item[], limit = FEED_LIMIT): Item[] {
  return [...items].sort((a, b) => b.publishedMs - a.publishedMs || a.id.localeCompare(b.id)).slice(0, limit);
}
