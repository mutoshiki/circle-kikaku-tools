import fs from 'node:fs';
import assert from 'node:assert/strict';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const feature = fs.readFileSync(new URL('../assets/js/features/form-applicant-sync-v2.js', import.meta.url), 'utf8');
const participantUi = fs.readFileSync(new URL('../assets/js/features/participants-ui.js', import.meta.url), 'utf8');
const loader = fs.readFileSync(new URL('../firebase-config.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../assets/css/guides-modals/import-guide/07-form-applicant-sync.css', import.meta.url), 'utf8');
const settlementEmpty = fs.readFileSync(new URL('../assets/js/templates/settlement/07-empty-state-templates.js', import.meta.url), 'utf8');
const commonEmpty = fs.readFileSync(new URL('../assets/js/templates/common-empty-state.js', import.meta.url), 'utf8');
const navigation = fs.readFileSync(new URL('../assets/js/features/events/02-static-header-events.js', import.meta.url), 'utf8');

assert.match(html, /\.\/firebase-config\.js\?v=participants-carbon-v90/);
assert.match(loader, /form-applicant-sync-v2\.js\?v=participants-carbon-v89/);
assert.match(loader, /participants-ui\.js\?v=participants-carbon-v89/);
assert.match(loader, /07-form-applicant-sync\.css\?v=participants-carbon-v89/);
assert.doesNotMatch(loader, /form-link-sync\.js/);
assert.doesNotMatch(loader, /06-form-auto-link\.css/);
assert.doesNotMatch(loader, /carbon-checkbox-state-bridge/);

assert.match(feature, /APPLICATION_KIND\s*=\s*['"]formApplicationSync['"]/);
assert.match(feature, /APPLICATION_VERSION\s*=\s*2/);
assert.match(feature, /room\?\.meta\?\.applicationSync/);
assert.match(feature, /rooms\/\$\{roomId\}\/meta\/applicationSync/);
assert.match(feature, /onValue\(/);
assert.match(feature, /liveApplicationSync/);

assert.match(feature, /id = ['"]tab-participants['"]/);
assert.match(feature, /setAttribute\(['"]value['"], ['"]participants['"]\)/);
assert.match(feature, /participants-view-area/);
assert.match(feature, /open-participants/);
assert.match(feature, /view-mode-participants/);
assert.match(feature, /get\(['"]view['"]\) === ['"]participants['"]/);

assert.match(feature, /shadowRoot\?\.querySelector\?\.\(['"]input\[type=/);
assert.match(feature, /requestAnimationFrame\(syncParticipantNavigationState\)/);
assert.match(feature, /cds-checkbox-changed/);
assert.match(feature, /event\.detail\?\.checked/);
assert.match(feature, /applicantSelectionDraft/);
assert.match(feature, /manualSelectionDraft/);

assert.doesNotMatch(feature, /__carbonPrimaryNavigationObserver\?\.disconnect/);
assert.doesNotMatch(feature, /participantAwarePrimaryNavigationSync/);
assert.match(feature, /window\.syncCarbonPrimaryNavigationState\?\.\(\)/);
assert.match(navigation, /view-mode-participants/);
assert.match(navigation, /\['tab-participants', view === 'participants'\]/);
assert.match(navigation, /document\.body\.classList\.contains\('view-mode-participants'\)[\s\S]*?\? 'participants'/);
assert.match(navigation, /tab\.toggleAttribute\('selected', active\)/);
assert.match(navigation, /tabBar\.value = selectedValue/);

assert.match(css, /\.participants-view-area\s*\{[\s\S]*?order:\s*3;/);
assert.match(css, /\.participants-view-area\s*\{[\s\S]*?flex:\s*1 1 auto;/);
assert.match(css, /\.participants-page__title\s*\{[\s\S]*?display:\s*none;/);

// Carbon selectable-data-table interaction model: current selection, active search,
// compact filters, selected-row state, and one persistent commit action.
assert.match(participantUi, /cds-table-toolbar-search/);
assert.match(participantUi, /応募者を検索/);
assert.match(participantUi, /participantsSelectionFilter/);
assert.match(participantUi, /選択済み/);
assert.match(participantUi, /未選択/);
assert.match(participantUi, /participantsGradeFilter/);
assert.match(participantUi, /participantsDriverFilter/);
assert.match(participantUi, /車出し可/);
assert.match(participantUi, /\$\{selected\} \/ \$\{total\}人を選択/);
assert.match(participantUi, /参加者を確定/);
assert.match(participantUi, /参加者を更新/);
assert.match(participantUi, /aria-label['"], sync \? ['"]当選者を選択/);
assert.match(css, /\.participants-selection-toolbar/);
assert.match(css, /\.form-applicant-sync__row\.is-selected/);
assert.match(css, /var\(--cds-layer-selected-01/);
assert.match(css, /position:\s*sticky;/);

// Participant registration is not exposed from car/team allocation.
assert.match(participantUi, /batchOpenBtn/);
assert.match(participantUi, /removeAllocationRegistrationAction/);
assert.match(participantUi, /button\.remove\(\)/);
assert.match(css, /#top-area \.allocation-toolbar\s*\{[\s\S]*?display:\s*none;/);

assert.match(feature, /restoreAllocationVisibility[\s\S]*?renderActiveCarPlanToDom/);
assert.match(feature, /data-manual-participant-id/);
assert.match(feature, /SanpoCanonicalState\?\.deleteParticipant/);
assert.match(feature, /AppUI\?\.confirm/);
assert.match(feature, /参加者から外しますか/);
assert.match(feature, /車割・班割・精算の割り当ても削除されます/);

assert.match(feature, /SanpoCanonicalState\.ensureParticipant/);
assert.match(feature, /findParticipantIdByName/);
assert.match(feature, /applicant\.capacity/);
assert.match(feature, /capacity:\s*incomingCapacity/);
assert.match(feature, /kind:\s*['"]driver['"]/);
assert.match(feature, /g_car_/);
assert.match(feature, /ensureAllParticipantsPlaced/);

assert.doesNotMatch(feature, /spreadsheets\/d/);
assert.doesNotMatch(feature, /formAutoLink/);
assert.doesNotMatch(feature, /この企画と連携/);

assert.match(feature, /<cds-checkbox/);
assert.match(feature, /<cds-button/);
assert.doesNotMatch(feature, /<(?:input|textarea|select|button)\b/i);
assert.doesNotMatch(feature, /form-applicant-sync__name/);

assert.match(css, /\.participants-view-area/);
assert.match(css, /\.participants-page/);
assert.match(css, /\.form-applicant-sync__row/);
assert.match(css, /var\(--cds-/);
assert.doesNotMatch(css, /data-form-applicant-mode/);

assert.match(settlementEmpty, /data-action="open-participants"/);
assert.match(settlementEmpty, /応募者を確認/);
assert.match(settlementEmpty, /参加者を追加/);
assert.match(settlementEmpty, /人数だけで精算/);
assert.match(commonEmpty, /data-action="open-participants"/);
assert.doesNotMatch(commonEmpty, /参加者登録\(推奨\)/);
assert.doesNotMatch(commonEmpty, /もしくは/);

console.log('PASS participants tab and direct applicant sync contract');
