// Workflow: migrate verified schema-v1 entries to schema v2.
// Run with args: { n: <number of entries in data/entries.v1.json>, chunk: 6 }
// Prerequisite (bash, principal): assemble data/raw/verified/*.json into data/entries.v1.json with unique ids.
// Output: data/raw/migrated/chunk_<k>.json (schema v2, approved_by null), data/raw/migrated/roots.json
// Post-step (bash, principal): merge chunks, apply root assignments, validate against docs/schema.md, archive URLs via Wayback.

export const meta = {
  name: 'migrate-entries-v2',
  description: 'Re-read sources and assign schema v2 fields (evidence grade, rubric prong, actor roles, offices, amount types, three statuses) to every verified entry; then link root/child trees',
  phases: [
    { title: 'Migrate', detail: 'one Sonnet 5.5 agent per chunk of entries, sources re-read' },
    { title: 'Link', detail: 'one Opus 5.5 agent per month assigns root/child trees and overlap groups' },
    { title: 'Audit', detail: 'Opus 5.5 spot-check of a 10% sample' },
  ],
}

const ROOT = '/Users/sam.vangelos/Projects/personal/corruption-ticker'
const N = args && args.n ? args.n : 0
const CHUNK = args && args.chunk ? args.chunk : 6
if (!N) throw new Error('pass args.n = number of entries in data/entries.v1.json')

const STATS = { type: 'object', properties: { migrated: { type: 'number' }, flagged: { type: 'array', items: { type: 'string' } }, file_written: { type: 'string' } }, required: ['migrated', 'file_written'] }
const LINK = { type: 'object', properties: { assignments: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, root_id: { type: ['string', 'null'] }, overlap_group: { type: ['string', 'null'] } }, required: ['id', 'root_id'] } } }, required: ['assignments'] }
const AUDIT = { type: 'object', properties: { checked: { type: 'number' }, wrong_grade: { type: 'array', items: { type: 'string' } }, wrong_prong: { type: 'array', items: { type: 'string' } }, notes: { type: 'string' } }, required: ['checked'] }

const RULES = `SCHEMA v2 is defined in ${ROOT}/docs/schema.md; read it in full first. Key rules: evidence_grade 1 adjudicated/official finding; 2 primary records establishing material facts, reported on by an outlet; 3 document-based journalistic investigation; 4 allegation corroborated by two outlets with separate reporting (not shared wire copy) or unrelated witnesses; 5 single-source allegation. rubric_prong is private-gain or abuse-of-office with rubric_evidence naming the fact. actor_roles per actor: public-official | family | private-associate | private-entity. offices: the departments/agencies/White House offices involved (use the official name). amounts[]: convert dollar_amount_usd + dollar_basis into {usd, amount_type (private-benefit | public-funds | face-value | exposure), actual_or_estimated, basis}; leave overlap_group null (assigned later); if no defensible figure, amounts is []. Status split: evidentiary_status (finding | documented | corroborated | alleged | retracted) must agree with the grade; procedural_status (none | under-investigation | litigation | resolved | dismissed); subject_response (denied | no-comment | admitted | not-sought | retracted-by-outlet | null) from what the sources say. sources[].kind per source. Add last_verified_at = today's ISO timestamp, first_published_at null, last_modified_at null, approved_by null, root_id null. Rewrite the summary so its verb matches the grade (found / documented / reported / alleged (corroborated) / alleged). Never invent a source; if a grade cannot be supported by the sources you can read, assign the lower grade.`

phase('Migrate')
const chunks = []
for (let i = 0; i < N; i += CHUNK) chunks.push({ k: chunks.length, start: i, end: Math.min(N, i + CHUNK) })
const migrated = await parallel(chunks.map(c => () => agent(
  `${RULES}\n\nTASK: Read ${ROOT}/data/entries.v1.json and take entries at indices ${c.start} to ${c.end - 1} (0-based). First call ToolSearch "select:WebFetch,WebSearch". For each entry, WebFetch every listed source URL (search for a replacement at the same outlet if one is dead) and assign every schema v2 field from what the sources actually establish. Write the migrated entries as a JSON array to ${ROOT}/data/raw/migrated/chunk_${String(c.k).padStart(3, '0')}.json (create the directory if needed). Return the count, ids you flagged as doubtful, and the file path.`,
  { label: `migrate:${c.k}`, phase: 'Migrate', schema: STATS, model: 'sonnet' })))
const done = migrated.filter(Boolean)
log(`${done.reduce((n, r) => n + r.migrated, 0)} entries migrated across ${done.length}/${chunks.length} chunks; flagged: ${done.reduce((n, r) => n + (r.flagged || []).length, 0)}`)

phase('Link')
const MONTHS = ['2025-01','2025-02','2025-03','2025-04','2025-05','2025-06','2025-07','2025-08','2025-09','2025-10','2025-11','2025-12','2026-01','2026-02','2026-03','2026-04','2026-05','2026-06','2026-07','2026-08','2026-09','2026-10']
const links = await parallel(MONTHS.map(m => () => agent(
  `${RULES}\n\nTASK: Root/child linking for ${m}. Read every file in ${ROOT}/data/raw/migrated/ and collect the entries whose date starts with "${m}" plus any entry from an earlier month that is plainly the same underlying matter (same deal, same pardon, same firing, same filing). Decide which entries are developments of an earlier root: set root_id to the earliest entry's id for children, null for roots. For entries in the same tree that carry amounts describing the same money, assign the same overlap_group string (e.g. "qatar-747"). Return assignments for every entry you examined with a date in ${m}.`,
  { label: `link:${m}`, phase: 'Link', schema: LINK, model: 'opus' })))
const assignments = links.filter(Boolean).flatMap(r => r.assignments)
log(`${assignments.length} root/child assignments`)

phase('Audit')
const audit = await agent(
  `${RULES}\n\nTASK: Audit a 10% sample. Read ${ROOT}/data/raw/migrated/*.json, pick every tenth entry by file order, and for each re-read one source and check evidence_grade, rubric_prong, actor_roles, and amount_type. Return the ids whose grade or prong is wrong, with the correct value in notes.`,
  { label: 'audit', phase: 'Audit', schema: AUDIT, model: 'opus' })

return { chunks: chunks.length, migrated: done.reduce((n, r) => n + r.migrated, 0), flagged: done.flatMap(r => r.flagged || []), assignments, audit }
