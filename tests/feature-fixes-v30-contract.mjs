import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const expect = (condition, message) => { if (!condition) throw new Error(message); };

const index = read('index.html');
const settlement = read('assets/js/features/settlement/03-render.js');
const settlementEvents = read('assets/js/features/events/04-settlement-input-events.js');
const modal = read('assets/js/core/modal-controller.js');
const iconCss = read('assets/css/components/icons/01-carbon-icons.css');
const route = read('assets/js/features/settlement/04-route-helper.js');
const carbonSource = read('assets/js/carbon-entry.js');
const carbonBundle = read('assets/vendor/carbon/carbon-entry.min.js');
const personMenuCss = read('assets/css/cars-members-tray/person-card/03-person-menu.css');
const copyCss = read('assets/css/settlement/share/01-share-output.css');
const carHeaderCss = read('assets/css/cars-members-tray/car-card/02-card-header.css');
const overviewEvents = read('assets/js/features/events/02-static-header-events.js');
const sheetViewport = read('assets/js/features/sheet/02-viewport-controls.js');
const ui = read('assets/js/modules/ui.js');

expect(settlement.includes("invalidText = showErrors && invalid ? '企画者を選択してください'"), 'Organizer-required validation copy is missing');
expect(settlement.includes('promptDiscardInvalidSettlementSettings'), 'Settlement settings discard-confirm flow is missing');
expect(settlement.includes("title: '入力内容を破棄'"), 'Settlement settings discard modal title is missing');
expect(settlementEvents.includes("#seisanOrganizerFree, #seisanOrganizerName"), 'Organizer controls do not refresh validation state');

expect(index.includes('class="route-place-search-icon" aria-hidden="true"><span data-carbon-icon="search"></span>'), 'Route search does not request the official Carbon Search icon');
expect(carbonSource.includes("@carbon/icons/es/search/20.js"), 'Carbon Search icon is not imported from the pinned official package');
expect(carbonSource.includes('search: Search20'), 'Carbon Search icon is not registered');
expect(carbonBundle.includes('name:"search"'), 'Built Carbon bundle does not contain Search');
expect(route.includes('renderCarbonIcons?.(surface)'), 'Dynamic route search surface does not render Carbon icons');

expect(modal.includes('function deepestActiveElement'), 'Recursive pointer focus cleanup is missing');
expect(modal.includes("app-keyboard-navigation"), 'Input modality class is missing');
expect(iconCss.includes('body.app-keyboard-navigation cds-icon-button.header-action:focus-within'), 'Header focus ring is not keyboard-only');
expect(!iconCss.includes('\ncds-icon-button.header-action:focus-within {'), 'Pointer-only header focus ring rule remains');
expect((ui.match(/state\.confirmModal\.show\(\);/g) || []).length === 1, 'Confirmation modal is opened more than once');

expect(personMenuCss.includes('z-index: calc(var(--z-person-menu) - 2)'), 'Waiting tray is not lowered while a person menu is open');
expect(personMenuCss.includes('.person-overflow-menu[open]'), 'Open person card does not receive a raised stacking context');
expect(copyCss.includes('box-shadow: inset 0 0 0 1px var(--app-accent-border)'), 'Dark settlement copy action lacks a visible Carbon tertiary boundary');
expect(carHeaderCss.includes('width: 1.5rem; height: 1.5rem'), 'Capacity edit icon is still undersized');

expect(overviewEvents.includes('syncTimetableTextareaExpansion'), 'Overview timetable expansion behavior is missing');
expect(overviewEvents.includes("host.rows = shouldExpand ? 4 : 1"), 'Overview timetable textarea does not change official rows');
expect(sheetViewport.includes('syncSheetTimetableTextareaExpansion'), 'Shared-view timetable expansion behavior is missing');
expect(sheetViewport.includes("host.rows = shouldExpand ? 4 : 1"), 'Shared-view timetable textarea does not change official rows');

console.log('PASS feature fixes v30 contract');
