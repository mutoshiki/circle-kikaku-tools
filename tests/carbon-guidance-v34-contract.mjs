import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const expect = (condition, message) => { if (!condition) throw new Error(message); };

const index = read('index.html');
const lock = read('assets/js/features/lock-protection.js');
const sheet = read('assets/js/features/sheet-view.js');
const summary = read('assets/js/core/render-controller.js');
const tray = read('assets/js/features/waiting-tray.js');
const batch = read('assets/js/features/batch-import.js');
const trayCss = read('assets/css/cars-members-tray/waiting-tray/04-tray-mobile.css');
const trayStateCss = read('assets/css/cars-members-tray/waiting-tray/05-tray-states.css');
const carbonEntry = read('assets/js/carbon-entry.js');

expect(index.includes('各項目の見出しの行も必ず一緒にコピーしてください。'), 'Required spreadsheet header-copy wording is missing.');
expect(!index.includes('各項目の見出し行も一緒にコピーすると、読み取りやすくなります。'), 'Old spreadsheet header-copy wording remains.');

for (const id of ['batchDrivers', 'batchGrade1', 'batchGrade2', 'batchGrade3', 'batchGrade4']) {
  const tag = index.match(new RegExp(`<cds-textarea\\b[^>]*\\bid="${id}"[^>]*>`, 's'))?.[0] || '';
  expect(tag && !tag.includes('placeholder='), `${id} must not have a placeholder.`);
}
const memberTag = index.match(/<cds-textarea\b[^>]*\bid="batchMembers"[^>]*>/s)?.[0] || '';
expect(memberTag.includes('placeholder='), 'Passenger list placeholder should remain.');

expect(index.includes('<span class="view-tab-label">車割/班割'), 'Bottom navigation label was not changed to 車割/班割.');
expect(index.includes('data-lock-scope="allocation"') && index.includes('data-lock-scope="settlement"'), 'Bottom navigation lock indicators are missing.');
expect(lock.includes('function updateBottomNavigationLockIndicators()'), 'Lock indicator state owner is missing.');

expect(index.includes('<cds-popover id="autoAssignPopover"') && index.includes('autoalign') && index.includes('autoalign-boundary="#app-layout"') && index.includes('align="top-end"') && index.includes('caret'), 'Assignment conditions must use the Carbon auto-aligned Popover with a north-facing preferred placement.');
expect(index.includes('<cds-icon-button id="traySettingsBtn"'), 'Assignment conditions trigger must be an official Carbon Icon Button.');
expect(carbonEntry.includes("components/popover/index.js"), 'Carbon Popover is not explicitly registered in the source entry.');
expect(tray.includes("customElements.whenDefined('cds-popover')"), 'Popover lifecycle must wait for the Carbon custom element to be upgraded.');
expect(tray.includes('traySettingsPopoverEl.autoalign = true;') && tray.includes("traySettingsPopoverEl.autoAlignBoundary = '#app-layout';") && tray.includes("traySettingsPopoverEl.align = 'top-end'"), 'Popover placement must be normalized to Carbon auto-align with top-end preference after upgrade.');
expect(!tray.includes("document.addEventListener('pointerdown'"), 'Custom outside-click emulation remains; Carbon Popover should own dismissal.');
expect(!tray.includes("document.addEventListener('keydown'"), 'Custom Escape emulation remains; Carbon Popover should own dismissal.');
expect(tray.includes("addEventListener('cds-popover-closed', syncTraySettingsMenuState)"), 'Popover close state is not synchronized from the Carbon close event.');
expect(trayCss.includes('--cds-popover-offset: 8px'), 'Popover spacing token is missing.');

expect(!index.includes('class="handle-bar"'), 'The stray custom handle bar remains in the Carbon button content.');
expect(!trayCss.includes('.handle-bar') && !trayStateCss.includes('.handle-bar'), 'Dead handle-bar styling remains.');

expect(sheet.includes("storageKey: 'syawari_guidance_allocation_drag_v2'"), 'Allocation guidance key must be versioned for the corrected lifecycle.');
expect(sheet.includes("storageKey: 'syawari_guidance_sheet_gestures_v2'"), 'Shared-view guidance key must be versioned for the corrected lifecycle.');
expect(sheet.includes('const FIRST_VIEW_GUIDANCE_DELAY_MS = 6000;'), 'Guidance delay must be exactly six seconds.');
expect(sheet.includes('isParticipantRegistrationGuidanceReady()'), 'Guidance must be gated by successful participant registration.');
expect(sheet.includes('currentView !== view'), 'Delayed guidance must verify the user is still on the same view.');
expect(sheet.includes('safeLocalSet(guidance.storageKey, true);') && sheet.indexOf('safeLocalSet(guidance.storageKey, true);') > sheet.indexOf('window.setTimeout'), 'Guidance must only be consumed when the delayed notice is actually shown.');
expect(sheet.includes('カードはドラッグして移動できます。'), 'Allocation drag guidance copy is missing.');
expect(sheet.includes('1本指で移動、2本指で拡大・縮小できます。'), 'Shared-view gesture guidance copy is missing.');
expect(sheet.includes("window.AppUI?.showStatus?.(guidance.message, { tone: 'info'"), 'Guidance must use the Carbon toast notification service.');
expect(batch.includes('window.markParticipantRegistrationGuidanceReady?.();'), 'Successful participant registration must arm the first-view guidance lifecycle.');

expect(summary.includes('strong.textContent = `${value}名`;'), 'Shared-view summary counts do not include 名.');

console.log('carbon-guidance-v34-contract: PASS');
