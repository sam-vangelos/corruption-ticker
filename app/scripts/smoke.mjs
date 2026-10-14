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
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(appDir, 'dist');
const viteBin = path.join(appDir, 'node_modules', 'vite', 'bin', 'vite.js');

// ---------- 1. build ----------
if (process.env.SMOKE_SKIP_BUILD !== '1') {
  const env = { ...process.env };
  if (!env.SITE_URL) env.ALLOW_PLACEHOLDER_SITE_URL = '1';
  const npm = process.env.npm_execpath;
  const r = npm
    ? spawnSync(process.execPath, [npm, 'run', 'build'], { cwd: appDir, env, stdio: ['ignore', 'pipe', 'pipe'] })
    : spawnSync('npm', ['run', 'build'], { cwd: appDir, env, stdio: ['ignore', 'pipe', 'pipe'] });
  if (r.status !== 0) {
    console.error(`smoke: build failed (exit ${r.status})\n${r.stdout}${r.stderr}`);
    process.exit(1);
  }
  console.log('smoke: build ok');
}
if (!existsSync(path.join(dist, 'build.json'))) {
  console.error('smoke: dist/build.json is missing; the build did not finish.');
  process.exit(1);
}
const stamp = JSON.parse(readFileSync(path.join(dist, 'build.json'), 'utf8'));
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
const checks = [];
const record = (name, ok, note) => {
  checks.push({ name, ok, note });
  console.log(`smoke: ${ok ? 'PASS' : 'FAIL'} ${name}${note ? ` -> ${note}` : ''}`);
};

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
const encode = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

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

  // The leak: unapproved and rubric-failing raw records never reach the public.
  const raw = JSON.parse(readFileSync(path.join(appDir, 'dataset', 'entries.json'), 'utf8'));
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
