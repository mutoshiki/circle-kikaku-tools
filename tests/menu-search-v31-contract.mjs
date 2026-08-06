import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const expect = (condition, message) => { if (!condition) throw new Error(message); };

const index = read('index.html');
const cardHeader = read('assets/css/cars-members-tray/car-card/02-card-header.css');
const personMenuCss = read('assets/css/cars-members-tray/person-card/03-person-menu.css');
const personMenuJs = read('assets/js/features/person-menu.js');
const personCards = read('assets/js/features/person-cards.js');
const routeShell = read('assets/css/settlement/route-helper/01-route-shell.css');
const routeStops = read('assets/css/settlement/route-helper/02-route-stops.css');
const routeTemplate = read('assets/js/templates/settlement/08-route-helper-templates.js');

expect(cardHeader.includes('font-size: 1.5rem'), 'Capacity count is not sized to 24px');
expect(cardHeader.includes('width: 1.5rem; height: 1.5rem'), 'Capacity edit icon is not sized to 24px');
expect(cardHeader.includes('min-width: 76px'), 'Capacity edit control does not reserve balanced width');

expect(personCards.includes('enable-v12-overflowmenu autoalign menu-alignment="bottom-end"'), 'Person actions do not use Carbon V12 Overflow Menu auto alignment');
expect(personMenuJs.includes('positionPersonMenuSurface'), 'Person menu viewport/tray constraint is missing');
expect(personMenuJs.includes("document.getElementById('bottom-tray')"), 'Person menu does not account for the waiting tray boundary');
expect(personMenuJs.includes("position: 'fixed'"), 'Person menu surface is not constrained against the viewport');
expect(personMenuJs.includes("triggerRect.right - menuWidth"), 'Person menu is not end-aligned to its trigger');
expect(personMenuJs.includes("trigger.dataset.menuPlacement"), 'Person menu placement state is not recorded');
expect(personMenuCss.includes('.person-overflow-menu[open]'), 'Only the open person menu is raised above later card triggers');
expect(personMenuCss.includes('z-index: auto'), 'Closed person menu triggers retain an elevated stacking context');
expect(personMenuCss.includes('body.person-menu-open #app-layout #bottom-tray'), 'Waiting tray layering is not lowered while a person menu is open');
expect(personMenuCss.includes('backdrop-filter: none'), 'iOS fixed-menu containing block mitigation is missing');
expect(personMenuCss.includes('max-height: min(var(--person-menu-available-height'), 'Person menu does not constrain height to available space');

expect(routeTemplate.includes('route-stop-search-icon'), 'Route stop input is missing its Search icon wrapper');
expect(routeTemplate.includes('data-carbon-icon="search"'), 'Route stop input does not request the official Carbon Search icon');
expect(index.includes('class="route-place-search-icon" aria-hidden="true"><span data-carbon-icon="search"></span>'), 'Full search surface is missing the official Carbon Search icon');
expect(routeStops.includes('width: 48px') && routeStops.includes('height: 48px'), 'Route stop Search icon does not use a 48px touch-aligned area');
expect(routeStops.includes('width: 20px') && routeStops.includes('height: 20px'), 'Route stop Search glyph is not 20px');
expect(routeStops.includes('--cds-layout-density-padding-inline-normal: 48px'), 'Route stop text does not clear the Search icon area');
expect(routeShell.includes('.route-place-search-icon > .carbon-icon'), 'Search-page icon selector does not target the rendered Carbon icon');

expect(index.includes('usability-v33'), 'Unified application cache-busting token is missing.');

console.log('PASS v31 menu, capacity and search contract');
