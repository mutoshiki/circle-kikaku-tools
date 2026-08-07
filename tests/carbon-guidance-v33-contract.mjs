import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const expect = (condition, message) => { if (!condition) throw new Error(message); };

const index = read('index.html');
const lock = read('assets/js/features/lock-protection.js');
const sheet = read('assets/js/features/sheet-view.js');
const summary = read('assets/js/core/render-controller.js');
const tray = read('assets/js/features/waiting-tray.js');
const trayCss = read('assets/css/cars-members-tray/waiting-tray/04-tray-mobile.css');
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
expect(lock.includes("updateBottomNavigationLockIndicators();"), 'Lock indicators are not refreshed with lock state.');

expect(index.includes('<cds-popover id="autoAssignPopover"') && index.includes('align="top-end"') && index.includes('caret'), 'Assignment conditions do not use the aligned Carbon Popover.');
expect(index.includes('<cds-icon-button id="traySettingsBtn"'), 'Assignment conditions trigger must be an official Carbon Icon Button.');
expect(carbonEntry.includes("components/popover/index.js"), 'Carbon Popover is not explicitly registered in the source entry.');
expect(!tray.includes('clampTraySettingsPopover'), 'Manual transform-based popover positioning remains.');
expect(tray.includes("document.addEventListener('pointerdown'"), 'Popover outside-click lifecycle is missing.');
expect(trayCss.includes('--cds-popover-offset: 8px'), 'Popover spacing token is missing.');

expect(sheet.includes("has('room')"), 'Guidance must not be consumed by the transient room-creation redirect.');
expect(sheet.includes('syawari_guidance_allocation_drag_v1'), 'First allocation guidance persistence key is missing.');
expect(sheet.includes('カードはドラッグして移動できます。'), 'Allocation drag guidance copy is missing.');
expect(sheet.includes('syawari_guidance_sheet_gestures_v1'), 'First shared-view guidance persistence key is missing.');
expect(sheet.includes('1本指で移動、2本指で拡大・縮小できます。'), 'Shared-view gesture guidance copy is missing.');
expect(sheet.includes("window.AppUI?.showStatus?.(guidance.message, { tone: 'info'"), 'Guidance must use the Carbon toast notification service.');

expect(summary.includes('strong.textContent = `${value}名`;'), 'Shared-view summary counts do not include 名.');

console.log('carbon-guidance-v33-contract: PASS');
