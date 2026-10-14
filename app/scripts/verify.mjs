// npm run verify: the adversarial fixture suite. `npm run build` runs it after
// the prerender, so a build that lets any gate slip does not succeed.
//
// Every case is a variant of the dataset actually in use (resolved by
// scripts/dataset-dir.mjs, as the build resolves it), prerendered into a
// throwaway copy of dist/ (PRERENDER_DIST), never the real one:
//   - builds that must FAIL, one per admission gate, each with the reason and
//     record it must print;
//   - builds that must SUCCEED (an attributed guilt phrase; a grade-1 finding);
//   - a build with planted secrets, searched file by file;
//   - a stale page and feed, which the prerender must remove;
//   - the pure-TypeScript SHA-256 against node:crypto.
// Variants that change approval-bound content are re-approved with the same
// code the approve tool uses, so the gate under test fires, not the approval
// gate (the approval gate has its own cases).
import { spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { APP_DIR, resolveDatasetDir } from './dataset-dir.mjs';
import { loadSiteModule } from './compile-ssr.mjs';

const dist = path.join(APP_DIR, 'dist');
const results = [];
const record = (name, ok, note) => {
  results.push({ name, ok });
  console.log(`verify: ${ok ? 'PASS' : 'FAIL'} ${name}${note ? ` -> ${note}` : ''}`);
};
const die = (msg) => { console.error(`verify: ${msg}`); process.exit(1); };

if (!existsSync(path.join(dist, 'index.html'))) die('dist/index.html is missing; run `npm run build` (it runs verify after the prerender).');

let dataset;
try { dataset = resolveDatasetDir(process.env); } catch (err) { die(err.message); }
const raw = JSON.parse(readFileSync(path.join(dataset.dir, 'entries.json'), 'utf8'));
const rawCorrections = existsSync(path.join(dataset.dir, 'corrections.json'))
  ? JSON.parse(readFileSync(path.join(dataset.dir, 'corrections.json'), 'utf8'))
  : [];
console.log(`verify: dataset ${dataset.label}`);

const site = await loadSiteModule();
const clone = (v) => JSON.parse(JSON.stringify(v));
const scratch = mkdtempSync(path.join(tmpdir(), 'ethics-verify-'));
let n = 0;

/** A throwaway dist/ holding the built index.html. */
function tempDist() {
  const d = path.join(scratch, `dist-${n++}`);
  mkdirSync(d, { recursive: true });
  copyFileSync(path.join(dist, 'index.html'), path.join(d, 'index.html'));
  return d;
}

/** Write a dataset variant; returns its directory. */
function variant(entries, corrections = rawCorrections) {
  const d = path.join(scratch, `data-${n++}`);
  mkdirSync(d, { recursive: true });
  writeFileSync(path.join(d, 'entries.json'), JSON.stringify(entries));
  writeFileSync(path.join(d, 'corrections.json'), JSON.stringify(corrections));
  return d;
}

/** Prerender a dataset variant into a throwaway dist. */
function prerender({ entries = raw, corrections = rawCorrections, env = {}, outDir = tempDist() } = {}) {
  const r = spawnSync(process.execPath, [path.join(APP_DIR, 'scripts', 'prerender.mjs')], {
    cwd: APP_DIR,
    encoding: 'utf8',
    env: {
      ...process.env,
      ALLOW_PLACEHOLDER_SITE_URL: '1',
      ALLOW_DATASET_DIR: '1',
      DATASET_DIR: variant(entries, corrections),
      PRERENDER_DIST: outDir,
      PRERENDER_REUSE_COMPILE: '1',
      ...env,
    },
  });
  return { status: r.status, out: `${r.stdout}${r.stderr}`, outDir };
}

/** Re-approve a record in place with the approve tool's own functions. */
function reapprove(r) {
  const v = site.validateForApproval(r);
  if ('code' in v) die(`cannot re-approve ${r.id} for a variant: ${v.reason}`);
  r.approved_by = site.EDITOR_NAME;
  r.approved_digest = site.recordDigest(v);
  return r;
}
function reapproveCorrection(c) {
  c.approved_by = site.EDITOR_NAME;
  c.approved_digest = site.correctionDigest(c);
  return c;
}

const published = (e) => !!e.first_published_at && Date.parse(e.first_published_at) <= Date.now();
const isPublic = (e) => e && e.approved_by && published(e);
const pick = (pred, what) => {
  const i = raw.findIndex((e) => isPublic(e) && pred(e));
  if (i < 0) die(`the dataset has no ${what} to build a variant from`);
  return i;
};
const rootIx = pick((e) => e.root_id === null, 'approved, published root record');
const g2Ix = pick((e) => e.evidence_grade === 2, 'approved grade-2 record');
const g3Ix = pick((e) => e.evidence_grade === 3, 'approved grade-3 record');
const g4Ix = pick((e) => e.evidence_grade === 4 && e.evidentiary_status !== 'retracted', 'approved grade-4 record');
const g1Ix = pick((e) => e.evidence_grade === 1, 'approved grade-1 record');
const draft = raw.find((e) => e && !e.approved_by);
if (!draft) die('the dataset has no draft (approved_by null); the leak cases need one');
const at = (i) => raw[i].id;

// ---------- 0. the hash ----------
{
  const samples = ['', 'abc', 'é “quoted” ✓ 🙂', 'a'.repeat(55), 'a'.repeat(56), 'a'.repeat(64)];
  for (let i = 0; i < 64; i++) samples.push(randomBytes(i * 5).toString('latin1'));
  const bad = samples.filter((s) => site.sha256Hex(s) !== createHash('sha256').update(s, 'utf8').digest('hex'));
  record('sha256Hex matches node:crypto', bad.length === 0, `${samples.length - bad.length}/${samples.length}`);
}

// ---------- 1. builds that must fail ----------
/** [name, variant(entries, corrections) -> {entries, corrections, env?}, regex the output must match] */
const MUST_FAIL = [
  ['duplicate: a draft followed by its approved twin', (e) => {
    const twin = { ...clone(e[rootIx]), approved_by: null, approved_digest: null, title: '[PLACEHOLDER] VERIFY DRAFT TWIN' };
    e.splice(rootIx, 0, twin);
  }, new RegExp(`\\[duplicate\\] duplicate id "${at(rootIx)}" at records #\\d+ and #\\d+`)],
  ['approval: content edited after approval (digest tamper)', (e) => { e[g2Ix].title += ' (edited after approval)'; },
    new RegExp(`\\(${at(g2Ix)}\\) \\[approval\\] approved_digest does not match`)],
  ['approval: approved_by is not the configured editor', (e) => { e[g2Ix].approved_by = 'Anyone At All'; },
    new RegExp(`\\(${at(g2Ix)}\\) \\[approval\\] approved_by "Anyone At All" is not the configured editor`)],
  ['approval: a draft given the editor\'s name but no digest', (e) => {
    const d = e.find((x) => x.id === draft.id); d.approved_by = site.EDITOR_NAME; d.approved_digest = null; d.first_published_at = '2026-01-01T00:00:00Z';
  }, new RegExp(`\\(${draft.id}\\) \\[approval\\] approved_by is set but approved_digest is missing`)],
  ['validation: an approved record with an unknown enum', (e) => { e[g2Ix].procedural_status = 'pending'; },
    new RegExp(`\\(${at(g2Ix)}\\) \\[invalid\\] unknown procedural_status`)],
  ['orphan: an approved record whose root is not public', (e) => { e[rootIx].root_id = 'p-verify-no-such-root'; reapprove(e[rootIx]); },
    new RegExp(`\\(${at(rootIx)}\\) \\[orphan\\]`)],
  ['rubric: an approved record naming only private actors at grade 4', (e) => {
    const t = e[g4Ix]; t.actors = ['Verify Relative']; t.actor_roles = { 'Verify Relative': 'family' };
  }, new RegExp(`\\(${at(g4Ix)}\\) \\[rubric\\]`)],
  ['actors: a number coerced into actors', (e) => { e[g2Ix].actors = [e[g2Ix].actors[0], 42]; },
    new RegExp(`\\(${at(g2Ix)}\\) \\[invalid\\] actors\\[1\\] is not a string`)],
  ['actors: a blank name', (e) => { e[g2Ix].actors = [e[g2Ix].actors[0], '   ']; },
    new RegExp(`\\(${at(g2Ix)}\\) \\[invalid\\] actors\\[1\\] is blank`)],
  ['actors: a name listed twice', (e) => { e[g2Ix].actors = [e[g2Ix].actors[0], e[g2Ix].actors[0]]; },
    new RegExp(`\\(${at(g2Ix)}\\) \\[invalid\\] actors lists .* twice`)],
  ['actors: an actor with no role', (e) => { e[g2Ix].actors = [e[g2Ix].actors[0], 'Verify Unlisted']; },
    new RegExp(`\\(${at(g2Ix)}\\) \\[invalid\\] actor "Verify Unlisted" has no valid role`)],
  ['actors: empty', (e) => { e[g2Ix].actors = []; }, new RegExp(`\\(${at(g2Ix)}\\) \\[invalid\\] actors must name at least one`)],
  ['entities: a non-string entry', (e) => { e[g2Ix].entities = ['ok', null]; },
    new RegExp(`\\(${at(g2Ix)}\\) \\[invalid\\] entities\\[1\\] is not a string`)],
  ['sources: none', (e) => { e[g2Ix].sources = []; }, new RegExp(`\\(${at(g2Ix)}\\) \\[invalid\\] has no sources`)],
  ['sources: grade 1 without a court filing, official report or admission', (e) => {
    e[g1Ix].sources.forEach((s) => { s.kind = 'news'; }); e[g1Ix].subject_response = 'denied';
  }, new RegExp(`\\(${at(g1Ix)}\\) \\[invalid\\] grade 1 needs`)],
  ['sources: grade 2 without a primary record', (e) => { e[g2Ix].sources.forEach((s) => { s.kind = 'news'; }); },
    new RegExp(`\\(${at(g2Ix)}\\) \\[invalid\\] grade 2 needs`)],
  ['sources: grade 3 without an investigation', (e) => { e[g3Ix].sources.forEach((s) => { s.kind = 'news'; }); },
    new RegExp(`\\(${at(g3Ix)}\\) \\[invalid\\] grade 3 needs a source of kind investigation`)],
  ['sources: grade 4 from a single outlet', (e) => { e[g4Ix].sources.forEach((s) => { s.outlet = 'One Outlet'; }); },
    new RegExp(`\\(${at(g4Ix)}\\) \\[invalid\\] grade 4 needs at least two sources from distinct outlets`)],
  ['sources: a non-http(s) url', (e) => { e[g2Ix].sources[0].url = 'javascript:alert(1)'; },
    new RegExp(`\\(${at(g2Ix)}\\) \\[url\\]`)],
  ['date: before 2025-01-20', (e) => { e[g2Ix].date = '2024-12-31'; },
    new RegExp(`\\(${at(g2Ix)}\\) \\[invalid\\] date 2024-12-31 is before 2025-01-20`)],
  ['summary: wrong opening verb for the grade', (e) => { e[g2Ix].summary = 'Reported: placeholder text for a grade 2 record.'; },
    new RegExp(`\\(${at(g2Ix)}\\) \\[invalid\\] summary must open with "Documented:"`)],
  ['summary: an unattributed guilt phrase below grade 1', (e) => {
    e[g2Ix].summary = 'Documented: placeholder filings show a sample transfer. The sample official bribed a placeholder agency.';
  }, new RegExp(`\\(${at(g2Ix)}\\) \\[invalid\\] summary asserts "bribed" without attribution`)],
  ['id: ".." as a record id', (e) => { e[g2Ix].id = '..'; }, /\(\.\.\) \[id\]/],
  ['correction: content edited after approval', (e, c) => { c[0].reason += ' Edited after approval.'; },
    /correction #0: approved_digest does not match/],
  ['correction: approved_by is not the configured editor', (e, c) => { c[0].approved_by = 'Anyone At All'; },
    /correction #0: approved_by "Anyone At All" is not the configured editor/],
  ['correction: field is not a schema path', (e, c) => { c[0].field = 'anything.at.all'; reapproveCorrection(c[0]); },
    /correction #0: field "anything.at.all" is not a schema path/],
  ['correction: text names a non-public record', (e, c) => {
    c[0].reason = `Background is in ${draft.id}.`; reapproveCorrection(c[0]);
  }, new RegExp(`correction #0 names non-public record "${draft.id}"`)],
  ['correction: a draft correction naming a non-public record', (e, c) => {
    c.push({ ...clone(c[0]), reason: `See ${draft.id}.`, approved_by: null, approved_digest: null });
  }, new RegExp(`correction #${rawCorrections.length} names non-public record "${draft.id}"`)],
  ['correction: names no public record', (e, c) => { c[0].record_id = draft.id; reapproveCorrection(c[0]); },
    new RegExp(`correction for "${draft.id}" names no record in the public dataset`)],
  ['SITE_URL: a loopback origin without ALLOW_PLACEHOLDER_SITE_URL', () => ({ env: { SITE_URL: 'https://localhost', ALLOW_PLACEHOLDER_SITE_URL: '' } }),
    /SITE_URL "https:\/\/localhost" is a loopback host/],
  ['DATASET_DIR: another directory without ALLOW_DATASET_DIR', () => ({ env: { ALLOW_DATASET_DIR: '' } }),
    /names a dataset other than app\/dataset\/; set ALLOW_DATASET_DIR=1/],
];
if (rawCorrections.length === 0) die('the dataset has no corrections; the correction cases need one');
for (const [name, mutate, expect] of MUST_FAIL) {
  const entries = clone(raw);
  const corrections = clone(rawCorrections);
  const extra = mutate(entries, corrections) ?? {};
  const r = prerender({ entries, corrections, env: extra.env ?? {} });
  const m = r.out.match(expect);
  record(`must fail: ${name}`, r.status !== 0 && !!m, `exit ${r.status}; ${m ? m[0] : `expected ${expect} not found`}`);
}

// ---------- 2. builds that must succeed ----------
{
  const entries = clone(raw);
  entries[g2Ix].summary = 'Documented: the sample filing alleged that the official bribed a placeholder agency.';
  reapprove(entries[g2Ix]);
  const r = prerender({ entries });
  record('must build: a guilt phrase attributed within six words', r.status === 0, `exit ${r.status}`);
}
{
  const entries = clone(raw);
  entries[g1Ix].summary = 'Found: the sample inspector found that the official committed a placeholder violation.';
  reapprove(entries[g1Ix]);
  const r = prerender({ entries });
  record('must build: a grade-1 finding may say "committed"', r.status === 0, `exit ${r.status}`);
}

// ---------- 3. planted secrets ----------
{
  const hidden = raw.filter((e) => e && (!e.approved_by || !published(e)));
  const entries = clone(raw);
  const host = entries[g2Ix];
  host.internal_notes = 'VERIFY-PLANT-INTERNAL-NOTE';
  host.sources[0].internal_source_note = 'VERIFY-PLANT-NESTED-NOTE';
  host.related_ids = [...(host.related_ids ?? []), ...hidden.map((e) => e.id)];
  reapprove(host);
  const corrections = clone(rawCorrections);
  corrections[0].internal_note = 'VERIFY-PLANT-CORRECTION-NOTE';
  const r = prerender({ entries, corrections });
  record('planted build succeeds', r.status === 0, `exit ${r.status}`);
  const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((x) => (x.isDirectory() ? walk(path.join(d, x.name)) : [path.join(d, x.name)]));
  const needles = ['VERIFY-PLANT-INTERNAL-NOTE', 'VERIFY-PLANT-NESTED-NOTE', 'VERIFY-PLANT-CORRECTION-NOTE', ...hidden.flatMap((e) => [e.id, e.title])];
  const enc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const hits = [];
  for (const f of walk(r.outDir)) {
    const text = readFileSync(f, 'utf8');
    for (const s of needles) if (text.includes(s) || text.includes(enc(s))) hits.push(`${path.relative(r.outDir, f)}: ${s}`);
  }
  record('no planted key, draft or unpublished id or title in any output file', hits.length === 0,
    hits.length ? hits.slice(0, 4).join('; ') : `${needles.length} needles, none found`);
}

// ---------- 4. stale output ----------
{
  const outDir = tempDist();
  mkdirSync(path.join(outDir, 'r', 'stale-zz'), { recursive: true });
  writeFileSync(path.join(outDir, 'r', 'stale-zz', 'index.html'), 'stale');
  mkdirSync(path.join(outDir, 'feeds', 'office'), { recursive: true });
  writeFileSync(path.join(outDir, 'feeds', 'office', 'stale-zz.xml'), 'stale');
  const r = prerender({ outDir });
  const gone = !existsSync(path.join(outDir, 'r', 'stale-zz')) && !existsSync(path.join(outDir, 'feeds', 'office', 'stale-zz.xml'));
  record('the prerender removes a stale record page and feed', r.status === 0 && gone, `exit ${r.status}; ${gone ? 'gone' : 'still present'}`);
}

rmSync(scratch, { recursive: true, force: true });
const failed = results.filter((x) => !x.ok).length;
console.log(`verify: ${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
