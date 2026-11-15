import assert from 'node:assert/strict';
import test from 'node:test';
import { cleanupProductionSmokeRoom, productionSmokeRoomId, seedProductionSmokeRoom } from './production/firebase-smoke-room.mjs';

const config = {
  apiKey: 'unit-test-key',
  projectId: 'sanpokai-tool',
  databaseURL: 'https://sanpokai-tool-default-rtdb.firebaseio.com',
};
const marker = 'react-release-12345-1';
const roomId = productionSmokeRoomId(marker);

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
    headers: { 'Content-Type': 'application/json', ETag: 'fixture-etag' },
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
    assert.equal(await seedProductionSmokeRoom(evaluatePage(), {
      config,
      roomId,
      marker,
      data: { roomName: marker, participantTombstones: {}, syncOperations: {}, overview: { memo: 'smoke' } },
    }), 'seeded');
  });
  assert.deepEqual(requests.map(request => request.options.method || 'GET'), ['POST', 'GET', 'PUT']);
  assert.ok(requests.every(request => request.options.referrerPolicy === 'origin'));
  const seedRequest = requests.find(request => request.options.method === 'PUT');
  assert.equal(seedRequest.options.headers['If-Match'], 'null_etag');
  assert.deepEqual(JSON.parse(seedRequest.options.body), { roomName: marker, overview: { memo: 'smoke' } });
});

test('production smoke does not overwrite unmarked reserved room data', async () => {
  const requests = [];
  await withFetch(async (url, options) => {
    requests.push({ url: String(url), options });
    if (String(url).includes('accounts:signUp')) return jsonResponse({ idToken: 'test-token' });
    return jsonResponse({ roomName: 'ordinary project data' });
  }, async () => {
    await assert.rejects(seedProductionSmokeRoom(evaluatePage(), { config, roomId, marker, data: {} }), /already exists/);
  });
  assert.equal(requests.length, 2);
});

test('production smoke reports the Firebase seed rejection reason without exposing request credentials', async () => {
  await withFetch(async (url, options) => {
    if (String(url).includes('accounts:signUp')) return jsonResponse({ idToken: 'test-token' });
    if (options.method === 'PUT') return jsonResponse({ error: 'Permission denied' }, 401);
    return jsonResponse(null);
  }, async () => {
    await assert.rejects(
      seedProductionSmokeRoom(evaluatePage(), { config, roomId, marker, data: { roomName: marker } }),
      /Reserved smoke room seed failed \(401: Permission denied\)/,
    );
  });
});

test('production smoke cleanup requires an owned release marker and verifies deletion', async () => {
  let room = { roomName: `${marker}-updated` };
  const methods = [];
  await withFetch(async (url, options) => {
    methods.push(options.method || 'GET');
    if (String(url).includes('accounts:signUp')) return jsonResponse({ idToken: 'test-token' });
    if (options.method === 'DELETE') { assert.equal(options.headers['If-Match'], 'fixture-etag'); room = null; return jsonResponse(null); }
    return jsonResponse(room);
  }, async () => {
    assert.equal(await cleanupProductionSmokeRoom(evaluatePage(), { config, roomId, marker }), 'cleaned');
  });
  assert.deepEqual(methods, ['POST', 'GET', 'DELETE', 'GET']);
  assert.equal(room, null);
});
test('production smoke accepts a run-scoped diagnostic marker for its reserved room', async () => {
  const diagnosticMarker = 'react-diagnostic-98765-2';
  const methods = [];
  let room = null;
  await withFetch(async (url, options) => {
    methods.push(options.method || 'GET');
    if (String(url).includes('accounts:signUp')) return jsonResponse({ idToken: 'test-token' });
    if (options.method === 'PUT') { room = { roomName: diagnosticMarker }; return jsonResponse(room); }
    if (options.method === 'DELETE') { assert.equal(options.headers['If-Match'], 'fixture-etag'); room = null; return jsonResponse(null); }
    return jsonResponse(room);
  }, async () => {
    assert.equal(await seedProductionSmokeRoom(evaluatePage(), { config, roomId: productionSmokeRoomId(diagnosticMarker), marker: diagnosticMarker, data: { roomName: diagnosticMarker } }), 'seeded');
    assert.equal(await cleanupProductionSmokeRoom(evaluatePage(), { config, roomId: productionSmokeRoomId(diagnosticMarker), marker: diagnosticMarker }), 'cleaned');
  });
  assert.deepEqual(methods, ['POST', 'GET', 'PUT', 'POST', 'GET', 'DELETE', 'GET']);
});

test('run, attempt and diagnostic mode use independent room IDs', () => {
  const markers = [marker, 'react-release-12345-2', 'react-release-12346-1', 'react-diagnostic-12345-1'];
  assert.equal(new Set(markers.map(productionSmokeRoomId)).size, markers.length);
  assert.equal(productionSmokeRoomId('ordinary-project'), '');
});

test('cleanup refuses P9 and room IDs belonging to another run before any request', async () => {
  for (const wrongId of ['P9A93LMQ', productionSmokeRoomId('react-release-12345-2')]) {
    await assert.rejects(cleanupProductionSmokeRoom(null, { config, roomId: wrongId, marker }), /target guard/);
  }
});

test('cleanup leaves foreign ownership untouched even within the expected room ID', async () => {
  await withFetch(async (url, options) => {
    if (String(url).includes('accounts:signUp')) return jsonResponse({ idToken: 'test-token' });
    assert.equal(options.method, undefined);
    return jsonResponse({ roomName: 'react-release-12345-2' });
  }, async () => {
    await assert.rejects(cleanupProductionSmokeRoom(evaluatePage(), { config, roomId, marker }), /does not belong/);
  });
});
