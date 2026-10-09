// Smoke test: start `vite preview` on the built app, fetch "/" and
// "/data/entries.json", assert both answer 200 (and that the JSON parses as an
// array), then stop the server. Run `npm run build` first.
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
async function check(urlPath, validate) {
  const res = await fetch(base + urlPath);
  const body = await res.text();
  let ok = res.status === 200;
  let note = `HTTP ${res.status}`;
  if (ok && validate) {
    const extra = validate(body);
    if (extra !== true) { ok = false; note += `, ${extra}`; }
  }
  checks.push({ urlPath, ok, note });
  console.log(`smoke: ${ok ? 'PASS' : 'FAIL'} GET ${urlPath} -> ${note}`);
}

try {
  await waitForServer();
  await check('/', (body) => (body.includes('<div id="root">') ? true : 'root element missing from HTML'));
  await check('/data/entries.json', (body) => {
    try {
      const parsed = JSON.parse(body);
      return Array.isArray(parsed) ? true : 'body is JSON but not an array';
    } catch (e) {
      return `body is not JSON (${e.message})`;
    }
  });
} catch (err) {
  console.error(`smoke: ERROR ${err.message}`);
  stop();
  process.exit(1);
}
stop();
const failed = checks.filter((c) => !c.ok).length;
console.log(`smoke: ${checks.length - failed}/${checks.length} checks passed`);
process.exit(failed ? 1 : 0);
