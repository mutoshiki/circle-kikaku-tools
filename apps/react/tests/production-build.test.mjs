import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

test('production runtime bundle excludes injectable test adapters', async () => {
  const assetsDir = new URL('../dist/assets/', import.meta.url);
  const assets = await readdir(assetsDir);
  const bundles = await Promise.all(assets.filter(name => name.endsWith('.js')).map(name => readFile(new URL(name, assetsDir), 'utf8')));
  const runtime = bundles.join('\n');
  assert.doesNotMatch(runtime, /__REACT_ROUTE_ADAPTER__/);
  assert.doesNotMatch(runtime, /__REACT_EXTERNAL_ADAPTERS__/);
});
