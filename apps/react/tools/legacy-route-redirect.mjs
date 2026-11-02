#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const legacyRouteRedirectHtml = `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex">
    <title>企画を開いています</title>
  </head>
  <body>
    <p><a href="../">企画を開く</a></p>
    <script>
      const destination = new URL('../', window.location.href);
      destination.search = window.location.search;
      destination.hash = window.location.hash;
      window.location.replace(destination.href);
    </script>
  </body>
</html>
`;

export async function writeLegacyRouteRedirect(filePath) {
  const target = path.resolve(filePath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, legacyRouteRedirectHtml, 'utf8');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [filePath, ...extra] = process.argv.slice(2);
  if (!filePath || extra.length) {
    process.stderr.write('usage: legacy-route-redirect <output-file>\n');
    process.exitCode = 1;
  } else {
    try {
      await writeLegacyRouteRedirect(filePath);
    } catch (error) {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    }
  }
}
