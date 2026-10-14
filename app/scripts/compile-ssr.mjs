// Compiles src/build/site.ts for Node with Vite's SSR build and imports it.
// The prerender, the approve tool and the verify suite all use the same
// compiled module, so they share the app's loader, digests and rules.
import { build } from 'vite';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { APP_DIR } from './dataset-dir.mjs';

export const SSR_CACHE_DIR = path.join(APP_DIR, 'node_modules', '.cache', 'ethics-record-prerender');
const entry = path.join(SSR_CACHE_DIR, 'site.mjs');

/** Compile (unless `reuse` and a compiled module exists) and import the site module. */
export async function loadSiteModule({ reuse = false } = {}) {
  if (!(reuse && existsSync(entry))) {
    await build({
      root: APP_DIR,
      configFile: path.join(APP_DIR, 'vite.config.ts'),
      logLevel: 'warn',
      build: {
        ssr: path.join(APP_DIR, 'src', 'build', 'site.ts'),
        outDir: SSR_CACHE_DIR,
        emptyOutDir: true,
        copyPublicDir: false,
        sourcemap: false,
        rolldownOptions: { output: { entryFileNames: 'site.mjs' } },
      },
    });
  }
  return import(pathToFileURL(entry).href);
}
