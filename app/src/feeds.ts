import type { Category } from './types';
import { CATEGORIES } from './types';
import type { QualifyingItem } from './data/metrics';

/** How many entries each feed carries. */
export const FEED_LIMIT = 50;
export const MAIN_FEED = '/feed.xml';

/**
 * A stable feed slug: the name lowercased, Unicode-normalised (NFKD, combining
 * marks stripped), every run of non-alphanumerics turned into one hyphen, and
 * hyphens trimmed from the ends. "Département d'État" -> "departement-d-etat".
 * The same name always gives the same slug; nothing is suffixed.
 */
export function slugify(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export interface FeedRef<K> {
  key: K;
  label: string;
  slug: string;
  path: string;
  /** Qualifying records carrying this office or category. */
  count: number;
}

export interface FeedIndex {
  offices: FeedRef<string>[];
  categories: FeedRef<Category>[];
  /** Distinct office names that share a slug, or have none. The build fails on any. */
  problems: string[];
}

/**
 * The per-office and per-category feeds: one for every office and category
 * with at least one qualifying record. Pass qualifying records only (feeds
 * contain nothing else, and /subscribe counts the same set).
 */
export function feedIndex(items: readonly QualifyingItem[]): FeedIndex {
  const officeCounts = new Map<string, number>();
  const catCounts = new Map<Category, number>();
  for (const it of items) {
    for (const o of new Set(it.offices)) officeCounts.set(o, (officeCounts.get(o) ?? 0) + 1);
    catCounts.set(it.category, (catCounts.get(it.category) ?? 0) + 1);
  }
  const problems: string[] = [];
  const bySlug = new Map<string, string>();
  const offices: FeedRef<string>[] = [];
  for (const name of [...officeCounts.keys()].sort((a, b) => a.localeCompare(b))) {
    const slug = slugify(name);
    if (!slug) {
      problems.push(`office "${name}" has no letters or digits, so it has no feed slug`);
      continue;
    }
    const other = bySlug.get(slug);
    if (other !== undefined) {
      problems.push(`offices "${other}" and "${name}" both slug to "${slug}"; rename one so each feed URL is unique`);
      continue;
    }
    bySlug.set(slug, name);
    offices.push({ key: name, label: name, slug, path: `/feeds/office/${slug}.xml`, count: officeCounts.get(name) ?? 0 });
  }
  const categories = CATEGORIES.filter((c) => catCounts.has(c)).map((c) => ({
    key: c, label: c, slug: c, path: `/feeds/category/${c}.xml`, count: catCounts.get(c) ?? 0,
  }));
  return { offices, categories, problems };
}

/** Newest first by first_published_at, ties by id; at most `limit`. */
export function feedItems(items: readonly QualifyingItem[], limit = FEED_LIMIT): QualifyingItem[] {
  return [...items].sort((a, b) => b.publishedMs - a.publishedMs || a.id.localeCompare(b.id)).slice(0, limit);
}
