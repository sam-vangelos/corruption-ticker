// Smoke test: start `vite preview` on the built app and check the pages and
// files the wave-2 gate names, then stop the server. Run `npm run build` first.
//
//   /                      200, SPA shell, and a link preview whose headline
//                          matches counts recomputed here from the raw data
//   /data/entries.json     200, a JSON array
//   /r/<first id>/         200, and its index.html carries an og:title equal
//                          to that record's title
//   /method, /corrections  200, each its own prerendered page
//   /data/corrections.json 200, a JSON array
//
// The headline recount is deliberately independent of the app's TypeScript:
// grade 1 to 4, evidentiary_status not "retracted"; events are the roots.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
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

const ROUTES = [['/method', 'How we count'], ['/corrections', 'Corrections']];

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

  // Independent recount of the headline per docs/schema.md counting rules.
  const qualifying = entries.filter((e) => Number.isInteger(e.evidence_grade) && e.evidence_grade >= 1 && e.evidence_grade <= 4 && e.evidentiary_status !== 'retracted' && e.approved_by);
  const records = qualifying.length;
  const events = qualifying.filter((e) => e.root_id === null).length;
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
