import { CATEGORIES, STATUSES, type Entry, type Item, type LoadState, type SkippedEntry, type Source } from '../types';
import { monthKey, parseDay } from './dates';

export const DATA_URL = `${import.meta.env.BASE_URL}data/entries.json`;

const isStr = (v: unknown): v is string => typeof v === 'string';
const strOrNull = (v: unknown): string | null => (isStr(v) && v.trim() !== '' ? v : null);
const strList = (v: unknown): string[] => (Array.isArray(v) ? v.filter(isStr) : []);

function toSource(v: unknown): Source | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if (!isStr(o.url) || !isStr(o.outlet)) return null;
  return {
    outlet: o.outlet,
    title: isStr(o.title) ? o.title : '',
    url: o.url,
    date: isStr(o.date) ? o.date : '',
    author: isStr(o.author) ? o.author : '',
  };
}

/** Validate one raw record against the schema; return an Item or the reason it was skipped. */
export function toItem(raw: unknown): Item | string {
  if (!raw || typeof raw !== 'object') return 'not an object';
  const o = raw as Record<string, unknown>;
  if (!isStr(o.id) || !o.id) return 'missing id';
  if (!isStr(o.title) || !o.title) return 'missing title';
  if (!isStr(o.date)) return 'missing date';
  const day = parseDay(o.date);
  if (day === null) return `unparseable date "${o.date}"`;
  if (!isStr(o.category) || !(CATEGORIES as readonly string[]).includes(o.category)) {
    return `unknown category "${String(o.category)}"`;
  }
  if (!isStr(o.status) || !(STATUSES as readonly string[]).includes(o.status)) {
    return `unknown status "${String(o.status)}"`;
  }
  const amount = typeof o.dollar_amount_usd === 'number' && Number.isFinite(o.dollar_amount_usd)
    ? o.dollar_amount_usd
    : null;
  const entry: Entry = {
    id: o.id,
    date: o.date,
    date_precision: o.date_precision === 'month' ? 'month' : 'day',
    title: o.title,
    summary: isStr(o.summary) ? o.summary : '',
    category: o.category as Entry['category'],
    actors: strList(o.actors),
    entities: strList(o.entities),
    dollar_amount_usd: amount,
    dollar_basis: strOrNull(o.dollar_basis),
    status: o.status as Entry['status'],
    status_note: strOrNull(o.status_note),
    sources: Array.isArray(o.sources) ? o.sources.map(toSource).filter((s): s is Source => s !== null) : [],
    related_ids: strList(o.related_ids),
    tags: strList(o.tags),
    placeholder: o.placeholder === true ? true : undefined,
  };
  return {
    ...entry,
    day,
    month: monthKey(day),
    hasDollar: amount !== null && amount > 0,
    haystack: [entry.title, entry.summary, ...entry.actors, ...entry.entities].join('\n').toLowerCase(),
  };
}

/** Turn the parsed JSON body into a LoadState. Exported for reuse; pure. */
export function interpret(body: unknown): LoadState {
  if (!Array.isArray(body)) {
    return { kind: 'invalid', detail: 'The file parsed as JSON but is not an array of entries.' };
  }
  if (body.length === 0) return { kind: 'empty' };
  const items: Item[] = [];
  const skipped: SkippedEntry[] = [];
  const seen = new Set<string>();
  body.forEach((raw, index) => {
    const res = toItem(raw);
    if (typeof res === 'string') {
      const id = raw && typeof raw === 'object' && isStr((raw as Record<string, unknown>).id)
        ? ((raw as Record<string, unknown>).id as string)
        : null;
      skipped.push({ index, id, reason: res });
    } else if (seen.has(res.id)) {
      skipped.push({ index, id: res.id, reason: 'duplicate id' });
    } else {
      seen.add(res.id);
      items.push(res);
    }
  });
  if (items.length === 0) {
    return {
      kind: 'invalid',
      detail: body.length === 1
        ? 'The only record failed validation, so nothing can be shown.'
        : `All ${body.length} records failed validation; none can be shown.`,
    };
  }
  // Reverse-chronological; ties broken by id so the order is stable.
  items.sort((a, b) => b.day - a.day || a.id.localeCompare(b.id));
  return { kind: 'ready', items, skipped };
}

export async function loadEntries(url = DATA_URL): Promise<LoadState> {
  let res: Response;
  try {
    res = await fetch(url, { cache: 'no-cache' });
  } catch (err) {
    return { kind: 'missing', httpStatus: null, detail: `The request failed before a response arrived (${String(err)}).` };
  }
  if (!res.ok) {
    return { kind: 'missing', httpStatus: res.status, detail: `The server answered HTTP ${res.status}.` };
  }
  const text = await res.text();
  if (text.trim() === '') return { kind: 'empty' };
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch (err) {
    // Vite's dev server answers unknown paths with index.html (HTTP 200), so a
    // missing file can surface here as HTML rather than as a 404.
    if (/^\s*</.test(text)) {
      return { kind: 'missing', httpStatus: res.status, detail: 'The server returned an HTML page instead of JSON, which usually means the file does not exist.' };
    }
    return { kind: 'invalid', detail: `The file is not valid JSON (${(err as Error).message}).` };
  }
  return interpret(body);
}
