// Smoke test: start `vite preview` on the built app and check the pages and
// files the wave-2 gate names, then stop the server. Run `npm run build` first.
//
//   /                      200, SPA shell, and a link preview whose headline
//                          matches counts recomputed here from the raw data
//   /data/entries.json     200, a JSON array
//   /r/<first id>/         200, and its index.html carries an og:title equal
//                          to that record's title
//   /feed.xml              200, an Atom feed with at least one entry
//   /feeds/category/<c>.xml, /feeds/office/<slug>.xml for the first record
//   /method, /recent, /corrections, /subscribe, /data/corrections.json
//
// Leak check: unapproved and rubric-failing records from dataset/entries.json
// are absent from /data/entries.json, the front page, and dist/r/.
// The headline recount is deliberately independent of the app's TypeScript:
// grade 1 to 4, evidentiary_status not "retracted"; events are the roots.
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.SMOKE_PORT ?? 4317);
const base = `http://127.0.0.1:${port}`;
const viteBin = path.join(appDir, 'node_modules', 'vite', 'bin', 'vite.js');

if (!existsSync(path.join(appDir, 'dist', 'index.html'))) {
  console.error('smoke: dist/index.html is missing; run `npm run build` first.');
  process.exit(1);
}

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
    try {
      await fetch(base + '/');
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  throw new Error(`vite preview did not answer within ${timeoutMs} ms.\n${serverLog}`);
}

const checks = [];
/** GET a path, require 200, then run `validate(body)`; it returns true or a failure note. */
async function check(urlPath, validate) {
  let ok = false;
  let note = '';
  let body = '';
  try {
    const res = await fetch(base + urlPath);
    body = await res.text();
    ok = res.status === 200;
    note = `HTTP ${res.status}`;
    if (ok && validate) {
      const extra = validate(body);
      if (extra !== true) { ok = false; note += `, ${extra}`; }
    }
  } catch (e) {
    note = `request failed (${e.message})`;
  }
  checks.push({ urlPath, ok, note });
  console.log(`smoke: ${ok ? 'PASS' : 'FAIL'} GET ${urlPath} -> ${note}`);
  return body;
}

const decode = (s) => s
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

const encode = (s) => s
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** content="" of the first <meta property|name="key">, decoded, or null. */
function metaContent(html, key) {
  const re = new RegExp(`<meta\\s+(?:property|name)="${key.replace(/[:]/g, '\\$&')}"\\s+content="([^"]*)"`, 'i');
  const m = re.exec(html);
  return m ? decode(m[1]) : null;
}

const ROUTES = [['/method', 'How we count'], ['/corrections', 'Corrections'], ['/recent', 'Recent changes'], ['/subscribe', 'Subscribe']];

const plural = (n, one, many) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;

try {
  await waitForServer();

  let entries = [];
  await check('/data/entries.json', (body) => {
    try {
      const parsed = JSON.parse(body);
      if (!Array.isArray(parsed)) return 'body is JSON but not an array';
      if (parsed.length === 0) return 'array is empty, so no record page can be checked';
      entries = parsed;
      return true;
    } catch (e) {
      return `body is not JSON (${e.message})`;
    }
  });

  // The leak check: no record from the raw dataset that is unapproved, or that
  // names only private actors below grade 3 or without a response, may appear
  // in the public dataset, on the front page, or as a record page.
  const raw = JSON.parse(readFileSync(path.join(appDir, 'dataset', 'entries.json'), 'utf8'));
  const PRIVATE = new Set(['family', 'private-associate', 'private-entity']);
  const failsRubric = (e) => {
    const roles = (e.actors ?? []).map((a) => e.actor_roles?.[a]);
    return roles.length > 0 && roles.every((r) => PRIVATE.has(r))
      && (e.evidence_grade > 3 || e.subject_response === null || e.subject_response === 'not-sought');
  };
  const secret = raw.filter((e) => !e.approved_by || failsRubric(e));
  if (!raw.some((e) => !e.approved_by)) {
    checks.push({ urlPath: 'fixture', ok: false, note: 'the raw dataset has no approved_by null record, so the leak check proves nothing' });
  }
  const publicIds = new Set(entries.map((e) => e.id));
  for (const e of secret) {
    checks.push({ urlPath: `/data/entries.json without ${e.id}`, ok: !publicIds.has(e.id), note: publicIds.has(e.id) ? 'LEAKED into the public dataset' : 'absent' });
    const onDisk = existsSync(path.join(appDir, 'dist', 'r', e.id));
    checks.push({ urlPath: `dist/r/${e.id}/ absent`, ok: !onDisk, note: onDisk ? 'a record page was generated' : 'absent' });
  }
  await check('/', (body) => {
    const hit = secret.find((e) => body.includes(e.id) || body.includes(encode(e.title)));
    return hit ? `front page HTML names left-out record ${hit.id}` : true;
  });
  for (const c of checks.filter((c) => c.urlPath.includes(' without ') || c.urlPath.endsWith(' absent') || c.urlPath === 'fixture')) {
    console.log(`smoke: ${c.ok ? 'PASS' : 'FAIL'} ${c.urlPath} -> ${c.note}`);
  }

  // Independent recount of the headline per docs/schema.md counting rules.
  // Qualifying: grade 1-4, not retracted, approved, published and not in the future.
  // Events: trees (a root plus its children) holding at least one qualifying record.
  const nowMs = Date.now();
  const qualifying = entries.filter((e) => Number.isInteger(e.evidence_grade) && e.evidence_grade >= 1 && e.evidence_grade <= 4
    && e.evidentiary_status !== 'retracted' && e.approved_by && e.first_published_at && Date.parse(e.first_published_at) <= nowMs);
  const records = qualifying.length;
  const events = new Set(qualifying.map((e) => (e.root_id === null ? e.id : e.root_id))).size;
  const headline = `${plural(records, 'qualifying record', 'qualifying records')} concerning ${plural(events, 'distinct event', 'distinct events')} since 20 January 2025`;

  await check('/', (body) => {
    if (!body.includes('<div id="root">')) return 'root element missing from HTML';
    const desc = metaContent(body, 'og:description');
    if (desc === null) return 'no og:description on the front page';
    return desc.includes(headline) ? true : `og:description "${desc}" does not contain "${headline}"`;
  });

  const first = entries[0];
  if (first && typeof first.id === 'string') {
    const id = encodeURIComponent(first.id);
    await check(`/r/${id}/`, (body) => (body.includes(`<h1 class="drawer__title">${encode(first.title)}</h1>`) ? true : 'record title missing from the page body'));
    await check(`/r/${id}/index.html`, (body) => {
      const og = metaContent(body, 'og:title');
      if (og === null) return 'no og:title meta tag';
      return og === first.title ? true : `og:title "${og}" does not match record title "${first.title}"`;
    });
  } else {
    checks.push({ urlPath: '/r/<first id>/', ok: false, note: 'no first record id to check' });
    console.log('smoke: FAIL GET /r/<first id>/ -> no first record id to check');
  }

  await check('/feed.xml', (body) => {
    if (!/<feed\s+xmlns="http:\/\/www\.w3\.org\/2005\/Atom"/.test(body)) return 'not an Atom <feed>';
    const n = (body.match(/<entry>/g) ?? []).length;
    return n > 0 ? true : 'feed has no entries';
  });
  // Per-category and per-office feeds for the first record (slug rule mirrors src/feeds.ts).
  const slug = (n) => n.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'unnamed';
  const atomWith = (id) => (body) => (/<feed\s+xmlns="http:\/\/www\.w3\.org\/2005\/Atom"/.test(body) && body.includes(`/r/${encodeURIComponent(id)}/</id>`) ? true : 'not an Atom feed carrying the first record');
  if (first?.category) await check(`/feeds/category/${first.category}.xml`, atomWith(first.id));
  if (first?.offices?.[0]) await check(`/feeds/office/${slug(first.offices[0])}.xml`, atomWith(first.id));
  await check('/data/corrections.json', (body) => {
    try { return Array.isArray(JSON.parse(body)) ? true : 'body is JSON but not an array'; } catch (e) { return `body is not JSON (${e.message})`; }
  });
  // Each route is a real file with its own <title>, not the SPA fallback.
  for (const [p, title] of ROUTES) {
    await check(p, (body) => {
      if (!body.includes('<div id="root">')) return 'SPA shell missing';
      return body.includes(`<title>${title} | The Ethics Record</title>`) ? true : `no "${title}" <title>; this is the SPA fallback, not the route's own page`;
    });
  }
} catch (err) {
  console.error(`smoke: ERROR ${err.message}`);
  stop();
  process.exit(1);
}
stop();
const failed = checks.filter((c) => !c.ok).length;
console.log(`smoke: ${checks.length - failed}/${checks.length} checks passed`);
process.exit(failed ? 1 : 0);
