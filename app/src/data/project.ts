import type { Entry, Item } from '../types';

/**
 * The public form of a record: exactly the schema v2 fields (docs/schema.md),
 * rebuilt from the validated Item, never copied from the raw object, so an
 * unknown key in the raw file (internal notes, editor comments) can never
 * ship. The return type is Entry and every field is written explicitly, so a
 * key outside the schema is a compile error here. The one addition is the
 * fixture-only `placeholder` flag (app brief), written only when true.
 *
 * `related_ids` keeps only ids in the public set, so a link to a draft or an
 * unpublished record is never published.
 */
export function projectEntry(it: Item, publicIds: ReadonlySet<string> | null): Entry {
  const entry: Entry = {
    id: it.id,
    root_id: it.root_id,
    date: it.date,
    date_precision: it.date_precision,
    title: it.title,
    summary: it.summary,
    category: it.category,
    rubric_prong: it.rubric_prong,
    rubric_evidence: it.rubric_evidence,
    actors: [...it.actors],
    actor_roles: Object.fromEntries(it.actors.map((a) => [a, it.actor_roles[a]])) as Entry['actor_roles'],
    entities: [...it.entities],
    offices: [...it.offices],
    evidence_grade: it.evidence_grade,
    evidence_note: it.evidence_note,
    evidentiary_status: it.evidentiary_status,
    procedural_status: it.procedural_status,
    subject_response: it.subject_response,
    status_note: it.status_note,
    amounts: it.amounts.map((a) => ({
      usd: a.usd,
      amount_type: a.amount_type,
      actual_or_estimated: a.actual_or_estimated,
      basis: a.basis,
      overlap_group: a.overlap_group,
    })),
    sources: it.sources.map((s) => ({
      outlet: s.outlet,
      title: s.title,
      url: s.url,
      archive_url: s.archive_url,
      date: s.date,
      author: s.author,
      kind: s.kind,
    })),
    first_published_at: it.first_published_at,
    last_modified_at: it.last_modified_at,
    last_verified_at: it.last_verified_at,
    approved_by: it.approved_by,
    approved_digest: it.approved_digest,
    // null = no public set yet (the approval digest): keep every id as written.
    related_ids: publicIds ? it.related_ids.filter((id) => id !== it.id && publicIds.has(id)) : [...it.related_ids],
    tags: [...it.tags],
  };
  if (it.placeholder) entry.placeholder = true;
  return entry;
}

/** Every key a public record may carry, top level and nested: the smoke test checks against this shape. */
export const PUBLIC_KEYS = {
  entry: ['id', 'root_id', 'date', 'date_precision', 'title', 'summary', 'category', 'rubric_prong', 'rubric_evidence',
    'actors', 'actor_roles', 'entities', 'offices', 'evidence_grade', 'evidence_note', 'evidentiary_status',
    'procedural_status', 'subject_response', 'status_note', 'amounts', 'sources', 'first_published_at',
    'last_modified_at', 'last_verified_at', 'approved_by', 'approved_digest', 'related_ids', 'tags', 'placeholder'],
  amount: ['usd', 'amount_type', 'actual_or_estimated', 'basis', 'overlap_group'],
  source: ['outlet', 'title', 'url', 'archive_url', 'date', 'author', 'kind'],
} as const;
