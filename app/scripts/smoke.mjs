// Smoke test for the built site. Run with `npm run smoke`.
//
// 1. Builds the site (`npm run build`) with ALLOW_PLACEHOLDER_SITE_URL=1 unless
//    SITE_URL is set. SMOKE_SKIP_BUILD=1 tests the dist/ already on disk.
// 2. Serves dist/ with `vite preview` on a free port (bound by listening on
//    port 0), so nothing already listening can answer in its place, and
//    requires every page to carry this build's id from dist/build.json.
// 3. Checks, all against data recounted here independently of the app's code:
//    - the leak: no unapproved, rubric-failing or unpublished record from
//      dataset/ appears in /data/entries.json, the front page, or dist/r/;
//    - every id is URL-safe;
//    - the visible front-page headline (the SPA's Headline component, rendered
//      into the HTML at build time) and its og:description equal the recount;
//    - the fixture still separates the tree-based event rule from a rule that
//      counts only qualifying roots;
//    - every record page answers 200, and its decoded og:title and <h1> equal
//      the record's title;
//    - /feed.xml and every per-office and per-category feed hold exactly the
//      qualifying records they should, with <updated> per the correction rule;
//    - corrections name public records; each route is its own page.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolveDatasetDir } from './dataset-dir.mjs';
import { loadSiteModule } from './compile-ssr.mjs';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const encode = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const dist = path.join(appDir, 'dist');
const viteBin = path.join(appDir, 'node_modules', 'vite', 'bin', 'vite.js');

// ---------- helpers for builds ----------
const checks = [];
const record = (name, ok, note) => {
  checks.push({ name, ok, note });
  console.log(`smoke: ${ok ? 'PASS' : 'FAIL'} ${name}${note ? ` -> ${note}` : ''}`);
};

// The dataset, resolved exactly as the prerender resolves it (one module).
let dataset;
try { dataset = resolveDatasetDir(process.env); } catch (err) { console.error(`smoke: ${err.message}`); process.exit(1); }
const raw = JSON.parse(readFileSync(path.join(dataset.dir, 'entries.json'), 'utf8'));
const rawCorrections = existsSync(path.join(dataset.dir, 'corrections.json'))
  ? JSON.parse(readFileSync(path.join(dataset.dir, 'corrections.json'), 'utf8'))
  : [];
console.log(`smoke: dataset ${dataset.label}`);

const buildEnv = (extra = {}) => {
  const env = { ...process.env, ...extra };
  if (!env.SITE_URL) env.ALLOW_PLACEHOLDER_SITE_URL = '1';
  return env;
};
const run = (args, env) => spawnSync(process.execPath, args, { cwd: appDir, env, encoding: 'utf8' });
const prerender = (env) => run([path.join(appDir, 'scripts', 'prerender.mjs')], env);

/** Write a variant of the dataset to a fresh temp directory; returns its path. */
function variant(name, entries, corrections = rawCorrections) {
  const dir = mkdtempSync(path.join(tmpdir(), `ethics-smoke-${name}-`));
  writeFileSync(path.join(dir, 'entries.json'), JSON.stringify(entries));
  writeFileSync(path.join(dir, 'corrections.json'), JSON.stringify(corrections));
  return dir;
}
const clone = (v) => JSON.parse(JSON.stringify(v));

// Variants that change digest-bound content are re-approved, so the gate
// under test fires rather than the approval gate.
const site = await loadSiteModule({ reuse: true });
function reapprove(r) {
  const v = site.validateForApproval(r);
  if ('code' in v) throw new Error(`smoke: cannot re-approve ${r.id}: ${v.reason}`);
  r.approved_by = site.EDITOR_NAME;
  r.approved_digest = site.recordDigest(v);
  return r;
}

/** Every file under dir, recursively. */
const walk = (dir) => readdirSync(dir, { withFileTypes: true })
  .flatMap((d) => (d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)]));

// ---------- 1. build ----------
if (process.env.SMOKE_SKIP_BUILD !== '1') {
  const npm = process.env.npm_execpath;
  const env = buildEnv();
  const r = npm
    ? spawnSync(process.execPath, [npm, 'run', 'build'], { cwd: appDir, env, encoding: 'utf8' })
    : spawnSync('npm', ['run', 'build'], { cwd: appDir, env, encoding: 'utf8' });
  if (r.status !== 0) {
    console.error(`smoke: build failed (exit ${r.status})\n${r.stdout}${r.stderr}`);
    process.exit(1);
  }
  console.log('smoke: build ok');

  // ---------- 1a. builds that must fail ----------
  // Derived from the dataset in use: its first approved, published record.
  const isPublished = (e) => !!e.first_published_at && Date.parse(e.first_published_at) <= Date.now();
  const approvedIx = raw.findIndex((e) => e.approved_by && isPublished(e) && e.root_id === null);
  const target = raw[approvedIx];
  if (!target) {
    record('dataset has an approved, published root record to break', false, 'none found');
  } else {
    const mustFail = [];
    // Item 1's reproduction: a draft, then its approved twin with the same id.
    {
      const d = clone(raw);
      const draft = { ...clone(target), approved_by: null, title: '[PLACEHOLDER] SMOKE DRAFT TWIN TEXT' };
      d.splice(approvedIx, 0, draft);
      mustFail.push(['a draft followed by its approved twin (same id)', d, new RegExp(`\\[duplicate\\] duplicate id "${target.id}" at records #\\d+ and #\\d+`)]);
    }
    {
      const d = clone(raw); d[approvedIx].procedural_status = 'pending';
      mustFail.push(['an approved record that fails validation', d, new RegExp(`\\(${target.id}\\) \\[invalid\\]`)]);
    }
    {
      const d = clone(raw); d[approvedIx].root_id = 'p-smoke-no-such-root'; reapprove(d[approvedIx]);
      mustFail.push(['an approved record whose root is not public', d, new RegExp(`\\(${target.id}\\) \\[orphan\\]`)]);
    }
    {
      const d = clone(raw); const t = d[approvedIx];
      t.actors = ['Smoke Relative']; t.actor_roles = { 'Smoke Relative': 'family' }; t.evidence_grade = 4; t.evidentiary_status = 'corroborated';
      mustFail.push(['an approved record that fails the private-actor rubric', d, new RegExp(`\\(${target.id}\\) \\[rubric\\]`)]);
    }
    for (const [name, entries, expect] of mustFail) {
      const r2 = prerender(buildEnv({ ALLOW_DATASET_DIR: '1', DATASET_DIR: variant('fail', entries) }));
      const out = `${r2.stdout}${r2.stderr}`;
      record(`build fails: ${name}`, r2.status !== 0 && expect.test(out), `exit ${r2.status}; ${(out.match(expect) ?? ['expected message not found'])[0]}`);
    }
  }

  // ---------- 1b. a build with planted secrets ----------
  // An unknown top-level key, an unknown nested key, and related_ids pointing
  // at every draft and unpublished record: none may appear anywhere in dist/.
  {
    const hidden = raw.filter((e) => !e.approved_by || !isPublished(e));
    const d = clone(raw);
    const host = d.find((e) => e.approved_by && isPublished(e));
    host.internal_notes = 'SMOKE-PLANT-INTERNAL-NOTE';
    if (host.sources?.[0]) host.sources[0].internal_source_note = 'SMOKE-PLANT-NESTED-NOTE';
    host.related_ids = [...(host.related_ids ?? []), ...hidden.map((e) => e.id)];
    reapprove(host);
    const r3 = prerender(buildEnv({ ALLOW_DATASET_DIR: '1', DATASET_DIR: variant('plant', d) }));
    record('planted build succeeds', r3.status === 0, `exit ${r3.status}`);
    const needles = ['SMOKE-PLANT-INTERNAL-NOTE', 'SMOKE-PLANT-NESTED-NOTE', ...hidden.flatMap((e) => [e.id, e.title])];
    const hits = [];
    for (const f of walk(dist)) {
      const text = readFileSync(f, 'utf8');
      for (const n of needles) if (text.includes(n) || text.includes(encode(n))) hits.push(`${path.relative(dist, f)}: ${n}`);
    }
    record('no planted key, draft or unpublished id or title anywhere in dist/', hits.length === 0 && needles.length > 2,
      hits.length ? hits.slice(0, 5).join('; ') : `${needles.length} needles, none found`);
  }

  // ---------- 1c. the real prerender, over a planted stale page ----------
  mkdirSync(path.join(dist, 'r', 'stale-zz'), { recursive: true });
  writeFileSync(path.join(dist, 'r', 'stale-zz', 'index.html'), 'stale');
  const r4 = prerender(buildEnv());
  if (r4.status !== 0) {
    console.error(`smoke: prerender failed (exit ${r4.status})\n${r4.stdout}${r4.stderr}`);
    process.exit(1);
  }
  record('npm run prerender removes a stale dist/r/stale-zz', !existsSync(path.join(dist, 'r', 'stale-zz')), 'gone');
}
if (!existsSync(path.join(dist, 'build.json'))) {
  console.error('smoke: dist/build.json is missing; the build did not finish.');
  process.exit(1);
}
const stamp = JSON.parse(readFileSync(path.join(dist, 'build.json'), 'utf8'));
record('dist/build.json names the dataset this smoke test read', stamp.dataset?.label === dataset.label, `${stamp.dataset?.label} vs ${dataset.label}`);
const builtAtMs = Date.parse(stamp.builtAt);

// ---------- 2. serve on a free port ----------
const port = await new Promise((resolve, reject) => {
  const s = createServer();
  s.on('error', reject);
  s.listen(0, '127.0.0.1', () => {
    const p = s.address().port;
    s.close(() => resolve(p));
  });
});
const base = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, [viteBin, 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
  cwd: appDir,
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverLog = '';
server.stdout.on('data', (d) => { serverLog += d; });
server.stderr.on('data', (d) => { serverLog += d; });
const stop = () => { if (!server.killed) server.kill('SIGTERM'); };
process.on('exit', stop);

async function waitForServer(timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (server.exitCode !== null) throw new Error(`vite preview exited early (code ${server.exitCode}).\n${serverLog}`);
    try { await fetch(`${base}/`); return; } catch { await new Promise((r) => setTimeout(r, 150)); }
  }
  throw new Error(`vite preview did not answer within ${timeoutMs} ms.\n${serverLog}`);
}

// ---------- helpers ----------
/** GET a path; require 200 (and, for HTML, this build's stamp); then validate(body) returns true or a failure note. */
async function check(urlPath, validate, { html = false } = {}) {
  let body = '';
  try {
    const res = await fetch(base + urlPath);
    body = await res.text();
    if (res.status !== 200) { record(`GET ${urlPath}`, false, `HTTP ${res.status}`); return body; }
    if (html) {
      const id = metas(body).get('build-id');
      if (id !== stamp.id) { record(`GET ${urlPath}`, false, `build-id ${id ?? 'missing'}, expected ${stamp.id}: this server is not serving this build`); return body; }
    }
    const v = validate ? validate(body) : true;
    record(`GET ${urlPath}`, v === true, v === true ? 'HTTP 200' : `HTTP 200, ${v}`);
  } catch (e) {
    record(`GET ${urlPath}`, false, `request failed (${e.message})`);
  }
  return body;
}

const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
/** Decode HTML/XML character references: named (the common set), decimal and hex. */
const decode = (s) => s.replace(/&(#[xX][0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (m, e) => {
  if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
  return NAMED[e.toLowerCase()] ?? m;
});
/** Every <meta> keyed by its property or name attribute, content decoded; attribute order does not matter. */
function metas(html) {
  const out = new Map();
  for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = Object.fromEntries([...tag.matchAll(/([a-zA-Z:-]+)\s*=\s*"([^"]*)"/g)].map(([, k, v]) => [k.toLowerCase(), v]));
    const key = attrs.property ?? attrs.name;
    if (key && attrs.content !== undefined && !out.has(key)) out.set(key, decode(attrs.content));
  }
  return out;
}

/** Visible text of the first element carrying `cls`, tags and comments stripped, entities decoded, whitespace collapsed. */
function textOf(html, tag, cls) {
  const m = new RegExp(`<${tag}\\b[^>]*class="[^"]*\\b${cls}\\b[^"]*"[^>]*>([\\s\\S]*?)</${tag}>`).exec(html);
  if (!m) return null;
  return decode(m[1].replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
}

const ID_RE = /^[a-z0-9][a-z0-9-]{2,120}$/;
const plural = (n, one, many) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;
const slug = (n) => n.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const treeOf = (e) => (e.root_id === null ? e.id : e.root_id);

// ---------- 3. checks ----------
try {
  await waitForServer();
  console.log(`smoke: serving dist/ on free port ${port}, build ${stamp.id}`);

  // The stamp: proves the server answering is serving this build.
  const home = await check('/', (body) => (body.includes('<div id="root">') ? true : 'root element missing'), { html: true });

  // The public dataset.
  let entries = [];
  await check('/data/entries.json', (body) => {
    const parsed = JSON.parse(body);
    if (!Array.isArray(parsed) || parsed.length === 0) return 'not a non-empty array';
    entries = parsed;
    const bad = parsed.filter((e) => !ID_RE.test(e.id));
    return bad.length ? `ids not URL-safe: ${bad.map((e) => e.id).join(', ')}` : true;
  });
  const publicIds = new Set(entries.map((e) => e.id));

  // The public dataset is a projection: schema keys only, at every level.
  const KEYS = {
    entry: new Set(['id', 'root_id', 'date', 'date_precision', 'title', 'summary', 'category', 'rubric_prong', 'rubric_evidence',
      'actors', 'actor_roles', 'entities', 'offices', 'evidence_grade', 'evidence_note', 'evidentiary_status',
      'procedural_status', 'subject_response', 'status_note', 'amounts', 'sources', 'first_published_at',
      'last_modified_at', 'last_verified_at', 'approved_by', 'approved_digest', 'related_ids', 'tags', 'placeholder']),
    amount: new Set(['usd', 'amount_type', 'actual_or_estimated', 'basis', 'overlap_group']),
    source: new Set(['outlet', 'title', 'url', 'archive_url', 'date', 'author', 'kind']),
  };
  const extra = [];
  for (const e of entries) {
    for (const k of Object.keys(e)) if (!KEYS.entry.has(k)) extra.push(`${e.id}.${k}`);
    for (const a of e.amounts ?? []) for (const k of Object.keys(a)) if (!KEYS.amount.has(k)) extra.push(`${e.id}.amounts.${k}`);
    for (const x of e.sources ?? []) for (const k of Object.keys(x)) if (!KEYS.source.has(k)) extra.push(`${e.id}.sources.${k}`);
  }
  const danglingRelated = entries.flatMap((e) => (e.related_ids ?? []).filter((r) => !publicIds.has(r)).map((r) => `${e.id} -> ${r}`));
  record('public records carry schema keys only', extra.length === 0, extra.length ? extra.join(', ') : 'ok');
  record('related_ids point only at public records', danglingRelated.length === 0, danglingRelated.join(', ') || 'ok');

  // The leak: unapproved and rubric-failing raw records never reach the public.
  // Derived from the dataset actually used (the shared resolver above).
  const PRIVATE = new Set(['family', 'private-associate', 'private-entity']);
  const failsRubric = (e) => {
    const roles = (e.actors ?? []).map((a) => e.actor_roles?.[a]);
    return roles.length > 0 && roles.every((r) => PRIVATE.has(r))
      && (e.evidence_grade > 3 || e.subject_response === null || e.subject_response === 'not-sought');
  };
  // Not public: unapproved, rubric-failing, or not yet published at build time.
  const unpublished = (e) => !e.first_published_at || Date.parse(e.first_published_at) > builtAtMs;
  const secret = raw.filter((e) => !e.approved_by || failsRubric(e) || unpublished(e));
  record('fixture has an approved_by null record', raw.some((e) => !e.approved_by), 'without one the leak check proves nothing');
  for (const e of secret) {
    record(`${e.id} absent from /data/entries.json`, !publicIds.has(e.id), publicIds.has(e.id) ? 'LEAKED' : 'absent');
    const page = existsSync(path.join(dist, 'r', e.id));
    record(`${e.id} has no page in dist/r/`, !page, page ? 'a record page was generated' : 'absent');
    const named = home.includes(e.id) || home.includes(encode(e.title));
    record(`${e.id} not named in the front-page HTML`, !named, named ? 'LEAKED' : 'absent');
  }
  const missing = raw.filter((e) => !secret.includes(e) && !publicIds.has(e.id));
  record('every approved, rubric-passing, published raw record is public', missing.length === 0, missing.length ? `missing: ${missing.map((e) => e.id).join(', ')}` : `${entries.length} records`);

  // Independent recount (docs/schema.md § Counting rules), at the build's own clock.
  const qualifies = (e) => Number.isInteger(e.evidence_grade) && e.evidence_grade >= 1 && e.evidence_grade <= 4
    && e.evidentiary_status !== 'retracted' && !!e.approved_by
    && !!e.first_published_at && Date.parse(e.first_published_at) <= builtAtMs;
  const qualifying = entries.filter(qualifies);
  const events = new Set(qualifying.map(treeOf)).size;
  const rootsOnly = qualifying.filter((e) => e.root_id === null).length;
  const headline = `${plural(qualifying.length, 'qualifying record', 'qualifying records')} concerning ${plural(events, 'distinct event', 'distinct events')} since 20 January 2025.`;
  const byId = new Map(entries.map((e) => [e.id, e]));
  const childUnderNonQualifyingRoot = qualifying.some((e) => e.root_id !== null && !qualifies(byId.get(e.root_id)));
  record('fixture separates the tree event rule from a roots-only rule', childUnderNonQualifyingRoot && events !== rootsOnly,
    `${events} events by tree, ${rootsOnly} by qualifying roots`);
  const visible = textOf(home, 'p', 'headline__text');
  record('visible front-page headline equals the recount', visible === headline, `"${visible}" vs "${headline}"`);
  const og = metas(home).get('og:description') ?? '';
  record('front-page og:description states the recount', og.includes(headline), og.slice(0, 90));

  // Every record page: 200, this build, og:title and <h1> equal to the title.
  let pagesOk = 0;
  for (const e of entries) {
    const before = checks.length;
    await check(`/r/${e.id}/`, (body) => {
      const t = metas(body).get('og:title');
      if (t !== e.title) return `og:title "${t}" is not "${e.title}"`;
      const h1 = textOf(body, 'h1', 'drawer__title');
      return h1 === e.title ? true : `<h1> "${h1}" is not the title`;
    }, { html: true });
    if (checks.slice(before).every((c) => c.ok)) pagesOk += 1;
  }
  record('every record page carries its title', pagesOk === entries.length, `${pagesOk}/${entries.length}`);

  // Feeds: qualifying records only, newest 50, <updated> per the correction rule.
  let corrections = [];
  await check('/data/corrections.json', (body) => {
    corrections = JSON.parse(body);
    if (!Array.isArray(corrections)) return 'not an array';
    const orphans = corrections.filter((c) => !publicIds.has(c.record_id));
    return orphans.length ? `corrections name non-public records: ${orphans.map((c) => c.record_id).join(', ')}` : true;
  });
  const updated = (e) => Math.max(Date.parse(e.first_published_at), e.last_modified_at ? Date.parse(e.last_modified_at) : 0,
    ...corrections.filter((c) => c.record_id === e.id).map((c) => Date.parse(`${c.date}T00:00:00Z`)));
  const newest = (list) => [...list].sort((a, b) => Date.parse(b.first_published_at) - Date.parse(a.first_published_at) || a.id.localeCompare(b.id)).slice(0, 50);
  const feedEntries = (xml) => [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(([, e]) => ({
    id: decode(/<id>([^<]*)<\/id>/.exec(e)?.[1] ?? '').replace(/^.*\/r\/([^/]+)\/$/, '$1'),
    updated: /<updated>([^<]*)<\/updated>/.exec(e)?.[1] ?? '',
  }));
  const feedMatches = (want) => (body) => {
    if (!/<feed\s+xmlns="http:\/\/www\.w3\.org\/2005\/Atom"/.test(body)) return 'not an Atom feed';
    const got = feedEntries(body);
    const wantIds = newest(want).map((e) => e.id);
    if (got.map((g) => g.id).join() !== wantIds.join()) return `entries [${got.map((g) => g.id).join(', ')}] are not [${wantIds.join(', ')}]`;
    const wrong = got.find((g) => Date.parse(g.updated) !== updated(byId.get(g.id)));
    return wrong ? `${wrong.id} <updated> ${wrong.updated} is not ${new Date(updated(byId.get(wrong.id))).toISOString()}` : true;
  };
  await check('/feed.xml', feedMatches(qualifying));
  const cats = [...new Set(qualifying.map((e) => e.category))].sort();
  const offices = [...new Set(qualifying.flatMap((e) => e.offices))].sort();
  const files = (dir) => (existsSync(path.join(dist, 'feeds', dir)) ? readdirSync(path.join(dist, 'feeds', dir)).sort() : []);
  const wantCats = cats.map((c) => `${c}.xml`);
  const wantOffices = offices.map((o) => `${slug(o)}.xml`).sort();
  record('category feeds exist exactly for categories with a qualifying record', files('category').join() === wantCats.join(), files('category').join(', '));
  record('office feeds exist exactly for offices with a qualifying record', files('office').join() === wantOffices.join(), files('office').join(', '));
  for (const c of cats) await check(`/feeds/category/${c}.xml`, feedMatches(qualifying.filter((e) => e.category === c)));
  for (const o of offices) await check(`/feeds/office/${slug(o)}.xml`, feedMatches(qualifying.filter((e) => e.offices.includes(o))));

  // /subscribe's list comes from the build's manifest; it must match the feed files exactly.
  await check('/feeds/index.json', (body) => {
    const m = JSON.parse(body);
    const listed = [m.main?.path, ...(m.offices ?? []).map((o) => o.path), ...(m.categories ?? []).map((c) => c.path)].sort();
    const onDisk = ['/feed.xml', ...files('office').map((f) => `/feeds/office/${f}`), ...files('category').map((f) => `/feeds/category/${f}`)].sort();
    if (listed.join() !== onDisk.join()) return `manifest lists [${listed.join(', ')}], dist has [${onDisk.join(', ')}]`;
    const counts = [[m.main.path, Math.min(50, qualifying.length), m.main.count],
      ...m.categories.map((c) => [c.path, qualifying.filter((e) => e.category === c.category).length, c.count]),
      ...m.offices.map((o) => [o.path, qualifying.filter((e) => e.offices.includes(o.label)).length, o.count])];
    const wrong = counts.find(([, want, got]) => want !== got);
    return wrong ? `${wrong[0]} count ${wrong[2]}, expected ${wrong[1]}` : true;
  });

  // Each route is a real file with its own <title>, not the SPA fallback.
  for (const [p, title] of [['/method', 'How we count'], ['/corrections', 'Corrections'], ['/recent', 'Recent changes'], ['/subscribe', 'Subscribe']]) {
    await check(p, (body) => (body.includes(`<title>${title} | The Ethics Record</title>`) ? true : `no "${title}" <title>`), { html: true });
  }
} catch (err) {
  console.error(`smoke: ERROR ${err.stack ?? err.message}`);
  stop();
  process.exit(1);
}
stop();
const failed = checks.filter((c) => !c.ok).length;
console.log(`smoke: ${checks.length - failed}/${checks.length} checks passed`);
process.exit(failed ? 1 : 0);
