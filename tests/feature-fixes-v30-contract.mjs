import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const expect = (condition, message) => { if (!condition) throw new Error(message); };

const index = read('index.html');
const settlement = read('assets/js/features/settlement/03-render.js');
const settlementEvents = read('assets/js/features/events/04-settlement-input-events.js');
const modal = read('assets/js/core/modal-controller.js');
const settlementGuard = read('assets/js/core/settlement-edit-guard.js');
const iconCss = read('assets/css/components/icons/01-carbon-icons.css');
const route = read('assets/js/features/settlement/04-route-helper.js');
const carbonSource = read('assets/js/carbon-entry.js');
const carbonBundle = read('assets/vendor/carbon/carbon-entry.min.js');
const personMenuCss = read('assets/css/cars-members-tray/person-card/03-person-menu.css');
const personMenuJs = read('assets/js/features/person-menu.js');
const layeringCss = read('assets/css/app-shell/layout/04-layering.css');
const copyCss = read('assets/css/settlement/share/01-share-output.css');
const carHeaderCss = read('assets/css/cars-members-tray/car-card/02-card-header.css');
const collectionCss = read('assets/css/settlement/checklists/01-collection-list.css');
const collectionMobileCss = read('assets/css/settlement/checklists/02-collection-mobile.css');
const collectionStateCss = read('assets/css/settlement/checklists/03-driver-payment-list.css');
const collectionTemplate = read('assets/js/templates/settlement/05-collection-check-templates.js');
const settlementActions = read('assets/js/features/settlement/05-input-actions.js');
const overviewEvents = read('assets/js/features/events/02-static-header-events.js');
const sheetViewport = read('assets/js/features/sheet/02-viewport-controls.js');
const ui = read('assets/js/modules/ui.js');

expect(settlement.includes('Missing organizer is guidance, not a save-blocking data error'), 'Organizer guidance must not block settings save');
expect(settlement.includes('promptDiscardInvalidSettlementSettings'), 'Settlement settings discard-confirm flow is missing');
expect(settlement.includes("title: '入力内容を破棄'"), 'Settlement settings discard modal title is missing');
expect(settlementEvents.includes("#seisanOrganizerFree, #seisanOrganizerName"), 'Organizer controls do not refresh validation state');

expect(index.includes('class="route-place-search-icon" data-carbon-icon="search"'), 'Route search does not request the official Carbon Search icon');
expect(carbonSource.includes("@carbon/icons/es/search/20.js"), 'Carbon Search icon is not imported from the pinned official package');
expect(carbonSource.includes('search: Search20'), 'Carbon Search icon is not registered');
expect(carbonBundle.includes('name:"search"'), 'Built Carbon bundle does not contain Search');
expect(route.includes('renderCarbonIcons?.(surface)'), 'Dynamic route search surface does not render Carbon icons');

expect(modal.includes('function deepestActiveElement'), 'Recursive pointer focus cleanup is missing');
expect(modal.includes('target.focus({ preventScroll: true });') && modal.includes('if (!restoreForKeyboard) requestAnimationFrame(() => clearPointerFocus(target));'), 'Modal close must return focus without scrolling before clearing pointer focus');
expect(modal.includes("app-keyboard-navigation"), 'Input modality class is missing');
expect(iconCss.includes('body.app-keyboard-navigation cds-icon-button.header-action:focus-within'), 'Header focus ring is not keyboard-only');
expect(!iconCss.includes('\ncds-icon-button.header-action:focus-within {'), 'Pointer-only header focus ring rule remains');
expect((ui.match(/state\.confirmModal\.show\(\);/g) || []).length === 1, 'Confirmation modal is opened more than once');
expect(ui.includes('const onHidden = () => finish(requestedValue);'), 'Confirmation results must wait for Carbon modal cleanup before updating the page');
expect((ui.match(/queueMicrotask\(\(\) => state\.confirmModal\.hide\(\)\)/g) || []).length === 2, 'Confirmation modal must close after the activating click finishes to prevent backdrop click-through');

expect(personMenuJs.includes('trigger.showPopover()'), 'Person menus are not promoted to the browser top layer');
expect(personMenuJs.includes('person-menu-top-layer-placeholder'), 'Person-menu top-layer promotion does not preserve card layout');
expect(personMenuJs.includes('syncPersonMenuTopLayerPosition'), 'Person-menu anchor is not synchronized during viewport movement');
expect(personMenuCss.includes(':popover-open'), 'Person-menu top-layer geometry is missing');
expect(personMenuCss.includes('person-menu-top-layer-placeholder'), 'Person-menu placeholder styling is missing');
expect(personMenuCss.includes(':not(.person-menu-top-layer-open)'), 'Person-menu z-index fallback is not isolated from the top-layer path');
expect(layeringCss.includes(':not(.person-menu-top-layer-open) #top-area'), 'Top-area stacking fallback still runs while the menu is in the top layer');
expect(copyCss.includes('box-shadow: inset 0 0 0 1px var(--app-accent-border)'), 'Dark settlement copy action lacks a visible Carbon tertiary boundary');
expect(carHeaderCss.includes('.capacity-edit-pill > .carbon-icon { width: 1rem; height: 1rem; }'), 'Capacity edit pill must keep a balanced Carbon icon size');
expect(collectionCss.includes('grid-template-columns: repeat(2, minmax(0, 1fr))'), 'Collection checks must keep an efficient two-column desktop layout');
expect(collectionMobileCss.includes('grid-template-columns: minmax(0, 1fr);'), 'Mobile collection checks must stack vertically for Carbon checkbox scanning and label wrapping');
expect(collectionCss.includes('grid-template-columns: 24px minmax(0, 1fr)') && collectionTemplate.includes('<cds-checkbox'), 'Collection checks must use Carbon checkbox-left anatomy');
expect(collectionStateCss.includes('.seisan-check-item.excluded.pre-deducted') && collectionStateCss.includes('background: transparent;'), 'Pre-deducted collection state must not restore the old green tile surface');
expect(collectionCss.includes('overflow-wrap: anywhere') && collectionCss.includes('flex-direction: column'), 'Collection names and details must stack and wrap safely');
expect(settlementEvents.includes('__settlementCheckScrollSnapshot') && settlementActions.includes('consumeSettlementCheckScrollPosition') && settlementActions.includes('refreshSettlementCollectionStatus(encodedName, name, checked, state)'), 'Collection checks must update in place instead of replacing the focused checklist DOM');
expect((settlementActions.match(/input\?\.focus\?\.\(\{ preventScroll: true \}\);/g) || []).length === 2, 'Settlement confirmations must explicitly return focus to the operated Carbon control');
expect(!/state\.paid\[name\][\s\S]{0,220}renderSettlementViewPreservingScroll/.test(settlementActions), 'Collection check changes must not rerender the whole settlement view');
expect(settlementActions.includes('captureSettlementViewportState') && settlementActions.includes('stabilizeSettlementViewportState'), 'Settlement checks must delegate viewport ownership to the shared guard');
expect(settlementGuard.includes('function stabilizeSettlementViewportState') && settlementGuard.includes('delays = [0, 80, 240, 800]') && settlementGuard.includes("'seisan-view-area', 'app-layout'"), 'Collection scroll restoration must outlast Carbon modal focus cleanup across app scroll containers');
expect(settlementGuard.includes('titleState: readSettlementProjectTitleState()'), 'Shared settlement viewport restoration must preserve the project-title reveal state too');

expect(overviewEvents.includes('syncTimetableTextareaExpansion'), 'Overview timetable expansion behavior is missing');
expect(overviewEvents.includes("host.rows = shouldExpand ? 4 : 1"), 'Overview timetable textarea does not change official rows');
expect(sheetViewport.includes('syncSheetTimetableTextareaExpansion'), 'Shared-view timetable expansion behavior is missing');
expect(sheetViewport.includes("host.rows = shouldExpand ? 4 : 1"), 'Shared-view timetable textarea does not change official rows');

console.log('PASS feature fixes v30 contract');
