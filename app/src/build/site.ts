/**
 * Build-time site generation, run by scripts/prerender.mjs after `vite build`.
 * Pure: strings in, files out. It reuses the app's own loader, counting rules
 * and labels, so a record page says exactly what the app's drawer says.
 */
import type { Correction, Item } from '../types';
import { checkCorrections, interpret } from '../data/load';
import { canonicalJson } from '../data/sha256';
import type { SkipCode } from '../types';
import { computeHeadline, qualifyingOnly, type QualifyingItem } from '../data/metrics';
import { formatDate, parseDay } from '../data/dates';
import { formatInt } from '../data/format';
import { CATEGORY_LABEL } from '../categories';
import { EVIDENTIARY_LABEL, PROCEDURAL_LABEL, RESPONSE_LABEL } from '../status';
import { SOURCE_KIND_LABEL, amountLong, amountShort } from '../amounts';
import { correctionSentence, correctionsFor } from '../corrections';
import { SITE_DECK, SITE_NAME, START_LABEL, gradeDef, gradeLabel, intervalSentence } from '../method';
import { recordPath } from '../router';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Headline } from '../components/Headline';
import { esc, fillShell, type PageMeta } from './html';
import { projectEntry } from '../data/project';
import { notCountedReason } from '../grades';
import { atomFeed } from './atom';
import { FEED_LIMIT, MAIN_FEED, feedIndex, feedItems, type FeedsManifest } from '../feeds';

export interface SiteInput {
  /** dist/index.html as Vite wrote it. */
  indexHtml: string;
  /** dataset/entries.json, parsed: the raw file, drafts and all. Never copied to dist as is. */
  entries: unknown;
  /** dataset/corrections.json, parsed, or null when absent. */
  corrections: unknown;
  /** Absolute origin for canonical, og:url and feed links, no trailing slash. */
  siteUrl: string;
  /** The build's "now": records first published after it are not yet counted or fed. */
  nowMs: number;
  /** A unique id for this build, stamped into every page and dist/build.json. */
  buildId: string;
  /** Where the raw dataset was read from, recorded in dist/build.json. */
  dataset: { label: string; isDefault: boolean };
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

/** "Grade 2: primary records" plus why it is not counted, when it is not. */
export function gradeLine(it: Item): string {
  const why = notCountedReason(it);
  return `${gradeLabel(it.evidence_grade)}${why ? `; ${why.toLowerCase()}` : ''}`;
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

function recordBody(it: Item, cs: readonly Correction[], byId: Map<string, Item>, nowMs: number): string {
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
  const published = it.publishedMs !== null ? new Date(it.publishedMs).toISOString().slice(0, 10) : null;
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
    `<p class="drawer__muted">${published === null ? 'Not yet published' : it.qualifying || (it.publishedMs ?? 0) <= nowMs ? `Added to the record ${esc(published)}` : `Scheduled for publication ${esc(published)}; not counted until then`}${modified ? `; last changed ${esc(modified)}` : ''}. Approved by ${esc(it.approved_by ?? '')}. <a href="/method">How we count</a>.</p>`,
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
export const ROUTES: Array<{ path: string; title: string; description: string }> = [
  { path: 'method', title: 'How we count', description: 'Evidence grades, counting rules, the inclusion rubric and the recommended citation for The Ethics Record.' },
  { path: 'corrections', title: 'Corrections', description: 'Every change made to a record of The Ethics Record after publication, with the old value, the new value, and the reason.' },
  { path: 'recent', title: 'Recent changes', description: 'Records added to or changed in The Ethics Record in the last 24 hours and the last 7 days.' },
  { path: 'subscribe', title: 'Subscribe', description: 'Atom feeds of The Ethics Record: every new record, or one office or category.' },
];

/**
 * The only rejection the build may make quietly (it is logged privately): an
 * unapproved draft. Every other rejection, of any record, approved or not,
 * stops the build with the record and reason printed (docs/schema.md).
 */
const QUIET: readonly SkipCode[] = ['unapproved'];

// The approve tool and the verify suite use these through this module.
export { validateForApproval, correctionProblem as checkCorrectionShape } from '../data/load';
export { EDITOR_NAME, correctionDigest, recordDigest } from '../data/approval';
export { sha256Hex, canonicalJson } from '../data/sha256';
export { approveRecordById, approveCorrectionAt, recordDigestOf, correctionDigestOf } from '../data/approve-core';

/** Thrown when the data cannot be published as is; the message lists every problem. */
export class BuildError extends Error {}

/**
 * Every path under dist/ the prerender writes. The prerender deletes them all
 * before writing, so a record removed from the data can never leave its page
 * behind. (dist/index.html is Vite's and is rewritten in place.)
 */
export const GENERATED_PATHS: readonly string[] = [
  'r', 'feeds', 'data', 'build.json', '404.html', 'feed.xml',
  ...ROUTES.flatMap((r) => [`${r.path}.html`, r.path]),
];

/** Every string id in the raw file, approved or not. */
function rawIds(entries: unknown): string[] {
  if (!Array.isArray(entries)) return [];
  return entries
    .map((r) => (r && typeof r === 'object' ? (r as Record<string, unknown>).id : null))
    .filter((id): id is string => typeof id === 'string' && id !== '');
}

export function buildSite(input: SiteInput): SiteOutput {
  const notes: string[] = [];
  const state = interpret(input.entries, input.nowMs);
  if (state.kind !== 'ready') {
    throw new Error(`prerender: the dataset did not load (${state.kind}${'detail' in state ? `: ${state.detail}` : ''})`);
  }
  const fatal: string[] = [];
  // The build log is private; the site never names a left-out record.
  for (const s of state.skipped) {
    const line = `#${s.index}${s.id ? ` (${s.id})` : ''} [${s.code}] ${s.reason}`;
    if (QUIET.includes(s.code)) notes.push(`not public: ${line}`);
    else fatal.push(`record ${line}`);
  }
  // Publication: an approved, valid record whose first_published_at is unset
  // or after build time is held back quietly: no page, no dataset entry, no
  // feed entry, until a build after that time.
  const items = state.items.filter((it) => it.publishedMs !== null && it.publishedMs <= input.nowMs);
  for (const it of state.items) {
    if (!items.includes(it)) {
      notes.push(`not public: (${it.id}) [unpublished] first_published_at ${it.first_published_at ?? 'is not set'}`);
    }
  }
  // A published child whose root is not itself public cannot be published.
  const publicIdSet = new Set(items.map((it) => it.id));
  for (const it of items) {
    if (it.root_id !== null && !publicIdSet.has(it.root_id)) {
      fatal.push(`record (${it.id}) [orphan] its root "${it.root_id}" is not public (unapproved, unpublished or missing)`);
    }
  }
  const byId = new Map(items.map((it) => [it.id, it]));

  // Corrections (docs/schema.md § Admission controls): every entry well
  // formed with a schema-path field; drafts (approved_by null) are dropped
  // quietly; an approved one must carry the editor's name and matching digest
  // and name a public record. No correction, draft or not, may contain the id
  // of a record that is not public. Anything else fails the build, printed.
  let corrections: Correction[] = [];
  if (input.corrections !== null) {
    const cs = checkCorrections(input.corrections, 'verify');
    if (!cs) {
      fatal.push('corrections log: the file is not a JSON array');
    } else {
      for (const p of cs.problems) fatal.push(`correction #${p.index}: ${p.reason}: ${JSON.stringify(p.raw)}`);
      for (const c of cs.corrections) {
        if (!byId.has(c.record_id)) fatal.push(`correction for "${c.record_id}" names no record in the public dataset: ${JSON.stringify(c)}`);
      }
      for (const d of cs.drafts) notes.push(`not public: correction #${d.index} [unapproved] approved_by is null`);
      const hidden = rawIds(input.entries).filter((id) => !publicIdSet.has(id));
      (Array.isArray(input.corrections) ? input.corrections : []).forEach((raw, index) => {
        const text = canonicalJson(raw);
        const named = hidden.filter((id) => new RegExp(`(?<![a-z0-9-])${id.replace(/[-]/g, '\\-')}(?![a-z0-9-])`).test(text));
        if (named.length) fatal.push(`correction #${index} names non-public record ${named.map((n) => `"${n}"`).join(', ')}: ${JSON.stringify(raw)}`);
      });
      corrections = cs.corrections;
    }
  }
  if (fatal.length) throw new BuildError(`the dataset cannot be published:\n  ${fatal.join('\n  ')}`);

  const site = input.siteUrl.replace(/\/+$/, '');
  const files: SiteFile[] = [];

  // The public dataset: the published records, projected to schema fields
  // (never the raw objects), related_ids limited to public records. Leads and
  // retracted records stay, labelled by their own fields. Same order as the app.
  const publicEntries = items.map((it) => projectEntry(it, publicIdSet));
  files.push({ path: 'data/entries.json', content: `${JSON.stringify(publicEntries, null, 2)}\n` });
  // Approved corrections only, projected to their fields (no unknown keys).
  const publicCorrections = corrections.map((c) => ({
    date: c.date, record_id: c.record_id, field: c.field, old_value: c.old_value, new_value: c.new_value, reason: c.reason,
    approved_by: c.approved_by, approved_digest: c.approved_digest, ...(c.placeholder ? { placeholder: true } : {}),
  }));
  files.push({ path: 'data/corrections.json', content: `${JSON.stringify(publicCorrections, null, 2)}\n` });
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
      publishedTime: it.publishedMs !== null ? new Date(it.publishedMs).toISOString() : undefined,
      modifiedTime: it.modifiedMs !== null ? new Date(it.modifiedMs).toISOString() : undefined,
      buildId: input.buildId,
    };
    files.push({ path: `r/${encodeURIComponent(it.id)}/index.html`, content: fillShell(input.indexHtml, meta, recordBody(it, cs, byId, input.nowMs), noscriptRecord) });
  }

  // The front page: same shell, with a preview that states the headline and its rules link.
  const headline = headlineSentence(items, input.nowMs);
  const interval = intervalSentence(computeHeadline(items, input.nowMs).intervalHours);
  const frontDescription = `${placeholder ? 'Placeholder data. ' : ''}${headline} ${interval} Counting rules: ${site}/method`;
  // The visible headline is the SPA's own component, rendered here so the
  // count is readable without JavaScript and testable in the built HTML.
  const headlineHtml = renderToStaticMarkup(createElement(Headline, {
    headline: computeHeadline(items, input.nowMs),
    placeholder,
    onNavigate: () => {},
  }));
  files.push({
    path: 'index.html',
    content: fillShell(input.indexHtml, {
      title: SITE_NAME,
      description: frontDescription,
      url: `${site}/`,
      siteName: SITE_NAME,
      type: 'website',
      ogTitle: `${SITE_NAME}: ${SITE_DECK.replace(/\.$/, '')}`,
      buildId: input.buildId,
    }, `<div class="frame"><section class="front" aria-label="The count">${headlineHtml}</section></div>`, noscriptShell),
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
      buildId: input.buildId,
    }, '', noscriptShell);
    files.push({ path: `${r.path}.html`, content }, { path: `${r.path}/index.html`, content });
  }

  // Static hosts serve 404.html for unknown paths; the SPA then shows its not-found page.
  files.push({
    path: '404.html',
    content: fillShell(input.indexHtml, {
      title: `Page not found | ${SITE_NAME}`, description: SITE_DECK, url: `${site}/`, siteName: SITE_NAME, type: 'website', buildId: input.buildId,
    }, '', noscriptShell),
  });

  // Feeds: qualifying records only (docs/schema.md). The main feed, then one
  // per office and per category with at least one qualifying record.
  const qualifying = qualifyingOnly(items);
  const latest = Math.max(0, ...qualifying.map((it) => Math.max(it.publishedMs, it.modifiedMs ?? 0)));
  const fake = placeholder ? ' Placeholder data: every entry is fake.' : '';
  const feed = (path: string, title: string, list: QualifyingItem[], alternate: string) => files.push({
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
  const index = feedIndex(qualifying);
  if (index.problems.length) throw new BuildError(`feed slugs are not unique:\n  ${index.problems.join('\n  ')}`);
  // The feed list /subscribe shows, fixed at build time (no browser clock).
  const manifest: FeedsManifest = {
    generatedAt: new Date(input.nowMs).toISOString(),
    limit: FEED_LIMIT,
    main: { path: MAIN_FEED, count: Math.min(FEED_LIMIT, qualifying.length) },
    offices: index.offices.map((o) => ({ label: o.label, slug: o.slug, path: o.path, count: o.count })),
    categories: index.categories.map((c) => ({ category: c.key, slug: c.slug, path: c.path, count: c.count })),
  };
  files.push({ path: 'feeds/index.json', content: `${JSON.stringify(manifest, null, 2)}\n` });
  feed(MAIN_FEED, SITE_NAME, qualifying, `${site}/recent`);
  for (const o of index.offices) {
    feed(o.path, `${SITE_NAME}: ${o.label}`, qualifying.filter((it) => it.offices.includes(o.key)), `${site}/subscribe`);
  }
  for (const c of index.categories) {
    feed(c.path, `${SITE_NAME}: ${CATEGORY_LABEL[c.key]}`, qualifying.filter((it) => it.category === c.key), `${site}/subscribe`);
  }

  files.push({ path: 'build.json', content: `${JSON.stringify({ id: input.buildId, builtAt: new Date(input.nowMs).toISOString(), dataset: input.dataset }, null, 2)}\n` });
  notes.push(`build ${input.buildId}; ${items.length} record pages; ${1 + index.offices.length + index.categories.length} feeds; headline: ${headline}`);
  return { files, notes, headline };
}
