import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const require = createRequire(import.meta.url);
const header = read('assets/js/features/events/02-static-header-events.js');
const events = read('assets/js/features/events.js');
const rules = read('firebase/database.rules.json');
const functions = read('functions/index.js');
const appsScript = read('apps-script/bug-report-mailer/Code.gs');
const firebase = JSON.parse(read('firebase.json'));
const {
  SEND_LEASE_MS,
  acquireLeaseState,
  sentState,
  failedState
} = require('../functions/notification-state.js');

for (const [label, url] of [
  ['山歩会フォームメーカー', 'https://script.google.com/macros/s/AKfycbw0R5VgBdSLS8aRDJDw7GUIEfHlXRZ6rPrOgjXmO2N7LvhuoGyS_opUCFTCSiUiDZw5/exec'],
  ['学務提出書類作成ツール', 'https://github.com/mutoshiki/sampokai-submission-builder/releases'],
  ['山歩会企画ツール一覧', 'https://mutoshiki.github.io/sanpokai-kikaku-portal/']
]) {
  assert.ok(header.includes(label), label);
  assert.ok(header.includes(url), url);
}

assert.match(events, /バグを報告する/);
assert.match(events, /label="バグの内容"/);
assert.match(events, />送信<\/cds-modal-footer-button>/);
assert.match(events, /databaseModule\.ref\(activeDb, 'bugReports'\)/);
assert.match(events, /createdAt: databaseModule\.serverTimestamp\(\)/);
for (const field of ['message', 'roomId', 'pageUrl', 'buildId', 'projectTitle', 'currentView', 'userAgent', 'platform']) {
  assert.match(events, new RegExp(`${field}:`), `client bug report field: ${field}`);
}

assert.match(rules, /"bugReports"/);
assert.match(rules, /"\.read": false/);
assert.match(rules, /auth != null && !data\.exists\(\) && newData\.exists\(\)/);
assert.match(rules, /newData\.val\(\)\.length <= 2000/);
assert.match(rules, /"\$other"[\s\S]*"\.validate": false/);
assert.match(rules, /"bugReportNotifications"[\s\S]*"\.read": false[\s\S]*"\.write": false/);

assert.equal(firebase.functions.source, 'functions');
assert.match(functions, /onValueCreated/);
assert.match(functions, /ref: '\/bugReports\/\{reportId\}'/);
assert.match(functions, /region: 'us-central1'/);
assert.match(functions, /retry: true/);
assert.match(functions, /timeoutSeconds: 120/);
for (const secret of ['BUG_REPORT_MAIL_WEBHOOK_URL', 'BUG_REPORT_MAIL_WEBHOOK_SECRET']) {
  assert.match(functions, new RegExp(`defineSecret\\('${secret}'\\)`), secret);
}
assert.doesNotMatch(functions, /RESEND|resend\.com|Idempotency-Key/i, 'Resend must not be used');
assert.match(functions, /statusRef\.transaction/);
assert.match(functions, /acquireLeaseState/);
assert.match(functions, /sentState/);
assert.match(functions, /failedState/);
assert.match(functions, /bugReportNotifications/);
assert.match(functions, /【サークル企画ツール】新しいバグ報告/);
assert.doesNotMatch(functions, /['"][^'"\s]+@gmail\.com['"]/i, 'Gmail destination must not be hard-coded');
assert.doesNotMatch(functions, /rooms\//, 'notification function must not touch room sync paths');
for (const label of ['バグ内容:', '送信日時:', 'room ID:', 'URL:', 'build ID:', '企画名:', '現在の画面:', '端末\/ブラウザ:']) {
  assert.match(functions, new RegExp(label));
}

assert.match(appsScript, /MailApp\.sendEmail/);
assert.match(appsScript, /GmailApp\.search/);
assert.match(appsScript, /LockService\.getScriptLock/);
assert.match(appsScript, /PropertiesService\.getScriptProperties/);
assert.match(appsScript, /BUG_REPORT_WEBHOOK_SECRET/);
assert.match(appsScript, /BUG_REPORT_NOTIFY_TO/);
assert.match(appsScript, /circle-kikaku-bug-report-/);
assert.doesNotMatch(appsScript, /['"][^'"\s]+@gmail\.com['"]/i, 'Apps Script destination must not be hard-coded');

const now = 1_000_000;
const first = acquireLeaseState(null, { now, leaseToken: 'lease-a', eventId: 'event-a' });
assert.equal(first.status, 'sending');
assert.equal(first.leaseExpiresAt, now + SEND_LEASE_MS);
assert.equal(first.attemptCount, 1);
assert.equal(acquireLeaseState(first, { now: now + 1, leaseToken: 'lease-b', eventId: 'event-b' }), undefined, 'fresh sending lease blocks a second sender');

const failed = failedState(first, { now: now + 2, leaseToken: 'lease-a', eventId: 'event-a', error: 'network' });
assert.equal(failed.status, 'failed');
const retry = acquireLeaseState(failed, { now: now + 3, leaseToken: 'lease-b', eventId: 'event-b' });
assert.equal(retry.status, 'sending', 'failed delivery is retryable');
assert.equal(retry.attemptCount, 2);

const sent = sentState(retry, { now: now + 4, leaseToken: 'lease-b', eventId: 'event-b' });
assert.equal(sent.status, 'sent');
assert.equal(acquireLeaseState(sent, { now: now + (25 * 60 * 60 * 1000), leaseToken: 'lease-c', eventId: 'event-c' }), undefined, 'sent remains terminal after 24 hours');

const expired = { ...first, leaseExpiresAt: now - 1 };
const recovered = acquireLeaseState(expired, { now, leaseToken: 'lease-c', eventId: 'event-c' });
assert.equal(recovered.status, 'sending', 'expired in-flight lease is retryable');

console.log('PASS bug report storage, atomic lease, and free Gmail notification contract');
