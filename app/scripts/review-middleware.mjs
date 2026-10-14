// The editor's review queue: Vite dev-server middleware. DEVELOPMENT ONLY.
// vite.config.ts installs it in `configureServer` (apply: 'serve'), so it
// never runs in a build, and no app module imports anything under
// src/review/, so none of it reaches dist/ (scripts/verify.mjs greps dist for
// the API path and the queue's markers).
//
//   GET  /review                 the queue page (HTML generated here, never a file in the app)
//   GET  /__review/queue         unapproved records with validation and lint results
//   POST /__review/approve       {id}            approve through src/data/approve-core.ts
//   POST /__review/reject        {id, reason}    clear approval, log to rejections.json
//   POST /__review/edit          {id, patch}     apply editable fields, clear approval
//
// Every write re-reads the dataset, applies the change, writes atomically
// (temp file, then rename), re-validates, and returns the record's new state.
// Writes are serialised. Validation, lint and approval are the build's own
// functions, loaded through Vite's SSR loader from src/review/core.ts.
//
// Access: loopback only (by socket address), Host must be a loopback name
// (defeats DNS rebinding), and a POST must be JSON and, when the browser sends
// an Origin, same-origin (defeats a web page POSTing to localhost). No CORS
// headers are ever sent.
import { readFile, rename, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

/** True for 127.0.0.0/8, ::1 and IPv4-mapped loopback. */
export function isLoopbackAddress(addr) {
  if (!addr) return false;
  const a = addr.replace(/^::ffff:/, '');
  return a === '::1' || /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(a);
}

/** Why a request to a review or raw-data route must be refused, or null. */
export function refusal(req) {
  if (!isLoopbackAddress(req.socket?.remoteAddress)) return { status: 403, error: 'the review queue answers loopback requests only' };
  const host = String(req.headers.host ?? '').replace(/:\d+$/, '').toLowerCase();
  if (!LOOPBACK_HOSTS.has(host)) return { status: 403, error: `Host "${req.headers.host}" is not a loopback name` };
  if (req.method === 'POST') {
    const type = String(req.headers['content-type'] ?? '');
    if (!type.startsWith('application/json')) return { status: 415, error: 'POST bodies must be application/json' };
    const origin = req.headers.origin;
    if (origin !== undefined && origin !== `http://${req.headers.host}`) return { status: 403, error: `cross-origin request from ${origin} refused` };
  }
  return null;
}

const send = (res, status, body) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
};

async function readBody(req, limit = 1_000_000) {
  let size = 0;
  const chunks = [];
  for await (const c of req) {
    size += c.length;
    if (size > limit) throw Object.assign(new Error('body too large'), { status: 413 });
    chunks.push(c);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  } catch {
    throw Object.assign(new Error('body is not JSON'), { status: 400 });
  }
}

/** Write a file atomically: a temp file in the same directory, then rename over the target. */
async function writeAtomic(file, text) {
  const tmp = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.${Date.now()}.tmp`);
  await writeFile(tmp, text);
  await rename(tmp, file);
}

const PAGE = `<!doctype html>
<html lang="en" data-theme="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="robots" content="noindex" />
    <link rel="icon" href="data:," />
    <title>Review queue (development only)</title>
    <script>
      try {
        var t = localStorage.getItem('ct.theme');
        if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
        if (localStorage.getItem('ct.type') === 'large') document.documentElement.setAttribute('data-type', 'large');
      } catch (e) {}
    </script>
  </head>
  <body>
    <div id="review-root"></div>
    <script type="module" src="/src/review/main.tsx"></script>
  </body>
</html>
`;

/**
 * @param {import('vite').ViteDevServer} server
 * @param {{ datasetDir: string }} opts
 */
export function reviewMiddleware(server, { datasetDir }) {
  const entriesFile = path.join(datasetDir, 'entries.json');
  const rejectionsFile = path.join(datasetDir, 'rejections.json');
  const core = () => server.ssrLoadModule('/src/review/core.ts');

  let chain = Promise.resolve();
  /** Run writes one at a time, in arrival order. */
  const serial = (fn) => {
    const run = chain.then(fn, fn);
    chain = run.catch(() => {});
    return run;
  };

  const readEntries = async () => {
    const v = JSON.parse(await readFile(entriesFile, 'utf8'));
    if (!Array.isArray(v)) throw Object.assign(new Error(`${entriesFile} is not a JSON array`), { status: 500 });
    return v;
  };
  const readRejections = async () => (existsSync(rejectionsFile) ? JSON.parse(await readFile(rejectionsFile, 'utf8')) : []);
  const json = (v) => `${JSON.stringify(v, null, 2)}\n`;

  return async (req, res, next) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const isPage = url.pathname === '/review' || url.pathname === '/review/';
    if (!isPage && !url.pathname.startsWith('/__review/')) return next();
    const no = refusal(req);
    if (no) return send(res, no.status, { error: no.error });

    try {
      if (isPage && req.method === 'GET') {
        const html = await server.transformIndexHtml('/review', PAGE);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        return res.end(html);
      }
      const c = await core();
      const route = `${req.method} ${url.pathname}`;

      if (route === 'GET /__review/queue') {
        return send(res, 200, c.queueView(await readEntries(), await readRejections()));
      }

      if (route === 'POST /__review/approve') {
        const { id } = await readBody(req);
        return await serial(async () => {
          const entries = await readEntries();
          const r = c.approveRecordById(entries, String(id ?? ''));
          const rejections = await readRejections();
          if (!r.ok) return send(res, 422, { error: r.error, state: c.stateById(entries, rejections, String(id ?? '')) });
          await writeAtomic(entriesFile, json(entries));
          const fresh = await readEntries();
          return send(res, 200, { ok: true, digest: r.digest, state: c.stateById(fresh, rejections, id) });
        });
      }

      if (route === 'POST /__review/reject') {
        const { id, reason } = await readBody(req);
        return await serial(async () => {
          const entries = await readEntries();
          const rejections = await readRejections();
          const r = c.rejectById(entries, rejections, String(id ?? ''), reason, new Date().toISOString());
          if (!r.ok) return send(res, r.status, { error: r.error });
          await writeAtomic(entriesFile, json(entries));
          await writeAtomic(rejectionsFile, json(rejections));
          return send(res, 200, { ok: true, state: c.stateById(await readEntries(), await readRejections(), id) });
        });
      }

      if (route === 'POST /__review/edit') {
        const { id, patch } = await readBody(req);
        return await serial(async () => {
          const entries = await readEntries();
          const r = c.editById(entries, String(id ?? ''), patch);
          if (!r.ok) return send(res, r.status, { error: r.error });
          await writeAtomic(entriesFile, json(entries));
          return send(res, 200, { ok: true, state: c.stateById(await readEntries(), await readRejections(), id) });
        });
      }

      return send(res, 404, { error: `no review route ${route}` });
    } catch (err) {
      return send(res, err.status ?? 500, { error: err.message });
    }
  };
}
