import { spawn } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { context } from 'esbuild';

const require = createRequire(import.meta.url);
const DEV_SERVER_URL = 'http://localhost:5173';

function waitForServer(url, timeoutMs = 30000) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => {
        if (Date.now() - startedAt > timeoutMs) {
          reject(new Error(`Timed out waiting for Vite dev server at ${url}`));
          return;
        }
        setTimeout(check, 200);
      });
    };
    check();
  });
}

const esbuildShared = {
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  external: ['electron'],
  sourcemap: true,
  logLevel: 'info',
};

const [mainCtx, preloadCtx] = await Promise.all([
  context({
    ...esbuildShared,
    entryPoints: ['electron/main.ts'],
    outfile: 'dist-electron/main.cjs',
  }),
  context({
    ...esbuildShared,
    entryPoints: ['electron/preload.ts'],
    outfile: 'dist-electron/preload.cjs',
  }),
]);

await Promise.all([mainCtx.rebuild(), preloadCtx.rebuild()]);
await Promise.all([mainCtx.watch(), preloadCtx.watch()]);

const viteBin = path.resolve('node_modules/.bin/vite');
const viteProc = spawn(viteBin, ['--port', '5173', '--strictPort'], {
  stdio: 'inherit',
  env: { ...process.env },
});

let electronProc = null;
let shuttingDown = false;

async function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  await Promise.allSettled([mainCtx.dispose(), preloadCtx.dispose()]);
  if (electronProc && !electronProc.killed) {
    electronProc.kill('SIGTERM');
  }
  if (!viteProc.killed) {
    viteProc.kill('SIGTERM');
  }
  process.exit(code);
}

process.on('SIGINT', () => void shutdown(0));
process.on('SIGTERM', () => void shutdown(0));

viteProc.on('exit', (code) => {
  if (!shuttingDown) {
    void shutdown(code ?? 1);
  }
});

try {
  await waitForServer(DEV_SERVER_URL);
  const electronBinary = require('electron');
  electronProc = spawn(electronBinary, ['.'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      VITE_DEV_SERVER_URL: DEV_SERVER_URL,
    },
  });

  electronProc.on('exit', (code) => {
    void shutdown(code ?? 0);
  });
} catch (err) {
  console.error(err);
  await shutdown(1);
}
