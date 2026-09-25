import test from 'node:test';
import assert from 'node:assert/strict';
import { isPhase9ATestIsolationOverlay, sameCheckoutContent } from './protected-files-git.mjs';

test('treats Git CRLF/LF checkout materialization as identical', () => {
  assert.equal(sameCheckoutContent(Buffer.from('alpha\nbeta\n'), Buffer.from('alpha\r\nbeta\r\n')), true);
  assert.equal(sameCheckoutContent(Buffer.from('alpha\r\nbeta\n'), Buffer.from('alpha\nbeta\n')), true);
});

test('still detects tracked content changes after EOL normalization', () => {
  assert.equal(sameCheckoutContent(Buffer.from('alpha\nbeta\n'), Buffer.from('alpha\r\nchanged\r\n')), false);
});

test('does not normalize binary file bytes', () => {
  assert.equal(sameCheckoutContent(Buffer.from([0, 13, 10, 1]), Buffer.from([0, 10, 1])), false);
});

test('allowlists only the five Phase 9A test-isolation infrastructure overlays', () => {
  for (const path of ['.github/workflows/quality-guard.yml', 'package.json', 'playwright.config.js', 'playwright.webkit.config.js', 'tools/serve-static.mjs']) {
    assert.equal(isPhase9ATestIsolationOverlay(path), true);
  }
  assert.equal(isPhase9ATestIsolationOverlay('index.html'), false);
  assert.equal(isPhase9ATestIsolationOverlay('assets/js/app.js'), false);
});
