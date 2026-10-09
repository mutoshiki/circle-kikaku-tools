import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyPublishedRouteManifests } from '../tools/verify-published-route-manifests.mjs';

const identity = { sourceSha: 'a'.repeat(40), assetDigest: 'b'.repeat(64) };

test('requires both public route manifests to match the recovered successful archive', async () => {
  const urls = [];
  const result = await verifyPublishedRouteManifests({
    ...identity,
    cacheBuster: 'test-only',
    fetchImpl: async (url, options) => {
      urls.push({ url: String(url), options });
      return { ok: true, json: async () => identity };
    },
  });
  assert.deepEqual(result.map(item => item.path), ['/circle-kikaku-tools/release-build.json', '/circle-kikaku-tools/react/release-build.json']);
  assert.equal(urls.length, 2);
  assert.ok(urls.every(({ url, options }) => url.includes('releaseCheck=test-only') && options.cache === 'no-store'));
});

test('stops before diagnosis when either published route is not the verified archive', async () => {
  let requests = 0;
  await assert.rejects(verifyPublishedRouteManifests({
    ...identity,
    fetchImpl: async () => ({ ok: true, json: async () => requests++ === 0 ? identity : { ...identity, sourceSha: 'c'.repeat(40) } }),
  }), /does not match the verified successful archive/);
});
