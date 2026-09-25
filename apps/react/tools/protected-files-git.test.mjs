import test from 'node:test';
import assert from 'node:assert/strict';
import { sameCheckoutContent } from './protected-files-git.mjs';

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
