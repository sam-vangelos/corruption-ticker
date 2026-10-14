// Prerender: runs after `vite build` (see package.json "build").
//
// 1. Compiles src/build/site.ts for Node with Vite's SSR build, so the pages
//    are made by the app's own loader, counting rules and labels.
// 2. Reads dist/index.html and public/data/*.json and writes, under dist/:
//    r/<id>/index.html for every record (full <title>, description, Open
//    Graph and Twitter tags, the record as plain HTML, and the app script,
//    which opens that record's drawer), the front page's preview tags, route
//    shells, 404.html, and the Atom feeds.
//
// SITE_URL sets the absolute origin used in og:url, canonical links and
// feeds. No domain exists yet, so the default is a reserved .example origin.
import { build } from 'vite';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(appDir, 'dist');
const cacheDir = path.join(appDir, 'node_modules', '.cache', 'ethics-record-prerender');
const DEFAULT_SITE_URL = 'https://ethics-record.example';
const siteUrl = (process.env.SITE_URL || DEFAULT_SITE_URL).replace(/\/+$/, '');

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

const { buildSite } = await import(pathToFileURL(path.join(cacheDir, 'site.mjs')).href);

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

const out = buildSite({
  indexHtml: await readFile(shellCopy, 'utf8'),
  entries: await readJson(path.join(dist, 'data', 'entries.json')),
  corrections: await readJson(path.join(dist, 'data', 'corrections.json'), true),
  siteUrl,
});

for (const f of out.files) {
  const target = path.join(dist, ...f.path.split('/'));
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, f.content);
}
if (siteUrl === DEFAULT_SITE_URL) console.log(`prerender: SITE_URL not set; absolute links use ${DEFAULT_SITE_URL}`);
for (const n of out.notes) console.log(`prerender: ${n}`);
console.log(`prerender: wrote ${out.files.length} files under dist/`);
