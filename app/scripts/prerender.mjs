// Prerender: runs after `vite build` (see package.json "build").
//
// 1. Compiles src/build/site.ts for Node with Vite's SSR build, so the pages
//    are made by the app's own loader, counting rules and labels.
// 2. Reads dist/index.html and the raw dataset/*.json and writes, under dist/:
//    data/entries.json and data/corrections.json, the public dataset (approved,
//    rubric-passing records only; drafts and rejected records never reach dist),
//    r/<id>/index.html for every record (full <title>, description, Open
//    Graph and Twitter tags, the record as plain HTML, and the app script,
//    which opens that record's drawer), the front page's preview tags, route
//    shells, 404.html, and the Atom feeds.
//
// SITE_URL sets the absolute origin used in og:url, canonical links and
// feeds; it is required (see siteOrigin below). Any rejected or duplicate id,
// non-http(s) source URL, or malformed or unmatched correction fails the build.
import { build } from 'vite';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolveDatasetDir } from './dataset-dir.mjs';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(appDir, 'dist');
const cacheDir = path.join(appDir, 'node_modules', '.cache', 'ethics-record-prerender');
const DEFAULT_SITE_URL = 'https://ethics-record.example';

const fail = (msg) => {
  console.error(`prerender: ${msg}`);
  process.exit(1);
};

/**
 * SITE_URL must be an https:// origin (no path, query or fragment). Without it
 * the build fails, unless ALLOW_PLACEHOLDER_SITE_URL=1 asks for the reserved
 * placeholder origin (the smoke test does). A set but invalid SITE_URL always
 * fails, so a typo is never masked.
 */
/** Why a hostname is not a public site origin, or null when it is. */
function notPublicHost(hostname) {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (h === 'ethics-record.example' || h === 'example' || h.endsWith('.example')) return 'the placeholder origin';
  if (h === 'localhost' || h.endsWith('.localhost') || h === '::1') return 'a loopback host';
  if (h.endsWith('.local')) return 'a .local host';
  if (h.endsWith('.test')) return 'a .test host';
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 127) return 'a loopback address (127.0.0.0/8)';
    if (a === 10) return 'a private address (10.0.0.0/8)';
    if (a === 172 && b >= 16 && b <= 31) return 'a private address (172.16.0.0/12)';
    if (a === 192 && b === 168) return 'a private address (192.168.0.0/16)';
  }
  return null;
}

function siteOrigin() {
  const raw = process.env.SITE_URL;
  if (raw) {
    let u;
    try { u = new URL(raw); } catch { fail(`SITE_URL "${raw}" is not a URL.`); }
    const bare = u.pathname === '/' && !u.search && !u.hash && !u.username && !u.password;
    if (u.protocol !== 'https:' || !bare) fail(`SITE_URL "${raw}" must be an https:// origin, e.g. https://example.org`);
    const why = notPublicHost(u.hostname);
    if (why && process.env.ALLOW_PLACEHOLDER_SITE_URL !== '1') {
      fail(`SITE_URL "${raw}" is ${why}, not a public origin; set ALLOW_PLACEHOLDER_SITE_URL=1 to build with it anyway.`);
    }
    return u.origin;
  }
  if (process.env.ALLOW_PLACEHOLDER_SITE_URL === '1') return DEFAULT_SITE_URL;
  fail('SITE_URL is not set. Set it to the https:// origin the site will live at, or set ALLOW_PLACEHOLDER_SITE_URL=1 to build with the placeholder origin.');
}
const siteUrl = siteOrigin();

if (!existsSync(path.join(dist, 'index.html'))) {
  console.error('prerender: dist/index.html is missing; run `vite build` first.');
  process.exit(1);
}

await build({
  root: appDir,
  configFile: path.join(appDir, 'vite.config.ts'),
  logLevel: 'warn',
  build: {
    ssr: path.join(appDir, 'src', 'build', 'site.ts'),
    outDir: cacheDir,
    emptyOutDir: true,
    copyPublicDir: false,
    sourcemap: false,
    rolldownOptions: { output: { entryFileNames: 'site.mjs' } },
  },
});

const { buildSite, GENERATED_PATHS } = await import(pathToFileURL(path.join(cacheDir, 'site.mjs')).href);

// Clear everything a previous prerender wrote, so `npm run prerender` on its
// own can never leave a stale record page, feed or dataset behind.
for (const p of GENERATED_PATHS) await rm(path.join(dist, p), { recursive: true, force: true });

const readJson = async (p, optional = false) => {
  if (optional && !existsSync(p)) return null;
  return JSON.parse(await readFile(p, 'utf8'));
};

// Keep Vite's untouched shell so running the prerender twice never stacks tags:
// a fresh `vite build` writes an index.html without og tags; save that one.
const shellCopy = path.join(appDir, 'node_modules', '.cache', 'ethics-record-shell.html');
const builtIndex = await readFile(path.join(dist, 'index.html'), 'utf8');
if (!builtIndex.includes('property="og:title"')) {
  await mkdir(path.dirname(shellCopy), { recursive: true });
  await writeFile(shellCopy, builtIndex);
} else if (!existsSync(shellCopy)) {
  console.error('prerender: dist/index.html is already prerendered and no pristine copy exists; run `npm run build`.');
  process.exit(1);
}

// The raw dataset lives outside public/, so Vite never copies it into dist/.
// buildSite writes the filtered public files to dist/data/.
// The raw dataset directory, via the resolver shared with smoke.mjs and the
// dev server. A non-default DATASET_DIR needs ALLOW_DATASET_DIR=1.
let dataset;
try { dataset = resolveDatasetDir(process.env); } catch (err) { fail(err.message); }
const datasetDir = dataset.dir;
console.log(`prerender: dataset ${dataset.label}${dataset.isDefault ? '' : ' (DATASET_DIR, allowed by ALLOW_DATASET_DIR=1)'}`);
// One id per build: written into every page's <meta name="build-id"> and
// dist/build.json, so the smoke test can prove which build a server serves.
const nowMs = Date.now();
const buildId = `${new Date(nowMs).toISOString().replace(/[-:.]/g, '').slice(0, 15)}-${randomUUID().slice(0, 8)}`;

let out;
try {
  out = buildSite({
    indexHtml: await readFile(shellCopy, 'utf8'),
    entries: await readJson(path.join(datasetDir, 'entries.json')),
    corrections: await readJson(path.join(datasetDir, 'corrections.json'), true),
    siteUrl,
    nowMs,
    buildId,
    dataset: { label: dataset.label, isDefault: dataset.isDefault },
  });
} catch (err) {
  fail(err instanceof Error ? err.message : String(err));
}

for (const f of out.files) {
  const target = path.join(dist, ...f.path.split('/'));
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, f.content);
}
if (siteUrl === DEFAULT_SITE_URL) console.log(`prerender: ALLOW_PLACEHOLDER_SITE_URL=1; absolute links use ${DEFAULT_SITE_URL}`);
for (const n of out.notes) console.log(`prerender: ${n}`);
console.log(`prerender: wrote ${out.files.length} files under dist/`);
