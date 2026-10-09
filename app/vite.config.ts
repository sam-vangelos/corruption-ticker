import { defineConfig } from 'vite';

// No framework plugin: Vite's built-in TS/JSX transform handles .tsx with the
// automatic React runtime (read from tsconfig "jsx": "react-jsx"). That keeps
// the dependency list to react, react-dom, vite, typescript (+ React types).
export default defineConfig({
  base: '/',
  server: { port: 5173, strictPort: false },
  preview: { port: 4317, strictPort: true },
  build: { target: 'es2022', sourcemap: true },
});
