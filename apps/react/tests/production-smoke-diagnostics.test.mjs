import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
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
