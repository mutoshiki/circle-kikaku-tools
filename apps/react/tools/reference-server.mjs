import http from 'node:http';
import { readFileSync, statSync } from 'node:fs';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const port = Number(process.env.REFERENCE_PORT || 4183);
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
http.createServer((request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
    const path = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!path.startsWith(root.endsWith(sep) ? root : root + sep) || !statSync(path).isFile()) throw new Error('Not found');
    let body = readFileSync(path);
    if (path === resolve(root, 'firebase-config.js')) {
      body = body.toString().replace(/window\.SANPO_FIREBASE_CONFIG\s*=\s*\{[\s\S]*?\};/, 'window.SANPO_FIREBASE_CONFIG = {};');
      if (/databaseURL\s*:/.test(body)) throw new Error('Reference Firebase isolation failed');
    }
    response.writeHead(200, { 'content-type': mime[extname(path)] || 'application/octet-stream', 'cache-control': 'no-store' });
    response.end(body);
  } catch {
    response.writeHead(404);
    response.end('Not found');
  }
}).listen(port, '127.0.0.1', () => console.log(`Isolated legacy reference: http://127.0.0.1:${port}`));
