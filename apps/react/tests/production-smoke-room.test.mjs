import assert from 'node:assert/strict';
import test from 'node:test';
import { cleanupProductionSmokeRoom, seedProductionSmokeRoom } from './production/firebase-smoke-room.mjs';

const config = {
  apiKey: 'unit-test-key',
  projectId: 'sanpokai-tool',
  databaseURL: 'https://sanpokai-tool-default-rtdb.firebaseio.com',
};
const roomId = 'P9A93LMQ';
const marker = 'react-release-12345-1';

async function withFetch(handler, run) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = handler;
  try { await run(); } finally { globalThis.fetch = originalFetch; }
}

function evaluatePage() {
  return {
    evaluate: (callback, options) => {
      const isolatedCallback = new Function(`return (${callback.toString()})`)();
      return isolatedCallback(options);
    },
  };
}

function jsonResponse(body, status = 200) {
  return new Response(body === undefined ? '' : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

test('production smoke seeds only the reserved empty room through a browser-origin request', async () => {
  const requests = [];
  await withFetch(async (url, options) => {
    requests.push({ url: String(url), options });
    if (String(url).includes('accounts:signUp')) return jsonResponse({ idToken: 'test-token' });
    if (options.method === 'PUT') return jsonResponse({ roomName: marker });
    return jsonResponse(null);
  }, async () => {
    assert.equal(await seedProductionSmokeRoom(evaluatePage(), { config, roomId, marker, data: { roomName: marker } }), 'seeded');
  });
  assert.deepEqual(requests.map(request => request.options.method || 'GET'), ['POST', 'GET', 'PUT']);
  assert.ok(requests.every(request => request.options.referrerPolicy === 'origin'));
});

test('production smoke does not overwrite unmarked reserved room data', async () => {
  const requests = [];
  await withFetch(async (url, options) => {
    requests.push({ url: String(url), options });
    if (String(url).includes('accounts:signUp')) return jsonResponse({ idToken: 'test-token' });
    return jsonResponse({ roomName: 'ordinary project data' });
  }, async () => {
    await assert.rejects(seedProductionSmokeRoom(evaluatePage(), { config, roomId, marker, data: {} }), /unmarked data/);
  });
  assert.equal(requests.length, 2);
});

test('production smoke cleanup requires an owned release marker and verifies deletion', async () => {
  let room = { roomName: `${marker}-updated` };
  const methods = [];
  await withFetch(async (url, options) => {
    methods.push(options.method || 'GET');
    if (String(url).includes('accounts:signUp')) return jsonResponse({ idToken: 'test-token' });
    if (options.method === 'DELETE') { room = null; return jsonResponse(null); }
    return jsonResponse(room);
  }, async () => {
    assert.equal(await cleanupProductionSmokeRoom(evaluatePage(), { config, roomId, marker }), 'cleaned');
  });
  assert.deepEqual(methods, ['POST', 'GET', 'DELETE', 'GET']);
  assert.equal(room, null);
});
