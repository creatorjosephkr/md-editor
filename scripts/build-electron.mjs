import { build } from 'esbuild';

const sharedOptions = {
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  external: ['electron'],
  sourcemap: true,
  logLevel: 'info',
};

await Promise.all([
  build({
    ...sharedOptions,
    entryPoints: ['electron/main.ts'],
    outfile: 'dist-electron/main.cjs',
  }),
  build({
    ...sharedOptions,
    entryPoints: ['electron/preload.ts'],
    outfile: 'dist-electron/preload.cjs',
  }),
]);
