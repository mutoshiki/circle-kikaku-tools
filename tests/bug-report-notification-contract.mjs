import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const header = read('assets/js/features/events/02-static-header-events.js');
const events = read('assets/js/features/events.js');
const rules = read('firebase/database.rules.json');
const appsScript = read('apps-script/bug-report-mailer/Code.gs');
const stateSource = read('apps-script/bug-report-mailer/State.gs');
const manifest = JSON.parse(read('apps-script/bug-report-mailer/appsscript.json'));
const firebase = JSON.parse(read('firebase.json'));

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

assert.equal(firebase.functions, undefined, 'Cloud Functions must not be required for the free notification path');
assert.doesNotMatch(appsScript, /RESEND|resend\.com|Cloud Functions|defineSecret/i);
assert.match(appsScript, /FIREBASE_SERVICE_ACCOUNT_JSON/);
assert.match(appsScript, /FIREBASE_DATABASE_URL/);
assert.match(appsScript, /BUG_REPORT_NOTIFY_TO/);
assert.match(appsScript, /https:\/\/oauth2\.googleapis\.com\/token/);
assert.match(appsScript, /https:\/\/www\.googleapis\.com\/auth\/firebase\.database/);
assert.match(appsScript, /X-Firebase-ETag/);
assert.match(appsScript, /if-match/);
assert.match(appsScript, /code === 412/);
assert.match(appsScript, /notificationTransaction_/);
assert.match(appsScript, /LockService\.getScriptLock/);
assert.match(appsScript, /everyMinutes\(1\)/);
assert.match(appsScript, /MailApp\.sendEmail/);
assert.match(appsScript, /GmailApp\.search/);
assert.match(appsScript, /PropertiesService\.getScriptProperties/);
assert.match(appsScript, /circle-kikaku-bug-report-/);
assert.doesNotMatch(appsScript, /['"][^'"\s]+@gmail\.com['"]/i, 'Gmail destination must not be hard-coded');
assert.doesNotMatch(appsScript, /rooms\//, 'notification worker must not touch room sync paths');
for (const label of ['バグ内容:', '送信日時:', 'room ID:', 'URL:', 'build ID:', '企画名:', '現在の画面:', '端末\/ブラウザ:']) {
  assert.match(appsScript, new RegExp(label));
}

for (const scope of [
  'https://www.googleapis.com/auth/script.scriptapp',
  'https://www.googleapis.com/auth/script.external_request',
  'https://www.googleapis.com/auth/script.send_mail',
  'https://mail.google.com/'
]) {
  assert.ok(manifest.oauthScopes.includes(scope), scope);
}

const context = vm.createContext({ Math, Number, String });
vm.runInContext(stateSource, context);
const now = 1_000_000;
const first = context.acquireBugReportLeaseState_(null, now, 'lease-a', 'event-a');
assert.equal(first.status, 'sending');
assert.equal(first.leaseExpiresAt, now + context.BUG_REPORT_SEND_LEASE_MS);
assert.equal(first.attemptCount, 1);
assert.equal(context.acquireBugReportLeaseState_(first, now + 1, 'lease-b', 'event-b'), null, 'fresh sending lease blocks a second sender');

const failed = context.failedBugReportNotificationState_(first, now + 2, 'lease-a', 'event-a', 'network');
assert.equal(failed.status, 'failed');
const retry = context.acquireBugReportLeaseState_(failed, now + 3, 'lease-b', 'event-b');
assert.equal(retry.status, 'sending', 'failed delivery is retryable');
assert.equal(retry.attemptCount, 2);

const sent = context.sentBugReportNotificationState_(retry, now + 4, 'lease-b', 'event-b', false);
assert.equal(sent.status, 'sent');
assert.equal(context.acquireBugReportLeaseState_(sent, now + (25 * 60 * 60 * 1000), 'lease-c', 'event-c'), null, 'sent remains terminal after 24 hours');

const expired = { ...first, leaseExpiresAt: now - 1 };
const recovered = context.acquireBugReportLeaseState_(expired, now, 'lease-c', 'event-c');
assert.equal(recovered.status, 'sending', 'expired in-flight lease is retryable');

console.log('PASS bug report storage, atomic CAS lease, and Spark-compatible Gmail notification contract');
