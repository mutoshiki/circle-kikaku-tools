import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

const header = read('assets/js/features/events/02-static-header-events.js');
const participants = read('assets/js/features/form-applicant-sync-v2.js');
const workspace = read('assets/css/cars-members-tray/assignment-workspace-refresh.css');
const calculator = read('assets/js/features/settlement/02-calculator.js');
const driverPay = read('assets/js/templates/settlement/06-driver-pay-templates.js');
const carSummary = read('assets/js/templates/settlement/03-car-cost-templates.js');
const shareText = read('assets/js/features/settlement/06-share-text.js');

assert.match(header, /searchParams\.delete\('view'\)/);
assert.match(header, /searchParams\.delete\('allocation'\)/);
assert.match(header, /brand\.setAttribute\('href', roomHref\)/);
assert.match(participants, /manualDraftChecked\(id\)/);
assert.match(workspace, /assignment-workspace-add-group \{ min-width: 8rem; \}/);
assert.match(workspace, /assignment-workspace-add-group span:not\(\[slot="icon"\]\) \{ display: inline; \}/);
assert.match(calculator, /const driverNames = new Set\(\(data\.cars \|\| \[\]\)\.flatMap\(carDriverNames\)\)/);
assert.match(calculator, /driverNames: drivers/);
assert.match(calculator, /const offsetDriverCount = car\.driverNames\.filter\(name => name !== excludedName\)\.length/);
assert.match(calculator, /car\.collectionOffsetPerDriver = driverCollectionOffset && offsetDriverCount \? perPerson : 0/);
assert.match(calculator, /\? perPerson \* offsetDriverCount/);
assert.match(driverPay, /driverCars = result\.cars\.filter/);
assert.match(driverPay, /driverNames\.join\('・'\)/);
assert.match(carSummary, /driverDisplayLabel/);
assert.match(carSummary, /運転手未設定/);
assert.match(shareText, /result\.cars\.filter\(car => Array\.isArray\(car\.driverNames\)/);

console.log('Room/participant/driver linkage v101 contract: PASS');
