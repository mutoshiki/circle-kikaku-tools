import fs from 'node:fs';
import assert from 'node:assert/strict';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const feature = fs.readFileSync(new URL('../assets/js/features/form-applicant-sync-v2.js', import.meta.url), 'utf8');
const participantUi = fs.readFileSync(new URL('../assets/js/features/participants-ui.js', import.meta.url), 'utf8');
const handoffExport = fs.readFileSync(new URL('../assets/js/features/handoff-export.js', import.meta.url), 'utf8');
const announcement = fs.readFileSync(new URL('../assets/js/features/participant-announcement.js', import.meta.url), 'utf8');
const formLinkedSample = fs.readFileSync(new URL('../assets/js/features/form-linked-sample.js', import.meta.url), 'utf8');
const loader = fs.readFileSync(new URL('../firebase-config.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../assets/css/guides-modals/import-guide/07-form-applicant-sync.css', import.meta.url), 'utf8');
const announcementCss = fs.readFileSync(new URL('../assets/css/guides-modals/import-guide/08-participant-announcement.css', import.meta.url), 'utf8');
const settlementEmpty = fs.readFileSync(new URL('../assets/js/templates/settlement/07-empty-state-templates.js', import.meta.url), 'utf8');
const commonEmpty = fs.readFileSync(new URL('../assets/js/templates/common-empty-state.js', import.meta.url), 'utf8');
const navigation = fs.readFileSync(new URL('../assets/js/features/events/02-static-header-events.js', import.meta.url), 'utf8');

// Loader/cache contracts.
assert.match(html, /\.\/firebase-config\.js\?v=participants-flow-v94/);
assert.match(loader, /form-applicant-sync-v2\.js\?v=participants-carbon-v92/);
assert.match(loader, /participants-ui\.js\?v=participants-carbon-v99/);
assert.match(loader, /handoff-export\.js\?v=participants-copy-v96/);
assert.match(loader, /participant-announcement\.js\?v=participants-copy-v96/);
assert.match(loader, /form-linked-sample\.js\?v=participants-carbon-v99/);
assert.match(loader, /07-form-applicant-sync\.css\?v=participants-carbon-v99/);
assert.match(loader, /08-participant-announcement\.css\?v=participants-carbon-v93/);
assert.doesNotMatch(loader, /form-link-sync\.js/);
assert.doesNotMatch(loader, /06-form-auto-link\.css/);
assert.doesNotMatch(loader, /carbon-checkbox-state-bridge/);

// Managed form sync and dedicated participant view ownership.
assert.match(feature, /APPLICATION_KIND\s*=\s*['"]formApplicationSync['"]/);
assert.match(feature, /APPLICATION_VERSION\s*=\s*2/);
assert.match(feature, /rooms\/\$\{roomId\}\/meta\/applicationSync/);
assert.match(feature, /onValue\(/);
assert.match(feature, /liveApplicationSync/);
assert.match(feature, /id = ['"]tab-participants['"]/);
assert.match(feature, /setAttribute\(['"]value['"], ['"]participants['"]\)/);
assert.match(feature, /participants-view-area/);
assert.match(feature, /view-mode-participants/);
assert.match(feature, /cds-checkbox-changed/);
assert.match(feature, /event\.detail\?\.checked/);
assert.match(feature, /applicantSelectionDraft/);
assert.match(feature, /manualSelectionDraft/);
assert.match(navigation, /\['tab-participants', view === 'participants'\]/);
assert.match(navigation, /tab\.toggleAttribute\('selected', active\)/);
assert.match(navigation, /tabBar\.value = selectedValue/);

// Carbon selection surface: native toolbar/search/filter components, selection status,
// selected-row token, read-only removal tag, and one primary save action.
assert.match(participantUi, /<cds-table-toolbar class=\"participants-carbon-toolbar\"/);
assert.match(participantUi, /<cds-table-toolbar-content class=\"participants-carbon-toolbar__content\"/);
assert.match(participantUi, /cds-table-toolbar-search[^>]*size=\"lg\"[^>]*名前を検索/);
assert.match(participantUi, /participantsFilterToggle/);
assert.match(participantUi, /participantsSelectionFilter/);
assert.match(participantUi, /participantsGradeFilter/);
assert.match(participantUi, /participantsDriverFilter/);
assert.match(participantUi, /participantsActiveFilters/);
assert.match(participantUi, /activeFilterLabels/);
assert.match(participantUi, /participantsSelectionStatus/);
assert.match(participantUi, /\$\{selected\}人を選択中/);
assert.match(participantUi, /\$\{selected\}人を参加者として確定/);
assert.match(participantUi, /\$\{selected\}人を参加者として保存/);
assert.match(participantUi, /document\.createElement\('cds-tag'\)/);
assert.match(participantUi, /removal\.setAttribute\('type', 'red'\)/);
assert.match(participantUi, /removal\.textContent = '除外予定'/);
assert.doesNotMatch(participantUi, /参加者から外す予定/);
assert.doesNotMatch(participantUi, /✓ 保存済み/);
assert.match(participantUi, /participantsConfirmedControls/);
assert.match(participantUi, /participantsEditToggle/);
assert.match(participantUi, /確定済み/);
assert.match(participantUi, /is-confirmed-collapsed/);
assert.match(participantUi, /row\.setAttribute\('role', 'listitem'\)/);
assert.match(participantUi, /list\.setAttribute\('role', 'list'\)/);
assert.match(participantUi, /list\.setAttribute\('aria-label', managed \? '応募者から参加者を選択'/);

assert.match(css, /\.participants-view-area\s*\{[\s\S]*?order:\s*3;/);
assert.match(css, /\.participants-page__header\s*\{[\s\S]*?background:\s*var\(--cds-layer-01/);
assert.match(css, /\.participants-carbon-toolbar__content\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) 48px/);
assert.match(css, /\.form-applicant-sync__row\.is-selected\s*\{[\s\S]*?var\(--cds-layer-selected-01/);
assert.doesNotMatch(css, /\.form-applicant-sync__row\.is-pending-removal\s*\{[\s\S]*?box-shadow/);
assert.match(css, /\.participants-page\.is-selection-dirty\s*\{[\s\S]*?padding-bottom:/);
assert.match(css, /\.participants-page__actions\s*\{[\s\S]*?position:\s*fixed;/);
assert.match(css, /\.participants-selection-status\[hidden\]/);
assert.doesNotMatch(css, /body\.view-mode-participants \.project-title-region/);
assert.doesNotMatch(css, /body\.view-mode-participants \.project-title-editor/);
assert.match(css, /\.form-applicant-sync__row\s*\{[\s\S]*?min-height:\s*56px;/);
assert.match(css, /\.participants-page__status\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?width:\s*1px;[\s\S]*?height:\s*1px;/);
assert.match(css, /var\(--cds-/);

// Confirmed-state follow-up actions remain grouped below the selection surface.
assert.match(participantUi, /participantsPostConfirmSection/);
assert.match(participantUi, /参加者確定後/);
assert.match(participantUi, /participantsHandoffActionPanel/);
assert.match(participantUi, /<h4>引き継ぎデータ<\/h4>/);
assert.match(participantUi, /学務提出書類作成ツールに読み込むための引き継ぎデータを作成します/);
assert.match(participantUi, /らくらく連絡網に投稿する参加者発表文を作成します/);
assert.match(participantUi, /participantAnnouncementOpenBtn[\s\S]*?setAttribute\('kind', 'ghost'\)/);
assert.match(participantUi, /handoffExportReason/);

// Handoff export keeps the capability local and exports only committed participants.
assert.match(handoffExport, /TOKEN_STORAGE_PREFIX\s*=\s*['"]SANPO_HANDOFF_EXPORT_TOKEN_V1:/);
assert.match(handoffExport, /url\.searchParams\.delete\(TOKEN_PARAM\)/);
assert.match(handoffExport, /window\.history\.replaceState/);
assert.match(handoffExport, /参加者の変更を保存してから作成できます/);
assert.match(handoffExport, /学務提出書類作成ツールに読み込む引き継ぎデータを作成します/);
assert.match(handoffExport, /responses:\s*selection\.responseKeys\.join/);
assert.doesNotMatch(handoffExport, /studentId.*localStorage/i);
assert.match(handoffExport, /\[['"]学籍番号['"], ['"]氏名['"]\]/);
assert.match(handoffExport, /Blob\(\[csv\]/);

// The debug sample is intentionally large enough to exercise a phone-sized scrolling list.
assert.match(formLinkedSample, /SAMPLE_BUTTON_ID\s*=\s*['"]executeFormLinkedDebugBtn['"]/);
assert.match(formLinkedSample, /フォーム連携サンプルを入れる/);
assert.match(formLinkedSample, /sample-a13/);
assert.match(formLinkedSample, /responseCount:\s*sampleApplicants\.length/);
assert.match(formLinkedSample, /eventDate:\s*SAMPLE_EVENT_DATE/);
assert.match(formLinkedSample, /window\.switchView\('participants'\)/);

// Participant announcement flow retained from the current mainline contract.
assert.match(announcement, /FIXED_MEETING_PLACE\s*=\s*['"]サークルボックス前['"]/);
assert.match(announcement, /WEEKDAYS\s*=\s*\[['"]日['"], ['"]月['"], ['"]火['"], ['"]水['"], ['"]木['"], ['"]金['"], ['"]土['"]\]/);
assert.match(announcement, /participantAnnouncementPanel/);
assert.match(announcement, /participantAnnouncementOpenBtn/);
assert.match(announcement, /参加者の変更を保存してから作成できます/);
assert.match(announcement, /id=\"announcementEventDate\" type=\"date\"[\s\S]*?label=\"実施日（任意）\"/);
assert.match(announcement, /id=\"announcementMeetingTime\" type=\"time\"[\s\S]*?required label=\"集合時間（必須）\"/);
assert.match(announcement, /validateMeetingTime/);
assert.doesNotMatch(announcement, /announcementMeetingPlace/);
assert.match(announcement, /function defaultApplicationMessage\(/);
assert.doesNotMatch(announcement, /id=\"announcementApplicationMessage\"/);
assert.match(announcement, /id=\"announcementSupplement\"[\s\S]*?label=\"補足事項（任意）\"/);
assert.match(announcement, /id=\"announcementAdvancedToggleBtn\"[\s\S]*?文章をさらに調整/);
assert.match(announcement, /大まかな予定（任意）/);
assert.match(announcement, /id=\"announcementAddItineraryBtn\"[\s\S]*?予定を追加/);
assert.doesNotMatch(announcement, /～ざっくり予定～/);
assert.match(announcement, /function announcementSubject\(/);
assert.match(announcement, /当日は\$\{meetingTime\}に\$\{FIXED_MEETING_PLACE\}に集合してください/);
assert.match(announcement, /【参加者】/);
assert.match(announcement, /○は車出し/);
assert.doesNotMatch(announcement, /※敬称略/);
assert.match(announcement, /id=\"announcementEditStep\"/);
assert.match(announcement, /id=\"announcementPreviewStep\"[\s\S]*?hidden/);
assert.match(announcement, /<pre id=\"announcementBodyPreview\" class=\"participant-announcement-output/);
assert.doesNotMatch(announcement, /announcementCloseBtn/);
assert.match(announcement, /navigator\.clipboard\?\.writeText/);
assert.match(announcementCss, /\.participant-announcement-layout/);
assert.match(announcementCss, /\.participant-announcement-output--body\s*\{[\s\S]*?white-space:\s*pre-wrap/);
assert.match(announcementCss, /var\(--cds-/);

// Participant removal and empty-state parity remain intact.
assert.match(participantUi, /batchOpenBtn/);
assert.match(participantUi, /removeAllocationRegistrationAction/);
assert.match(css, /#top-area \.allocation-toolbar\s*\{[\s\S]*?display:\s*none;/);
assert.match(feature, /restoreAllocationVisibility[\s\S]*?renderActiveCarPlanToDom/);
assert.match(feature, /data-manual-participant-id/);
assert.match(feature, /SanpoCanonicalState\?\.deleteParticipant/);
assert.match(feature, /AppUI\?\.confirm/);
assert.match(feature, /参加者から外しますか/);
assert.match(feature, /車割・班割・精算の割り当ても削除されます/);
assert.match(feature, /SanpoCanonicalState\.ensureParticipant/);
assert.match(feature, /ensureAllParticipantsPlaced/);
assert.doesNotMatch(feature, /<(?:input|textarea|select|button)\b/i);

for (const template of [settlementEmpty, commonEmpty]) {
  assert.match(template, /data-action="open-participants"/);
  assert.match(template, /参加者がいません/);
  assert.match(template, /参加者がまだ決まっていません/);
  assert.match(template, /応募者を確認/);
  assert.match(template, /参加者を追加/);
  assert.match(template, /人数だけで精算/);
}
assert.doesNotMatch(commonEmpty, /参加者登録\(推奨\)/);

console.log('PASS Carbon participant selection, shared shell parity, form-linked sample, handoff export, announcement, and empty-state contracts');