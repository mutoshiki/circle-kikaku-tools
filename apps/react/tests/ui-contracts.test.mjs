import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createNotice,
  isToastNotice,
  modalTaskPolicy,
  notice,
} from '../src/ui/task-contracts.js';
import { focusFirstInvalid } from '../src/ui/focus-first-invalid.js';

test('notice contract keeps severity and placement explicit', () => {
  assert.deepEqual(notice.success('リンクをコピーしました', { placement: 'toast' }), {
    kind: 'success', title: 'リンクをコピーしました', subtitle: '', placement: 'toast', timeout: 2600,
  });
  assert.deepEqual(notice.error('保存できませんでした', { subtitle: '接続を確認して再試行してください。' }), {
    kind: 'error', title: '保存できませんでした', subtitle: '接続を確認して再試行してください。', placement: 'inline', timeout: 0,
  });
  assert.equal(isToastNotice(notice.info('コピーしました', { placement: 'toast' })), true);
  assert.equal(isToastNotice(notice.warning('入力を確認してください。')), false);
});

test('invalid notice metadata fails safe without parsing Japanese text', () => {
  assert.deepEqual(createNotice({ kind: 'celebrate', title: '保存しました', placement: 'floating' }), {
    kind: 'error', title: '保存しました', subtitle: '', placement: 'inline', timeout: 0,
  });
  assert.throws(() => createNotice({ kind: 'success', title: '   ' }), /title/i);
});

test('modal registry distinguishes approved brief tasks from migrations', () => {
  assert.deepEqual(modalTaskPolicy('participant-edit'), {
    id: 'participant-edit', status: 'approved-brief', targetPhase: null,
    reason: '少数項目を編集して1回保存する短いtask',
  });
  assert.deepEqual(modalTaskPolicy('participant-registration'), {
    id: 'participant-registration', status: 'legacy-migration', targetPhase: 'D',
    reason: 'import、preview、correctionを含む長いtask',
  });
  assert.deepEqual(modalTaskPolicy('not-registered'), {
    id: 'not-registered', status: 'unregistered', targetPhase: null,
    reason: 'Modal task is not registered',
  });
});

test('focus helper focuses and reveals the first enabled invalid control', () => {
  const events = [];
  const field = {
    focus() { events.push('focus'); },
    scrollIntoView(options) { events.push(options); },
  };
  const root = { querySelector(selector) { events.push(selector); return field; } };
  assert.equal(focusFirstInvalid(root), true);
  assert.deepEqual(events.slice(1), ['focus', { block: 'nearest', inline: 'nearest' }]);
  assert.equal(focusFirstInvalid({ querySelector: () => null }), false);
});
