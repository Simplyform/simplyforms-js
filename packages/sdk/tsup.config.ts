import { defineConfig } from 'tsup';

export default defineConfig([
  // Library build: ESM + CJS + types, for `import`/`require` consumers.
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    clean: true,
    treeshake: true,
    target: 'es2022',
  },
  // CDN build: a single minified IIFE exposing `window.SimplyForms`.
  // e.g. <script src="https://unpkg.com/simplyforms"></script>
  {
    entry: { simplyforms: 'src/index.ts' },
    format: ['iife'],
    globalName: 'SimplyForms',
    minify: true,
    sourcemap: true,
    outDir: 'dist/browser',
    target: 'es2020',
  },
]);
