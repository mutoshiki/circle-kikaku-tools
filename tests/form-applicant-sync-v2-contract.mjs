import fs from 'node:fs';
import assert from 'node:assert/strict';

const feature = fs.readFileSync(new URL('../assets/js/features/form-applicant-sync-v2.js', import.meta.url), 'utf8');
const checkboxBridge = fs.readFileSync(new URL('../assets/js/features/carbon-checkbox-state-bridge.js', import.meta.url), 'utf8');
const loader = fs.readFileSync(new URL('../firebase-config.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../assets/css/guides-modals/import-guide/07-form-applicant-sync.css', import.meta.url), 'utf8');
const settlementEmpty = fs.readFileSync(new URL('../assets/js/templates/settlement/07-empty-state-templates.js', import.meta.url), 'utf8');
const commonEmpty = fs.readFileSync(new URL('../assets/js/templates/common-empty-state.js', import.meta.url), 'utf8');

assert.match(loader, /form-applicant-sync-v2\.js\?v=participants-tab-v84/);
assert.match(loader, /carbon-checkbox-state-bridge\.js\?v=participants-tab-v84/);
assert.match(loader, /07-form-applicant-sync\.css\?v=participants-tab-v84/);
assert.doesNotMatch(loader, /form-link-sync\.js/);
assert.doesNotMatch(loader, /06-form-auto-link\.css/);

assert.match(feature, /APPLICATION_KIND\s*=\s*['"]formApplicationSync['"]/);
assert.match(feature, /APPLICATION_VERSION\s*=\s*2/);
assert.match(feature, /room\?\.meta\?\.applicationSync/);
assert.match(feature, /rooms\/\$\{roomId\}\/meta\/applicationSync/);
assert.match(feature, /onValue\(/);
assert.match(feature, /liveApplicationSync/);

// Participant management is a first-class Carbon tab instead of a modal-only import step.
assert.match(feature, /id = ['"]tab-participants['"]/);
assert.match(feature, /setAttribute\(['"]value['"], ['"]participants['"]\)/);
assert.match(feature, /participants-view-area/);
assert.match(feature, /応募者を確認して、当選者を選んでください/);
assert.match(feature, /選択を反映/);
assert.match(feature, /open-participants/);
assert.match(feature, /view-mode-participants/);
assert.match(feature, /get\(['"]view['"]\) === ['"]participants['"]/);

// Existing selections remain editable; removals use canonical deletion and Carbon confirmation.
assert.match(feature, /data-manual-participant-id/);
assert.match(feature, /SanpoCanonicalState\?\.deleteParticipant/);
assert.match(feature, /AppUI\?\.confirm/);
assert.match(feature, /参加者から外しますか/);
assert.match(feature, /車割・班割・精算の割り当ても削除されます/);

// Carbon checkbox internal state is reflected to the host before participant selection is read.
assert.match(checkboxBridge, /#formApplicantList cds-checkbox/);
assert.match(checkboxBridge, /shadowRoot\?\.querySelector/);
assert.match(checkboxBridge, /cds-checkbox-changed/);
assert.match(checkboxBridge, /toggleAttribute\(['"]checked['"]/);

// Form fields continue to feed the canonical participant and car capacity.
assert.match(feature, /SanpoCanonicalState\.ensureParticipant/);
assert.match(feature, /findParticipantIdByName/);
assert.match(feature, /applicant\.capacity/);
assert.match(feature, /capacity:\s*incomingCapacity/);
assert.match(feature, /kind:\s*['"]driver['"]/);
assert.match(feature, /g_car_/);
assert.match(feature, /ensureAllParticipantsPlaced/);

// Managed form projects must not expose the old spreadsheet-URL linking workflow.
assert.doesNotMatch(feature, /spreadsheets\/d/);
assert.doesNotMatch(feature, /formAutoLink/);
assert.doesNotMatch(feature, /この企画と連携/);

// The dynamic UI stays on Carbon controls and does not duplicate checkbox labels as names.
assert.match(feature, /<cds-checkbox/);
assert.match(feature, /<cds-button/);
assert.doesNotMatch(feature, /<(?:input|textarea|select|button)\b/i);
assert.doesNotMatch(feature, /form-applicant-sync__name/);

assert.match(css, /\.participants-view-area/);
assert.match(css, /\.participants-page/);
assert.match(css, /\.form-applicant-sync__row/);
assert.match(css, /var\(--cds-/);
assert.doesNotMatch(css, /data-form-applicant-mode/);

// Empty states lead to the Participants tab and keep the alternative count-only settlement path.
assert.match(settlementEmpty, /data-action="open-participants"/);
assert.match(settlementEmpty, /応募者を確認/);
assert.match(settlementEmpty, /参加者を追加/);
assert.match(settlementEmpty, /人数だけで精算/);
assert.match(commonEmpty, /data-action="open-participants"/);
assert.doesNotMatch(commonEmpty, /参加者登録\(推奨\)/);
assert.doesNotMatch(commonEmpty, /もしくは/);

console.log('PASS participants tab and direct applicant sync contract');