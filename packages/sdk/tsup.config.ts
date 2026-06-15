import { defineConfig } from 'tsup';

// `simplyforms` is a runtime dependency and stays external (tsup excludes
// dependencies by default), so this ships only the tiny re-export layer.
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  target: 'es2022',
});
