import fs from 'node:fs';
import assert from 'node:assert/strict';

const feature = fs.readFileSync(new URL('../assets/js/features/form-applicant-sync-v2.js', import.meta.url), 'utf8');
const loader = fs.readFileSync(new URL('../firebase-config.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../assets/css/guides-modals/import-guide/07-form-applicant-sync.css', import.meta.url), 'utf8');

assert.match(loader, /form-applicant-sync-v2\.js\?v=form-applicant-sync-v2/);
assert.match(loader, /07-form-applicant-sync\.css\?v=form-applicant-sync-v2/);
assert.doesNotMatch(loader, /form-link-sync\.js/);
assert.doesNotMatch(loader, /06-form-auto-link\.css/);

assert.match(feature, /APPLICATION_KIND\s*=\s*['"]formApplicationSync['"]/);
assert.match(feature, /APPLICATION_VERSION\s*=\s*2/);
assert.match(feature, /room\?\.meta\?\.applicationSync/);
assert.match(feature, /応募フォームの回答は自動でここに届きます/);
assert.match(feature, /選択した人を参加者にする/);
assert.match(feature, /SanpoCanonicalState\.ensureParticipant/);
assert.match(feature, /findParticipantIdByName/);
assert.match(feature, /source|applicant/);
assert.match(feature, /applicant\.capacity/);
assert.match(feature, /capacity:\s*incomingCapacity/);
assert.match(feature, /kind:\s*['"]driver['"]/);
assert.match(feature, /g_car_/);
assert.match(feature, /ensureAllParticipantsPlaced/);

// Managed form projects must not expose the old spreadsheet-URL linking workflow.
assert.doesNotMatch(feature, /spreadsheets\/d/);
assert.doesNotMatch(feature, /formAutoLink/);
assert.doesNotMatch(feature, /この企画と連携/);

// The dynamic UI stays on Carbon controls.
assert.match(feature, /<cds-checkbox/);
assert.match(feature, /<cds-button/);
assert.doesNotMatch(feature, /<(?:input|textarea|select|button)\b/i);

assert.match(css, /\.form-applicant-sync/);
assert.match(css, /data-form-applicant-mode="true"/);
assert.match(css, /var\(--cds-/);

console.log('PASS direct applicant sync v2 contract');
