import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const events = read('assets/js/features/events.js');
const rules = read('firebase/database.rules.json');
const functions = read('functions/index.js');
const firebase = JSON.parse(read('firebase.json'));

for (const [label, url] of [
  ['山歩会フォームメーカー', 'https://script.google.com/macros/s/AKfycbw0R5VgBdSLS8aRDJDw7GUIEfHlXRZ6rPrOgjXmO2N7LvhuoGyS_opUCFTCSiUiDZw5/exec'],
  ['学務提出書類作成ツール', 'https://github.com/mutoshiki/sampokai-submission-builder/releases'],
  ['山歩会企画ツール一覧', 'https://mutoshiki.github.io/sanpokai-kikaku-portal/']
]) {
  assert.ok(events.includes(label), label);
  assert.ok(events.includes(url), url);
}

assert.match(events, /バグを報告する/);
assert.match(events, /label="バグの内容"/);
assert.match(events, />送信<\/cds-modal-footer-button>/);
assert.match(events, /databaseModule\.ref\(activeDb, 'bugReports'\)/);
for (const field of ['message', 'createdAt', 'roomId', 'pageUrl', 'buildId', 'projectTitle', 'currentView', 'userAgent', 'platform']) {
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
assert.match(functions, /retry: true/);
for (const secret of ['RESEND_API_KEY', 'BUG_REPORT_NOTIFY_TO', 'BUG_REPORT_NOTIFY_FROM']) {
  assert.match(functions, new RegExp(`defineSecret\\('${secret}'\\)`), secret);
}
assert.match(functions, /【サークル企画ツール】新しいバグ報告/);
assert.match(functions, /Idempotency-Key/);
assert.match(functions, /circle-kikaku-bug-report\/\$\{reportId\}/);
assert.match(functions, /existing\?\.status === 'sent'/);
assert.match(functions, /bugReportNotifications/);
assert.doesNotMatch(functions, /['"][^'"\s]+@gmail\.com['"]/i, 'Gmail destination must not be hard-coded');
assert.doesNotMatch(functions, /rooms\//, 'notification function must not touch room sync paths');
for (const label of ['バグ内容:', '送信日時:', 'room ID:', 'URL:', 'build ID:', '企画名:', '現在の画面:', '端末\/ブラウザ:']) {
  assert.match(functions, new RegExp(label));
}

console.log('PASS bug report storage and notification contract');
