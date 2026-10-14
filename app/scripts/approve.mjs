// npm run approve -- <id> [<id>...]          approve records by id
// npm run approve -- --correction <n> [...]   approve corrections by index in corrections.json
// npm run approve -- --check                  report every approval that no longer matches
//
// Approval binds the editor's name to the exact content approved
// (docs/schema.md § Admission controls). For each record, the tool validates
// it in full (an invalid record cannot be approved), computes approved_digest
// (SHA-256 of the canonical JSON of its schema projection, approval fields
// excluded) and writes approved_by (the editor in app/editor.json) and
// approved_digest into the dataset file. Any later edit changes the digest,
// and the build fails until the record is approved again.
//
// The dataset directory is resolved exactly as the build resolves it
// (scripts/dataset-dir.mjs): DATASET_DIR needs ALLOW_DATASET_DIR=1.
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { resolveDatasetDir } from './dataset-dir.mjs';
import { loadSiteModule } from './compile-ssr.mjs';

const fail = (msg) => { console.error(`approve: ${msg}`); process.exit(1); };

const args = process.argv.slice(2);
const check = args.includes('--check');
const ids = [];
const correctionIx = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--check') continue;
  if (a === '--correction') {
    const n = Number(args[++i]);
    if (!Number.isInteger(n) || n < 0) fail(`--correction needs a non-negative index, got "${args[i]}"`);
    correctionIx.push(n);
  } else if (a.startsWith('-')) {
    fail(`unknown option ${a}`);
  } else {
    ids.push(a);
  }
}
if (!check && ids.length === 0 && correctionIx.length === 0) {
  fail('usage: npm run approve -- <id> [<id>...] | --correction <n> | --check');
}

let dataset;
try { dataset = resolveDatasetDir(process.env); } catch (err) { fail(err.message); }
const entriesPath = path.join(dataset.dir, 'entries.json');
const correctionsPath = path.join(dataset.dir, 'corrections.json');
const entries = JSON.parse(await readFile(entriesPath, 'utf8'));
const corrections = existsSync(correctionsPath) ? JSON.parse(await readFile(correctionsPath, 'utf8')) : [];
if (!Array.isArray(entries)) fail(`${entriesPath} is not a JSON array`);

const site = await loadSiteModule();
const editor = site.EDITOR_NAME;

/** Put approved_by and approved_digest together, where approved_by sits (or at the end). */
function withApproval(obj, digest) {
  const out = {};
  let placed = false;
  for (const [k, v] of Object.entries(obj)) {
    if (k === 'approved_digest') continue;
    if (k === 'approved_by') {
      out.approved_by = editor;
      out.approved_digest = digest;
      placed = true;
    } else {
      out[k] = v;
    }
  }
  if (!placed) { out.approved_by = editor; out.approved_digest = digest; }
  return out;
}

/** Digest of a raw record, or the reason it cannot be approved. */
function digestOf(raw) {
  const v = site.validateForApproval(raw);
  return 'code' in v ? { error: `[${v.code}] ${v.reason}` } : { digest: site.recordDigest(v) };
}

/** Digest of a raw correction, or the reason it cannot be approved. */
function correctionDigestOf(c) {
  if (!c || typeof c !== 'object' || Array.isArray(c)) return { error: 'not an object' };
  if (typeof site.checkCorrectionShape === 'function') {
    const why = site.checkCorrectionShape(c);
    if (why) return { error: why };
  }
  return { digest: site.correctionDigest(c) };
}

if (check) {
  const problems = [];
  entries.forEach((r, i) => {
    if (!r || typeof r !== 'object' || r.approved_by === null || r.approved_by === undefined) return;
    const id = r.id ?? `#${i}`;
    if (r.approved_by !== editor) problems.push(`record ${id}: approved_by "${r.approved_by}" is not the configured editor "${editor}"`);
    const d = digestOf(r);
    if (d.error) problems.push(`record ${id}: cannot be approved as written: ${d.error}`);
    else if (!r.approved_digest) problems.push(`record ${id}: has no approved_digest`);
    else if (r.approved_digest !== d.digest) problems.push(`record ${id}: approved_digest does not match its content (edited after approval)`);
  });
  if (Array.isArray(corrections)) {
    corrections.forEach((c, i) => {
      if (!c || typeof c !== 'object' || c.approved_by === null || c.approved_by === undefined) return;
      if (c.approved_by !== editor) problems.push(`correction #${i}: approved_by "${c.approved_by}" is not the configured editor "${editor}"`);
      const d = correctionDigestOf(c);
      if (d.error) problems.push(`correction #${i}: cannot be approved as written: ${d.error}`);
      else if (c.approved_digest !== d.digest) problems.push(`correction #${i} (${c.record_id}): approved_digest does not match its content`);
    });
  }
  const approvedRecords = entries.filter((r) => r && r.approved_by != null).length;
  console.log(`approve --check: dataset ${dataset.label}; ${approvedRecords} approved records checked`);
  for (const p of problems) console.log(`  MISMATCH ${p}`);
  console.log(problems.length ? `approve --check: ${problems.length} problem(s)` : 'approve --check: every approval matches');
  process.exit(problems.length ? 1 : 0);
}

let changedEntries = false;
for (const id of ids) {
  const at = entries.map((r, i) => (r && r.id === id ? i : -1)).filter((i) => i >= 0);
  if (at.length === 0) fail(`no record has id "${id}"`);
  if (at.length > 1) fail(`id "${id}" appears at records #${at.join(' and #')}; fix the duplicate first`);
  const d = digestOf(entries[at[0]]);
  if (d.error) fail(`record ${id} cannot be approved: ${d.error}`);
  entries[at[0]] = withApproval(entries[at[0]], d.digest);
  changedEntries = true;
  console.log(`approve: ${id} approved by ${editor}, digest ${d.digest.slice(0, 12)}…`);
}
let changedCorrections = false;
for (const n of correctionIx) {
  if (!Array.isArray(corrections) || !corrections[n]) fail(`there is no correction #${n}`);
  const d = correctionDigestOf(corrections[n]);
  if (d.error) fail(`correction #${n} cannot be approved: ${d.error}`);
  corrections[n] = withApproval(corrections[n], d.digest);
  changedCorrections = true;
  console.log(`approve: correction #${n} (${corrections[n].record_id}) approved by ${editor}, digest ${d.digest.slice(0, 12)}…`);
}
if (changedEntries) await writeFile(entriesPath, `${JSON.stringify(entries, null, 2)}\n`);
if (changedCorrections) await writeFile(correctionsPath, `${JSON.stringify(corrections, null, 2)}\n`);
console.log(`approve: wrote ${[changedEntries && entriesPath, changedCorrections && correctionsPath].filter(Boolean).join(' and ')}`);
