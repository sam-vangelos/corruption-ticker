import type { Correction, Item } from '../types';
import { CATEGORY_LABEL } from '../categories';
import { EVIDENTIARY_LABEL, PROCEDURAL_LABEL, RESPONSE_LABEL } from '../status';
import { gradeLabel } from '../method';
import { correctionSentence, correctionsFor } from '../corrections';
import { recordPath } from '../router';

/** Escape for XML text and attributes, dropping characters XML 1.0 forbids. */
export function xml(s: string): string {
  return s
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const iso = (ms: number) => new Date(ms).toISOString();
const updatedMs = (it: Item) => Math.max(it.publishedMs, it.modifiedMs ?? 0);

export interface FeedOptions {
  title: string;
  subtitle: string;
  /** Absolute URL of this feed (its id and rel="self"). */
  selfUrl: string;
  /** Absolute origin, no trailing slash. */
  siteUrl: string;
  /** Absolute URL of the human page the feed mirrors. */
  alternateUrl: string;
  /** Used for <updated> when the feed has no entries. */
  fallbackUpdatedMs: number;
}

/** One record as an Atom entry: its page URL, grade, three statuses, corrections and summary. */
function entry(it: Item, site: string, corrections: readonly Correction[]): string {
  const url = `${site}${recordPath(it.id)}`;
  const grade = gradeLabel(it.evidence_grade);
  const lead = it.evidence_grade === 5 ? ' Lead, not counted.' : it.evidentiary_status === 'retracted' ? ' Retracted, not counted.' : '';
  const status = `Evidence: ${EVIDENTIARY_LABEL[it.evidentiary_status]}. Procedure: ${PROCEDURAL_LABEL[it.procedural_status]}. Response: ${RESPONSE_LABEL[it.subject_response ?? 'none']}.`;
  const notes = correctionsFor(corrections, it.id).map(correctionSentence).join(' ');
  const summary = [
    it.placeholder ? 'Placeholder record, not real reporting.' : '',
    `${grade}.${lead}`,
    status,
    notes,
    it.summary,
  ].filter(Boolean).join(' ');
  return [
    '  <entry>',
    `    <id>${xml(url)}</id>`,
    `    <title type="text">${xml(it.title)}</title>`,
    `    <link rel="alternate" type="text/html" href="${xml(url)}"/>`,
    `    <published>${iso(it.publishedMs)}</published>`,
    `    <updated>${iso(updatedMs(it))}</updated>`,
    `    <category term="grade-${it.evidence_grade}" label="${xml(grade)}"/>`,
    `    <category term="evidence-${it.evidentiary_status}" label="${xml(`Evidence: ${EVIDENTIARY_LABEL[it.evidentiary_status]}`)}"/>`,
    `    <category term="procedure-${it.procedural_status}" label="${xml(`Procedure: ${PROCEDURAL_LABEL[it.procedural_status]}`)}"/>`,
    `    <category term="response-${it.subject_response ?? 'none'}" label="${xml(`Response: ${RESPONSE_LABEL[it.subject_response ?? 'none']}`)}"/>`,
    `    <category term="${xml(it.category)}" label="${xml(CATEGORY_LABEL[it.category])}"/>`,
    `    <summary type="text">${xml(summary)}</summary>`,
    '  </entry>',
  ].join('\n');
}

/** An Atom 1.0 feed (RFC 4287) of `items`, already sorted and capped by the caller. */
export function atomFeed(items: readonly Item[], corrections: readonly Correction[], o: FeedOptions): string {
  const updated = items.length ? Math.max(...items.map(updatedMs)) : o.fallbackUpdatedMs;
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<feed xmlns="http://www.w3.org/2005/Atom">',
    `  <id>${xml(o.selfUrl)}</id>`,
    `  <title type="text">${xml(o.title)}</title>`,
    `  <subtitle type="text">${xml(o.subtitle)}</subtitle>`,
    `  <link rel="self" type="application/atom+xml" href="${xml(o.selfUrl)}"/>`,
    `  <link rel="alternate" type="text/html" href="${xml(o.alternateUrl)}"/>`,
    `  <updated>${iso(updated)}</updated>`,
    '  <author><name>The Ethics Record</name></author>',
    ...items.map((it) => entry(it, o.siteUrl, corrections)),
    '</feed>',
    '',
  ].join('\n');
}
