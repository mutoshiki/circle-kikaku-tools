import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const read = path => readFile(resolve(root, path), 'utf8');
const expect = (condition, message) => { if (!condition) throw new Error(message); };

const index = await read('index.html');
const lightTokens = await read('assets/css/tokens/01-color-scheme.css');
const darkTokens = await read('assets/css/tokens/01-theme-modes.css');
const header = await read('assets/css/app-shell/header/03-tabs-actions.css');
const room = await read('assets/css/app-shell/header/02-room-status.css');
const cards = await read('assets/css/cars-members-tray/01-shared-card-primitives.css');
const carHeader = await read('assets/css/cars-members-tray/car-card/02-card-header.css');
const seatGrid = await read('assets/css/cars-members-tray/car-card/03-seat-grid.css');
const personMenu = await read('assets/css/cars-members-tray/person-card/03-person-menu.css');
const people = await read('assets/js/features/person-cards.js');
const sheetSummary = await read('assets/css/sheet-view/layout/03-sheet-summary.css');
const timetable = await read('assets/css/sheet-view/timetable/02-timetable-edit.css');
const modal = await read('assets/css/guides-modals/modal/01-modal-base.css');
const settlement = await read('assets/css/settlement/page-shell/01-layout.css');
const settlementStates = await read('assets/css/settlement/page-shell/05-error-states.css');
const extraCosts = await read('assets/css/settlement/car-inputs/03-extra-costs.css');
const extraTemplate = await read('assets/js/templates/settlement/04-extra-input-templates.js');
const costPreview = await read('assets/css/settlement/cost-tags/05-cost-preview-lines.css');
const clubExpense = await read('assets/css/settlement/checklists/06-club-expense-list.css');
const tagTokens = await read('assets/css/tokens/05-control-surface-tokens.css');
const summary = await read('assets/css/settlement/summary/01-summary-layout.css');

expect(index.includes('usability-v33'), 'Changed design owners need the v26 cache-buster.');
expect(header.includes('cds-icon-button.header-action'), 'Header Carbon icon-button hosts need an explicit neutral utility contract.');
expect(header.includes('#shareLinkBtn.header-action'), 'Only the explicit share action should retain the link accent.');
expect(header.includes('--cds-icon-primary: var(--text-main);'), 'Routine header utilities must use neutral Carbon icon color.');
expect(personMenu.includes('--cds-link-primary: var(--text-sub);'), 'Person overflow triggers must stay neutral rather than inherit the blue link token.');
expect(room.includes('#appUndoBar cds-button'), 'Undo action must style the official Carbon button host.');
expect(cards.includes('border-color: var(--border-item);'), 'Person cards should use subtle Carbon borders.');
expect(carHeader.includes('background: var(--semantic-danger-soft); color: var(--semantic-danger);'), 'Destructive vehicle action must use danger feedback instead of blue.');
expect(seatGrid.includes('.seat-slot-icon'), 'Empty seats must use a real Carbon icon.');
expect(!seatGrid.includes('content: "→"'), 'Text glyph arrows are not allowed for empty-seat actions.');
expect(people.includes('data-carbon-icon="add"'), 'Empty-seat markup must request the official Carbon add icon.');
expect(index.includes('data-carbon-icon="user--follow"'), 'Fill-empty-seats must use the official Carbon user-follow icon.');
expect(!sheetSummary.includes('#sheet-view-area.active::after'), 'Shared view must not render a duplicate unconditional edge fade.');
expect(settlement.includes('var(--cds-icon-primary, var(--text-main))'), 'Base settlement heading icons must be neutral.');
expect(settlementStates.includes('var(--cds-icon-secondary, var(--text-sub))'), 'Late settlement state owner must not re-blue heading icons.');
expect(tagTokens.includes('--settlement-tag-font-size: var(--font-size-caption);'), 'Settlement tags must use the readable caption size.');
expect(summary.includes('border-top: 3px solid var(--settlement-summary-line'), 'Settlement equation cards need a non-color-only category rail.');

for (const [source, mode] of [[lightTokens, 'light'], [darkTokens, 'dark']]) {
  expect(source.includes('--cds-support-success:'), `${mode} theme needs Carbon success support token.`);
  expect(source.includes('--cds-support-warning:'), `${mode} theme needs Carbon warning support token.`);
  expect(source.includes('--cds-support-error:'), `${mode} theme needs Carbon error support token.`);
  expect(source.includes('--cds-notification-background-success:'), `${mode} theme needs success notification background.`);
  expect(source.includes('--cds-notification-background-warning:'), `${mode} theme needs warning notification background.`);
  expect(source.includes('--cds-notification-background-error:'), `${mode} theme needs error notification background.`);
}
expect(modal.includes('.app-modal cds-modal-heading:focus-visible'), 'Dynamic Carbon modal headings must suppress the browser focus rectangle.');
expect(timetable.includes('grid-template-columns: 116px minmax(0, 1fr) 48px'), 'Overview timetable needs enough width for full HH:MM values.');
expect(timetable.includes('grid-template-columns: 112px minmax(0, 1fr) 48px'), 'Narrow mobile timetable still needs a readable time column.');
expect(extraCosts.includes('72px 112px 48px'), 'Extra-cost burden select needs a readable Carbon select column.');
expect(extraCosts.includes('68px 104px 48px'), '360px extra-cost row needs a safe compact burden column.');
expect(extraTemplate.includes('割勘 −') && extraTemplate.includes('部費 −'), 'Negative burden labels must be concise in the closed select.');
expect(!costPreview.includes('font-size: 0.60rem'), 'Persistent settlement labels must not fall below Carbon caption size.');
expect(clubExpense.includes('font-size: var(--font-size-caption);'), 'Club expense user labels must use Carbon caption size.');
expect(index.includes('>登録する</cds-modal-footer-button>'), 'Batch import primary action must stay on one line.');

console.log('PASS comprehensive rendered design refinement contract');
