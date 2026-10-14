/**
 * Build-time site generation, run by scripts/prerender.mjs after `vite build`.
 * Pure: strings in, files out. It reuses the app's own loader, counting rules
 * and labels, so a record page says exactly what the app's drawer says.
 */
import type { Correction, Item } from '../types';
import { interpret, interpretCorrections } from '../data/load';
import { computeHeadline } from '../data/metrics';
import { formatDate, parseDay } from '../data/dates';
import { formatInt } from '../data/format';
import { CATEGORY_LABEL } from '../categories';
import { EVIDENTIARY_LABEL, PROCEDURAL_LABEL, RESPONSE_LABEL } from '../status';
import { SOURCE_KIND_LABEL, amountLong, amountShort } from '../amounts';
import { correctionSentence, correctionsFor } from '../corrections';
import { SITE_DECK, SITE_NAME, START_LABEL, gradeDef, gradeLabel } from '../method';
import { recordPath } from '../router';
import { esc, fillShell, type PageMeta } from './html';
import { atomFeed } from './atom';
import { MAIN_FEED, feedIndex, feedItems } from '../feeds';

export interface SiteInput {
  /** dist/index.html as Vite wrote it. */
  indexHtml: string;
  /** public/data/entries.json, parsed. */
  entries: unknown;
  /** public/data/corrections.json, parsed, or null when absent. */
  corrections: unknown;
  /** Absolute origin for canonical, og:url and feed links, no trailing slash. */
  siteUrl: string;
}

export interface SiteFile {
  /** Path under dist/, forward slashes. */
  path: string;
  content: string;
}

export interface SiteOutput {
  files: SiteFile[];
  /** Human-readable notes for the build log (skipped records, and so on). */
  notes: string[];
  /** The record count, event count and headline sentence baked into the front page. */
  headline: string;
}

const PLACEHOLDER_NOTE = 'Placeholder record: fake data for layout testing, describing no real event, person, or organization.';

/** "Grade 2: primary records" plus "lead, not counted" / "retracted, not counted". */
export function gradeLine(it: Item): string {
  const g = gradeDef(it.evidence_grade);
  let s = gradeLabel(it.evidence_grade);
  if (!g.counts) s += '; lead, not counted';
  else if (it.evidentiary_status === 'retracted') s += '; retracted, not counted';
  return s;
}

/** "Evidence: Documented. Procedure: Under investigation. Response: Denied." */
export function statusLine(it: Item): string {
  return `Evidence: ${EVIDENTIARY_LABEL[it.evidentiary_status]}. Procedure: ${PROCEDURAL_LABEL[it.procedural_status]}. Response: ${RESPONSE_LABEL[it.subject_response ?? 'none']}.`;
}

/** "Example Outlet (disclosure)" for the first source, plus a count of the rest. */
export function sourceLine(it: Item): string {
  const first = it.sources[0];
  if (!first) return 'No sources listed';
  const more = it.sources.length - 1;
  return `${first.outlet} (${SOURCE_KIND_LABEL[first.kind]})${more > 0 ? ` and ${more} more` : ''}`;
}

export function dateLine(it: Item): string {
  return formatDate(it.day, it.date_precision);
}

/**
 * The link-preview description: date, grade, outlet or document kind,
 * current statuses, figures with their type, and any correction notice.
 */
export function recordDescription(it: Item, corrections: readonly Correction[]): string {
  const parts = [
    it.placeholder ? 'Placeholder record, not real reporting.' : '',
    `${dateLine(it)}.`,
    `${gradeLine(it)}.`,
    // Corrections come early so a preview truncated by the platform still shows them.
    ...corrections.map(correctionSentence),
    `Source: ${sourceLine(it)}.`,
    statusLine(it),
    it.amounts.length ? `Amounts: ${it.amounts.map(amountShort).join('; ')}.` : '',
  ];
  return parts.filter(Boolean).join(' ');
}

function recordBody(it: Item, cs: readonly Correction[], byId: Map<string, Item>): string {
  const li = (s: string) => `<li>${s}</li>`;
  const root = it.root_id ? byId.get(it.root_id) : null;
  const children = [...byId.values()].filter((x) => x.root_id === it.id);
  const facts: string[] = [];
  if (it.actors.length) facts.push(`<div><dt>Actors</dt><dd>${it.actors.map((a) => esc(a)).join(', ')}</dd></div>`);
  if (it.offices.length) facts.push(`<div><dt>Offices</dt><dd>${it.offices.map((o) => esc(o)).join(', ')}</dd></div>`);
  if (it.entities.length) facts.push(`<div><dt>Entities</dt><dd>${it.entities.map((e) => esc(e)).join(', ')}</dd></div>`);
  facts.push(`<div><dt>Why it is on the record</dt><dd>${esc(it.rubric_evidence)}</dd></div>`);
  facts.push(`<div><dt>Why this grade</dt><dd>${esc(it.evidence_note)}</dd></div>`);
  if (it.amounts.length) {
    facts.push(`<div><dt>Stated amounts</dt><dd><ul>${it.amounts.map((a) => li(
      `${esc(amountLong(a))}. ${esc(a.basis)}`,
    )).join('')}</ul></dd></div>`);
  }
  const sources = it.sources.map((s) => {
    const d = s.date ? parseDay(s.date) : null;
    return li(`<strong>${esc(s.outlet)}</strong> (${esc(SOURCE_KIND_LABEL[s.kind])})${d !== null ? `, ${esc(formatDate(d))}` : ''}: `
      + `<a href="${esc(s.url)}">${esc(s.title || s.url)}</a> (<a href="${esc(s.archive_url)}">archived copy</a>)`);
  }).join('');
  const tree = root
    ? `<p>A development in the matter <a href="${esc(recordPath(root.id))}">${esc(root.title)}</a>.</p>`
    : children.length
      ? `<p>Later developments in this matter:</p><ul>${children.map((c) => li(`<a href="${esc(recordPath(c.id))}">${esc(c.title)}</a>`)).join('')}</ul>`
      : '';
  const published = new Date(it.publishedMs).toISOString().slice(0, 10);
  const modified = it.modifiedMs !== null ? new Date(it.modifiedMs).toISOString().slice(0, 10) : null;
  return [
    '<main id="main" class="static-record">',
    `<p class="static-record__site"><a href="/">${esc(SITE_NAME)}</a></p>`,
    it.placeholder ? `<p class="drawer__placeholder" role="note">${esc(PLACEHOLDER_NOTE)}</p>` : '',
    '<article>',
    `<p class="drawer__meta"><time datetime="${esc(it.date)}">${esc(dateLine(it))}</time> <span>${esc(CATEGORY_LABEL[it.category])}</span></p>`,
    `<h1 class="drawer__title">${esc(it.title)}</h1>`,
    `<p><strong>${esc(gradeLine(it))}.</strong> ${esc(gradeDef(it.evidence_grade).meaning)}. At this grade the record says “${esc(gradeDef(it.evidence_grade).verb)}”.</p>`,
    `<p>${esc(statusLine(it))}${it.status_note ? ` ${esc(it.status_note)}` : ''}</p>`,
    cs.length ? `<section aria-label="Corrections">${cs.map((c) => `<p class="record-correction" role="note">${esc(correctionSentence(c))}</p>`).join('')}</section>` : '',
    it.summary ? `<p class="drawer__summary">${esc(it.summary)}</p>` : '',
    `<dl class="drawer__facts">${facts.join('')}</dl>`,
    tree,
    `<h2>Sources (${it.sources.length})</h2><ol>${sources}</ol>`,
    `<p class="drawer__muted">Added to the record ${esc(published)}${modified ? `; last changed ${esc(modified)}` : ''}. Approved by ${esc(it.approved_by ?? '')}. <a href="/method">How we count</a>.</p>`,
    '</article>',
    '</main>',
  ].filter(Boolean).join('\n');
}

const plural = (n: number, one: string, many: string) => `${formatInt(n)} ${n === 1 ? one : many}`;

export function headlineSentence(items: readonly Item[], nowMs: number): string {
  const h = computeHeadline(items, nowMs);
  return `${plural(h.records, 'qualifying record', 'qualifying records')} concerning ${plural(h.events, 'distinct event', 'distinct events')} since ${START_LABEL}.`;
}

/** Static route shells: the SPA with the right title and preview for each page. */
const ROUTES: Array<{ path: string; title: string; description: string }> = [
  { path: 'method', title: 'How we count', description: 'Evidence grades, counting rules, the inclusion rubric and the recommended citation for The Ethics Record.' },
  { path: 'corrections', title: 'Corrections', description: 'Every change made to a record of The Ethics Record after publication, with the old value, the new value, and the reason.' },
  { path: 'recent', title: 'Recent changes', description: 'Records added to or changed in The Ethics Record in the last 24 hours and the last 7 days.' },
  { path: 'subscribe', title: 'Subscribe', description: 'Atom feeds of The Ethics Record: every new record, or one office or category.' },
];

export function buildSite(input: SiteInput): SiteOutput {
  const notes: string[] = [];
  const state = interpret(input.entries);
  if (state.kind !== 'ready') {
    throw new Error(`prerender: the dataset did not load (${state.kind}${'detail' in state ? `: ${state.detail}` : ''})`);
  }
  for (const s of state.skipped) notes.push(`skipped record #${s.index}${s.id ? ` (${s.id})` : ''}: ${s.reason}`);
  const items = state.items;
  const byId = new Map(items.map((it) => [it.id, it]));

  let corrections: Correction[] = [];
  if (input.corrections !== null) {
    const cs = interpretCorrections(input.corrections);
    if (cs.kind === 'ready') {
      corrections = cs.corrections;
      if (cs.skipped) notes.push(`skipped ${cs.skipped} malformed correction(s)`);
    } else if (cs.kind === 'unavailable') {
      notes.push(`corrections log unreadable: ${cs.detail}`);
    }
  }

  const site = input.siteUrl.replace(/\/+$/, '');
  const files: SiteFile[] = [];
  const placeholder = items.some((it) => it.placeholder);
  const noscriptRecord = 'The record above is complete without JavaScript; the interactive front page needs it.';
  const noscriptShell = 'This page needs JavaScript to load and display the dataset.';

  // Record pages: dist/r/<id>/index.html, built from the record's current data.
  for (const it of items) {
    const cs = correctionsFor(corrections, it.id);
    const path = recordPath(it.id);
    const meta: PageMeta = {
      title: `${it.title} | ${SITE_NAME}`,
      ogTitle: it.title,
      description: recordDescription(it, cs),
      url: `${site}${path}`,
      siteName: SITE_NAME,
      type: 'article',
      publishedTime: new Date(it.publishedMs).toISOString(),
      modifiedTime: it.modifiedMs !== null ? new Date(it.modifiedMs).toISOString() : undefined,
    };
    files.push({ path: `r/${encodeURIComponent(it.id)}/index.html`, content: fillShell(input.indexHtml, meta, recordBody(it, cs, byId), noscriptRecord) });
  }

  // The front page: same shell, with a preview that states the headline and its rules link.
  const headline = headlineSentence(items, Date.now());
  const frontDescription = `${placeholder ? 'Placeholder data. ' : ''}${headline} Counting rules: ${site}/method`;
  files.push({
    path: 'index.html',
    content: fillShell(input.indexHtml, {
      title: SITE_NAME,
      description: frontDescription,
      url: `${site}/`,
      siteName: SITE_NAME,
      type: 'website',
      ogTitle: `${SITE_NAME}: ${SITE_DECK.replace(/\.$/, '')}`,
    }, '', noscriptShell),
  });

  // Written twice: /method resolves to method.html on most static hosts,
  // /method/ to method/index.html.
  for (const r of ROUTES) {
    const content = fillShell(input.indexHtml, {
      title: `${r.title} | ${SITE_NAME}`,
      description: r.description,
      url: `${site}/${r.path}`,
      siteName: SITE_NAME,
      type: 'website',
    }, '', noscriptShell);
    files.push({ path: `${r.path}.html`, content }, { path: `${r.path}/index.html`, content });
  }

  // Static hosts serve 404.html for unknown paths; the SPA then shows its not-found page.
  files.push({
    path: '404.html',
    content: fillShell(input.indexHtml, {
      title: `Page not found | ${SITE_NAME}`, description: SITE_DECK, url: `${site}/`, siteName: SITE_NAME, type: 'website',
    }, '', noscriptShell),
  });

  // Feeds: everything, then one per office and per category present.
  const latest = Math.max(0, ...items.map((it) => Math.max(it.publishedMs, it.modifiedMs ?? 0)));
  const fake = placeholder ? ' Placeholder data: every entry is fake.' : '';
  const feed = (path: string, title: string, list: Item[], alternate: string) => files.push({
    path: path.replace(/^\//, ''),
    content: atomFeed(feedItems(list), corrections, {
      title,
      subtitle: `${SITE_DECK}${fake}`,
      selfUrl: `${site}${path}`,
      siteUrl: site,
      alternateUrl: alternate,
      fallbackUpdatedMs: latest,
    }),
  });
  feed(MAIN_FEED, SITE_NAME, items, `${site}/recent`);
  const index = feedIndex(items);
  for (const o of index.offices) {
    feed(o.path, `${SITE_NAME}: ${o.label}`, items.filter((it) => it.offices.includes(o.key)), `${site}/subscribe`);
  }
  for (const c of index.categories) {
    feed(c.path, `${SITE_NAME}: ${CATEGORY_LABEL[c.key]}`, items.filter((it) => it.category === c.key), `${site}/subscribe`);
  }

  notes.push(`${items.length} record pages; ${1 + index.offices.length + index.categories.length} feeds; headline: ${headline}`);
  return { files, notes, headline };
}
