import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createSmokeDiagnostics } from './production/production-smoke-diagnostics.mjs';

class FakeContext extends EventEmitter {}
class FakePage extends EventEmitter {}
function request(url, method = 'POST') {
  return { url: () => url, method: () => method, failure: () => ({ errorText: 'net::ERR_FAILED' }) };
}

test('records identity request lifecycle, phase, and only safe CORS headers', async () => {
  const context = new FakeContext();
  const page = new FakePage();
  const diagnostics = createSmokeDiagnostics(context, { browserName: 'webkit' });
  diagnostics.setPhase('smoke room seed helper');
  context.emit('page', page);
  const req = request('https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=secret-api-key&token=private');
  context.emit('request', req);
  context.emit('response', { request: () => req, status: () => 403, headers: async () => ({
    'access-control-allow-origin': 'https://mutoshiki.github.io',
    'access-control-allow-credentials': 'true',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type, x-client-version',
    authorization: 'must-not-be-recorded',
  }) });
  await new Promise(resolve => setTimeout(resolve, 0));
  context.emit('requestfailed', req);
  page.emit('console', { type: () => 'error', text: () => 'Access to fetch at https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=secret from origin ... blocked by CORS policy' });
  const output = diagnostics.snapshot();
  diagnostics.dispose();

  assert.equal(output.browser, 'webkit');
  assert.equal(output.requests.length, 1);
  assert.equal(output.requests[0].phase, 'smoke room seed helper');
  assert.equal(output.requests[0].path, '/v1/accounts:signUp');
  assert.equal(output.requests[0].status, 403);
  assert.equal(output.requests[0].accessControlAllowOrigin, 'https://mutoshiki.github.io');
  assert.equal(output.requests[0].accessControlAllowCredentials, 'true');
  assert.equal(output.requests[0].failure, 'network-failed');
  assert.equal(JSON.stringify(output).includes('secret-api-key'), false);
  assert.equal(JSON.stringify(output).includes('must-not-be-recorded'), false);
  assert.equal(output.consoleErrors[0].category, 'cors');
});

test('ignores requests outside Identity Toolkit and bounds retained evidence', () => {
  const context = new FakeContext();
  const diagnostics = createSmokeDiagnostics(context, { browserName: 'webkit', maxRequests: 1 });
  context.emit('request', request('https://maps.googleapis.com/maps/api/js?key=maps-secret'));
  context.emit('request', request('https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=one'));
  context.emit('request', request('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=two'));
  const output = diagnostics.snapshot();
  diagnostics.dispose();
  assert.equal(output.requests.length, 1);
  assert.equal(output.droppedRequests, 1);
  assert.equal(JSON.stringify(output).includes('maps-secret'), false);
  assert.equal(JSON.stringify(output).includes('?key='), false);
});

test('preserves wildcard and null allow-origin values for precise CORS diagnosis', async () => {
  const context = new FakeContext();
  const diagnostics = createSmokeDiagnostics(context, { browserName: 'webkit' });
  const req = request('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=secret');
  context.emit('request', req);
  context.emit('response', { request: () => req, status: () => 200, headers: async () => ({
    'access-control-allow-origin': '*',
    'access-control-allow-credentials': 'false',
  }) });
  await new Promise(resolve => setTimeout(resolve, 0));
  const output = diagnostics.snapshot();
  diagnostics.dispose();
  assert.equal(output.requests[0].accessControlAllowOrigin, '*');
  assert.equal(output.requests[0].accessControlAllowCredentials, 'false');
});

test('records same-origin asset responses and safe browser errors without query values', async () => {
  const context = new FakeContext();
  const page = new FakePage();
  const diagnostics = createSmokeDiagnostics(context, { browserName: 'chromium' });
  context.emit('page', page);
  const assetRequest = {
    ...request('https://mutoshiki.github.io/circle-kikaku-tools/assets/index-abc123.js?token=private', 'GET'),
    resourceType: () => 'script',
  };
  context.emit('request', assetRequest);
  context.emit('response', { request: () => assetRequest, status: () => 503, headers: async () => ({ 'content-type': 'text/html; charset=utf-8' }) });
  context.emit('requestfinished', assetRequest);
  await new Promise(resolve => setTimeout(resolve, 0));
  page.emit('console', {
    type: () => 'error',
    text: () => 'Failed to load module https://mutoshiki.github.io/circle-kikaku-tools/assets/index-abc123.js?token=private',
  });
  page.emit('pageerror', { name: 'TypeError', message: 'Failed in https://mutoshiki.github.io/circle-kikaku-tools/assets/chunk.js?access_token=private' });

  const output = diagnostics.snapshot();
  diagnostics.dispose();

  assert.equal(output.assetRequests.length, 1);
  assert.deepEqual(output.assetRequests[0], {
    id: 1,
    phase: 'initial app load',
    elapsedMs: output.assetRequests[0].elapsedMs,
    method: 'GET',
    origin: 'https://mutoshiki.github.io',
    path: '/circle-kikaku-tools/assets/index-abc123.js',
    resourceType: 'script',
    outcome: 'finished',
    status: 503,
    contentType: 'text/html; charset=utf-8',
  });
  assert.equal(output.consoleErrors[0].category, 'resource-load');
  assert.match(output.consoleErrors[0].detail, /assets\/index-abc123\.js/);
  assert.equal(output.consoleErrors[1].category, 'page-error');
  assert.match(output.consoleErrors[1].detail, /assets\/chunk\.js/);
  assert.equal(JSON.stringify(output).includes('private'), false);
  assert.equal(JSON.stringify(output).includes('?token='), false);
});

test('flushes the page route, app boot state, and release manifest without query values', async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'production-smoke-diagnostics-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const context = new FakeContext();
  const page = new FakePage();
  page.url = () => 'https://mutoshiki.github.io/circle-kikaku-tools/react/?room=private-room';
  page.isClosed = () => false;
  page.evaluate = async () => ({
    title: 'サークル企画ツール',
    readyState: 'complete',
    rootChildCount: 0,
    applicationPresent: false,
    scripts: ['https://mutoshiki.github.io/circle-kikaku-tools/react/assets/index-abc.js'],
    stylesheets: ['https://mutoshiki.github.io/circle-kikaku-tools/react/assets/index-def.css'],
    manifest: { status: 200, sourceSha: 'a'.repeat(40), assetDigest: 'b'.repeat(64) },
  });
  const diagnostics = createSmokeDiagnostics(context, { browserName: 'chromium' });
  context.emit('page', page);
  const outputPath = path.join(directory, 'root-production-chromium.json');
  await diagnostics.capturePage(page);
  page.isClosed = () => true;
  await diagnostics.flush(outputPath);
  diagnostics.dispose();

  const output = JSON.parse(await readFile(outputPath, 'utf8'));
  assert.equal(output.pages[0].url.path, '/circle-kikaku-tools/react/');
  assert.equal(output.pages[0].applicationPresent, false);
  assert.equal(output.pages[0].rootChildCount, 0);
  assert.equal(output.pages[0].manifest.status, 200);
  assert.equal(output.pages[0].closed, false);
  assert.equal(output.pages[0].scripts[0], 'https://mutoshiki.github.io/circle-kikaku-tools/react/assets/index-abc.js');
  assert.equal(JSON.stringify(output).includes('private-room'), false);
});
