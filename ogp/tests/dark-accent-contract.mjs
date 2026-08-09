import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const read = path => readFile(resolve(root, path), 'utf8');
const fail = message => { throw new Error(message); };
const expect = (condition, message) => { if (!condition) fail(message); };

const darkTheme = await read('assets/css/tokens/01-theme-modes.css');
const lightTheme = await read('assets/css/tokens/01-color-scheme.css');
const modalBase = await read('assets/css/guides-modals/modal/01-modal-base.css');
const dropdowns = await read('assets/css/guides-modals/modal/02-dropdowns.css');
const personMenu = await read('assets/css/cars-members-tray/person-card/03-person-menu.css');
const shareModal = await read('assets/css/app-shell/share/01-share-link-modal.css');
const importShell = await read('assets/css/guides-modals/import-guide/01-import-shell.css');
const importTable = await read('assets/css/guides-modals/import-guide/02-import-table.css');
const routeShell = await read('assets/css/settlement/route-helper/01-route-shell.css');
const routeStops = await read('assets/css/settlement/route-helper/02-route-stops.css');
const routeCandidates = await read('assets/css/settlement/route-helper/03-route-candidates.css');
const index = await read('index.html');

expect(darkTheme.includes('--cds-interactive: #0f62fe;'), 'Dark primary actions must use Carbon blue 60.');
expect(darkTheme.includes('--cds-link-primary: #78a9ff;'), 'Dark text/link accents must use Carbon blue 40.');
expect(darkTheme.includes('--cds-support-info: var(--cds-link-primary);'), 'Dark information accents must reuse the text/link accent.');
expect(darkTheme.includes('--semantic-info-inverse: var(--cds-link-primary);'), 'Toast information accent must not introduce a third blue.');
expect(darkTheme.includes('--accent-line: var(--cds-link-primary);'), 'Legacy accent line must map to the canonical text accent.');
expect(!darkTheme.includes('--accent-line: #4589ff;'), 'Dark accent line must not retain blue 50.');

for (const token of [
  '--app-accent-fill:', '--app-accent-text:', '--app-accent-icon:',
  '--app-accent-border:', '--app-accent-surface:', '--app-accent-surface-strong:'
]) {
  expect(lightTheme.includes(token), `Missing product semantic accent token: ${token}`);
}

expect(modalBase.includes('color: var(--cds-icon-primary, var(--text-main));'), 'Modal heading icons must be neutral.');
expect(dropdowns.includes('--cds-link-primary: var(--app-accent-text);'), 'Popover/menu links must inherit the canonical text accent.');
expect(personMenu.includes('--cds-icon-primary: var(--text-sub);'), 'Overflow action triggers must use the neutral secondary icon role.');
expect(personMenu.includes('--cds-link-primary: var(--text-sub);'), 'Overflow action triggers must not inherit the blue link role.');
expect(personMenu.includes('--person-flag-color: var(--app-accent-text);'), 'The explicit blue flag must use the canonical text accent.');
expect(shareModal.includes('--cds-layer-01: var(--surface-lowest);'), 'Share popup must use explicit Carbon layers.');
expect(importShell.includes('var(--app-accent-icon)'), 'Import popup helper icons must use the canonical accent role.');
expect(importTable.includes('var(--app-accent-surface)'), 'Import popup status surfaces must use the canonical accent surface.');
expect(routeShell.includes('border-left: 3px solid var(--app-accent-border)'), 'Route popup helper emphasis must use the canonical border accent.');
expect(routeStops.includes('border-color: var(--app-accent-fill);'), 'Route drag state must use the canonical filled accent.');
expect(routeCandidates.includes('border-left-color: var(--app-accent-fill);'), 'Selected route must use the canonical filled accent.');

const popupOwners = [modalBase, dropdowns, personMenu, shareModal, importShell, importTable, routeShell, routeStops, routeCandidates].join('\n');
expect(!/#4589ff/i.test(popupOwners), 'Popup owners must not hard-code Carbon blue 50.');
expect(!/var\(--accent-line\)/.test(popupOwners), 'Popup owners must not consume the ambiguous legacy accent-line token.');

expect(index.includes('rendered-qa-v26'), 'Dark theme cache-buster was not updated.');
expect(index.includes('rendered-qa-v26'), 'Popup owner cache-busters were not updated.');

console.log('PASS dark accent and popup semantic contract');
