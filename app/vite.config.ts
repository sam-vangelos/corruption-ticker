import { defineConfig, type Plugin } from 'vite';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { resolveDatasetDir } from './scripts/dataset-dir.mjs';

/**
 * Development only: serve the raw dataset files at /data/*.json. In a build
 * nothing in dataset/ is copied to dist/; scripts/prerender.mjs writes the
 * filtered public dataset (approved, rubric-passing records only) instead.
 */
function devDataset(): Plugin {
  return {
    name: 'ethics-record-dev-dataset',
    apply: 'serve',
    configureServer(server) {
      // Same resolver as the build: DATASET_DIR needs ALLOW_DATASET_DIR=1 here too.
      const dataset = resolveDatasetDir(process.env);
      server.config.logger.info(`dev dataset: ${dataset.label}`);
      server.middlewares.use(async (req, res, next) => {
        const m = /^\/data\/(entries|corrections)\.json(?:\?.*)?$/.exec(req.url ?? '');
        if (!m) return next();
        try {
          const body = await readFile(path.join(dataset.dir, `${m[1]}.json`));
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(body);
        } catch {
          res.statusCode = 404;
          res.end();
        }
      });
    },
  };
}

// No framework plugin: Vite's built-in TS/JSX transform handles .tsx with the
// automatic React runtime (read from tsconfig "jsx": "react-jsx"). That keeps
// the dependency list to react, react-dom, vite, typescript (+ React types).
export default defineConfig({
  base: '/',
  plugins: [devDataset()],
  server: { port: 5173, strictPort: false },
  preview: { port: 4317, strictPort: true },
  build: { target: 'es2022', sourcemap: true },
});
