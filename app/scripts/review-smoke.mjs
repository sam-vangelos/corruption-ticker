// npm run review-smoke: the review queue's dev server, end to end.
//
// Copies the dataset (resolved by scripts/dataset-dir.mjs) into a temp
// directory, so the committed fixture is never written, and starts the Vite
// dev server on it with DATASET_DIR. The server binds every interface so a
// request can arrive from a non-loopback address. Then it:
//   - fetches /review (the page) and /__review/queue;
//   - approves a draft through the API, runs `npm run approve -- --check` on
//     the temp dataset, and recomputes the digest with the build's own code;
//   - refuses to approve an invalid draft;
//   - rejects a record with a reason and reads rejections.json;
//   - edits the approved record and confirms its approval was cleared;
//   - archives a source through a local stand-in for the Wayback Machine,
//     confirms the one-request-per-4-seconds limit and a surfaced failure;
//   - confirms a request from a non-loopback address, a cross-origin POST, a
//     non-JSON POST and a foreign Host header are all refused;
//   - confirms the committed dataset file did not change.
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import http from 'node:http';
import { networkInterfaces, tmpdir } from 'node:os';
import path from 'node:path';
import { APP_DIR, resolveDatasetDir } from './dataset-dir.mjs';
import { loadSiteModule } from './compile-ssr.mjs';

const results = [];
const record = (name, ok, note) => {
  results.push(ok);
  console.log(`review-smoke: ${ok ? 'PASS' : 'FAIL'} ${name}${note ? ` -> ${note}` : ''}`);
};

const dataset = resolveDatasetDir(process.env);
const committed = path.join(dataset.dir, 'entries.json');
const sha = (f) => createHash('sha256').update(readFileSync(f)).digest('hex');
const committedBefore = sha(committed);

const work = mkdtempSync(path.join(tmpdir(), 'ethics-review-smoke-'));
for (const f of ['entries.json', 'corrections.json']) {
  if (existsSync(path.join(dataset.dir, f))) copyFileSync(path.join(dataset.dir, f), path.join(work, f));
}
// Add a draft whose first source has no archive_url, for the archive helper.
{
  const entries = JSON.parse(readFileSync(path.join(work, 'entries.json'), 'utf8'));
  const base = entries.find((r) => r.approved_by === null) ?? entries[0];
  const draft = JSON.parse(JSON.stringify(base));
  draft.id = 'p-2026-09-archive-me-99';
  draft.title = '[PLACEHOLDER] Review-smoke draft whose source needs archiving';
  draft.approved_by = null;
  draft.approved_digest = null;
  draft.sources[0].url = 'https://example.com/placeholder/archive-me';
  draft.sources[0].archive_url = '';
  entries.push(draft);
  writeFileSync(path.join(work, 'entries.json'), `${JSON.stringify(entries, null, 2)}\n`);
}
const raw = JSON.parse(readFileSync(path.join(work, 'entries.json'), 'utf8'));

const freePort = () => new Promise((resolve, reject) => {
  const s = createServer();
  s.on('error', reject);
  s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); });
});

// A local stand-in for web.archive.org: /save/<url> redirects to /web/<ts>/<url>.
const archiveStub = http.createServer((req, res) => {
  const m = /^\/save\/(.+)$/.exec(req.url ?? '');
  if (m && m[1].includes('fail-archive')) { res.statusCode = 503; return res.end('unavailable'); }
  if (m) { res.statusCode = 302; res.setHeader('Location', `/web/20261014120000/${m[1]}`); return res.end(); }
  if ((req.url ?? '').startsWith('/web/')) { res.statusCode = 200; return res.end('snapshot'); }
  res.statusCode = 404; res.end();
});
const stubPort = await freePort();
await new Promise((r) => archiveStub.listen(stubPort, '127.0.0.1', r));

const port = await freePort();
const base = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, [path.join(APP_DIR, 'node_modules', 'vite', 'bin', 'vite.js'), '--host', '0.0.0.0', '--port', String(port), '--strictPort'], {
  cwd: APP_DIR,
  env: { ...process.env, DATASET_DIR: work, ALLOW_DATASET_DIR: '1', REVIEW_ARCHIVE_BASE: `http://127.0.0.1:${stubPort}` },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let log = '';
server.stdout.on('data', (d) => { log += d; });
server.stderr.on('data', (d) => { log += d; });
const stop = () => { if (!server.killed) server.kill('SIGTERM'); archiveStub.close(); };
process.on('exit', stop);

async function ready(timeoutMs = 20000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if (server.exitCode !== null) throw new Error(`dev server exited (${server.exitCode})\n${log}`);
    try { if ((await fetch(`${base}/review`)).ok) return; } catch { /* not yet */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`dev server did not answer within ${timeoutMs} ms\n${log}`);
}

const post = (route, body, headers = {}) => fetch(`${base}${route}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...headers },
  body: JSON.stringify(body),
});
const queue = async () => (await fetch(`${base}/__review/queue`)).json();

try {
  await ready();
  console.log(`review-smoke: dev server on port ${port}, dataset copy ${work}`);

  const page = await fetch(`${base}/review`);
  const html = await page.text();
  record('GET /review serves the queue page', page.ok && html.includes('id="review-root"') && html.includes('/src/review/main.tsx'), `HTTP ${page.status}`);

  const q = await queue();
  const drafts = raw.filter((r) => r.approved_by === null);
  const ids = q.records.map((r) => r.id);
  record('GET /__review/queue lists every unapproved record', drafts.every((d) => ids.includes(d.id)) && ids.length === drafts.length,
    `${ids.length} records; progress ${JSON.stringify(q.progress)}`);
  const valid = q.records.find((r) => r.errors.length === 0 && !r.lint);
  const invalid = q.records.find((r) => (r.errors.length > 0 || r.lint) && r.id !== 'p-2026-09-archive-me-99');
  record('the queue carries validation and lint results from the build\'s rules', !!valid && !!invalid,
    `${valid?.id} clean; ${invalid?.id}: ${invalid?.errors[0] ?? invalid?.lint}`);

  // Approve a clean draft through the API.
  const ap = await post('/__review/approve', { id: valid.id });
  const apBody = await ap.json();
  record(`POST /__review/approve ${valid.id}`, ap.ok && apBody.state?.approved === true && apBody.state.record.approved_digest === apBody.digest,
    `HTTP ${ap.status}; digest ${String(apBody.digest).slice(0, 12)}`);
  const check = spawnSync(process.execPath, [path.join(APP_DIR, 'scripts', 'approve.mjs'), '--check'], {
    cwd: APP_DIR, encoding: 'utf8', env: { ...process.env, DATASET_DIR: work, ALLOW_DATASET_DIR: '1' },
  });
  record('`npm run approve -- --check` passes on the written file', check.status === 0, (check.stdout.trim().split('\n').pop() ?? '').trim());
  const site = await loadSiteModule({ reuse: true });
  const written = JSON.parse(readFileSync(path.join(work, 'entries.json'), 'utf8')).find((r) => r.id === valid.id);
  const recomputed = site.recordDigestOf(written);
  record('the written digest equals the build\'s recomputed digest', recomputed.digest === written.approved_digest && written.approved_by === site.EDITOR_NAME,
    `${String(recomputed.digest).slice(0, 12)} = ${String(written.approved_digest).slice(0, 12)}`);

  const bad = await post('/__review/approve', { id: invalid.id });
  record(`an invalid record cannot be approved (${invalid.id})`, bad.status === 422, `HTTP ${bad.status}: ${(await bad.json()).error}`);

  // Reject with a reason.
  const noReason = await post('/__review/reject', { id: invalid.id, reason: '  ' });
  record('a rejection without a reason is refused', noReason.status === 400, `HTTP ${noReason.status}`);
  const rj = await post('/__review/reject', { id: invalid.id, reason: 'Fails the private-actor rule; needs a response.' });
  const rjBody = await rj.json();
  const rejections = JSON.parse(readFileSync(path.join(work, 'rejections.json'), 'utf8'));
  const last = rejections[rejections.length - 1];
  record(`POST /__review/reject ${invalid.id}`, rj.ok && rjBody.state?.rejected?.reason === 'Fails the private-actor rule; needs a response.'
    && last?.id === invalid.id && typeof last.at === 'string' && !Number.isNaN(Date.parse(last.at)), `rejections.json: ${JSON.stringify(last)}`);

  // Edit the approved record: approval cleared, re-validated.
  const ed = await post('/__review/edit', { id: valid.id, patch: { title: `${written.title} (edited in review)` } });
  const edBody = await ed.json();
  const afterEdit = JSON.parse(readFileSync(path.join(work, 'entries.json'), 'utf8')).find((r) => r.id === valid.id);
  record(`POST /__review/edit ${valid.id} clears its approval`, ed.ok && edBody.state?.approved === false
    && afterEdit.approved_by === null && afterEdit.approved_digest === null && afterEdit.title.endsWith('(edited in review)'), `approved_by ${afterEdit.approved_by}`);
  const edBad = await post('/__review/edit', { id: valid.id, patch: { id: 'other', approved_by: 'Sam Vangelos' } });
  record('edit refuses fields outside the editable set', edBad.status === 400, `HTTP ${edBad.status}: ${(await edBad.json()).error}`);
  record('the edited record is back in the queue', (await queue()).records.some((r) => r.id === valid.id));

  // The archive helper, against the local stand-in for the Wayback Machine.
  const needs = (await queue()).records.find((r) => r.id === 'p-2026-09-archive-me-99');
  record('a source without archive_url shows as a validation error', /archive_url/.test(needs?.errors[0] ?? ''), needs?.errors[0]);
  const ar = await post('/__review/archive', { url: 'https://example.com/placeholder/archive-me' });
  const arBody = await ar.json();
  const archived = JSON.parse(readFileSync(path.join(work, 'entries.json'), 'utf8')).find((r) => r.id === 'p-2026-09-archive-me-99');
  record('POST /__review/archive writes the snapshot URL into the source', ar.ok
    && archived.sources[0].archive_url === 'https://web.archive.org/web/20261014120000/https://example.com/placeholder/archive-me'
    && arBody.states?.[0]?.errors.length === 0, `${archived.sources[0].archive_url}; errors now ${JSON.stringify(arBody.states?.[0]?.errors)}`);
  const ar2 = await post('/__review/archive', { url: 'https://example.com/placeholder/archive-me' });
  record('a second archive request within 4 s is rate-limited', ar2.status === 429 && Number(ar2.headers.get('retry-after')) > 0, `HTTP ${ar2.status}, Retry-After ${ar2.headers.get('retry-after')}`);
  await new Promise((r) => setTimeout(r, 4100));
  const ar3 = await post('/__review/archive', { url: 'https://example.com/fail-archive' });
  record('an archive failure is surfaced', ar3.status === 502, `HTTP ${ar3.status}: ${(await ar3.json()).error}`);

  // Refusals.
  const lan = Object.values(networkInterfaces()).flat().find((x) => x && !x.internal && x.family === 'IPv4');
  if (lan) {
    // Plain http.request, one retry on a transport-level 408 or connection
    // error only (a slow first LAN connection); the guard's answer is 403.
    const get = (url) => new Promise((resolve) => {
      const r = http.get(url, { agent: false }, (res) => {
        let body = '';
        res.on('data', (d) => { body += d; });
        res.on('end', () => resolve({ status: res.statusCode, body }));
      });
      r.on('error', (e) => resolve({ status: 0, body: e.message }));
    });
    for (const p of ['/__review/queue', '/review', '/data/entries.json']) {
      let r = await get(`http://${lan.address}:${port}${p}`);
      if (r.status === 408 || r.status === 0) r = await get(`http://${lan.address}:${port}${p}`);
      record(`a non-loopback request (${lan.address}) to ${p} is refused`, r.status === 403 && /loopback/.test(r.body), `HTTP ${r.status}: ${r.body.slice(0, 70)}`);
    }
  } else {
    record('a non-loopback request is refused', false, 'no non-loopback IPv4 interface on this machine to test from');
  }
  const xo = await post('/__review/approve', { id: valid.id }, { Origin: 'http://evil.example' });
  record('a cross-origin POST is refused', xo.status === 403, `HTTP ${xo.status}`);
  const txt = await fetch(`${base}/__review/approve`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ id: valid.id }) });
  record('a non-JSON POST is refused', txt.status === 415, `HTTP ${txt.status}`);
  const foreignHost = await new Promise((resolve) => {
    const r = http.request({ host: '127.0.0.1', port, path: '/__review/queue', headers: { Host: 'evil.example' } }, (res) => { res.resume(); resolve(res.statusCode); });
    r.on('error', () => resolve(0));
    r.end();
  });
  record('a foreign Host header (DNS rebinding) is refused', foreignHost === 403, `HTTP ${foreignHost}`);
} catch (err) {
  record('review smoke ran', false, err.message);
}

stop();
record('the committed dataset file is unchanged', sha(committed) === committedBefore);
const failed = results.filter((x) => !x).length;
console.log(`review-smoke: ${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
