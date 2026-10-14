// The one place the raw dataset directory is resolved. scripts/prerender.mjs,
// scripts/smoke.mjs and the dev-server plugin in vite.config.ts all call this,
// so a build, its smoke test and the dev server can never read different data.
//
// DATASET_DIR (resolved against app/, not the shell's working directory)
// overrides app/dataset/, but only with ALLOW_DATASET_DIR=1: a stray
// environment variable must never publish a different dataset.
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DEFAULT_DATASET_DIR = path.join(APP_DIR, 'dataset');

/**
 * @param {Record<string, string | undefined>} env
 * @returns {{ dir: string, isDefault: boolean, label: string }}
 * @throws {Error} when DATASET_DIR names another directory without ALLOW_DATASET_DIR=1
 */
export function resolveDatasetDir(env = process.env) {
  const raw = env.DATASET_DIR;
  const dir = raw ? path.resolve(APP_DIR, raw) : DEFAULT_DATASET_DIR;
  const isDefault = dir === DEFAULT_DATASET_DIR;
  if (!isDefault && env.ALLOW_DATASET_DIR !== '1') {
    throw new Error(`DATASET_DIR=${raw} names a dataset other than app/dataset/; set ALLOW_DATASET_DIR=1 to build from it on purpose.`);
  }
  const rel = path.relative(APP_DIR, dir);
  const label = rel && !rel.startsWith('..') && !path.isAbsolute(rel) ? `app/${rel}` : dir;
  return { dir, isDefault, label };
}
