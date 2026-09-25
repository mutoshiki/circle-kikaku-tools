import { build, preview } from 'vite';
import { resolve } from 'node:path';
import { assertTestFirebaseTarget } from '../../../tools/test-firebase-target.mjs';

const mode = process.argv[2] || 'offline';
assertTestFirebaseTarget({ allowed: [mode] });
process.env.VITE_REACT_SYNC_MODE = mode === 'emulator' ? 'emulator' : 'local';
delete process.env.VITE_REACT_FIREBASE_CONFIG;
delete process.env.VITE_REACT_MAPS_API_KEY;

const outDir = mode === 'emulator' ? 'dist-emulator-test' : 'dist-offline-test';
const configFile = resolve('vite.config.js');
await build({ configFile, mode: 'test', build: { outDir, emptyOutDir: true } });
const port = mode === 'emulator' ? 4175 : 4176;
const server = await preview({
  configFile,
  mode: 'test',
  build: { outDir },
  preview: { host: '127.0.0.1', port, strictPort: true },
});
server.printUrls();
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => server.httpServer.close(() => process.exit(0)));
}
