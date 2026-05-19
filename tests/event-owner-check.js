const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'assets', 'js', 'app.js'), 'utf8');
const bootstrap = fs.readFileSync(path.join(root, 'assets', 'js', 'features', 'events.js'), 'utf8');
const coreEvents = fs.readFileSync(path.join(root, 'assets', 'js', 'features', 'events', '01-core-startup-events.js'), 'utf8');
const generatedEvents = fs.readFileSync(path.join(root, 'assets', 'js', 'features', 'events', '03-generated-action-events.js'), 'utf8');
const settlementInputEvents = fs.readFileSync(path.join(root, 'assets', 'js', 'features', 'events', '04-settlement-input-events.js'), 'utf8');
const viewEvents = fs.readFileSync(path.join(root, 'assets', 'js', 'features', 'events', '05-view-feature-events.js'), 'utf8');

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

[
  './assets/js/features/events/00-event-utils.js',
  './assets/js/features/events/01-core-startup-events.js',
  './assets/js/features/events/02-static-header-events.js',
  './assets/js/features/events/03-generated-action-events.js',
  './assets/js/features/events/04-settlement-input-events.js',
  './assets/js/features/events/05-view-feature-events.js',
  './assets/js/features/events.js'
].forEach(file => assert(html.includes(file), `${file} is not loaded`));

assert(html.indexOf('./assets/js/app.js') < html.indexOf('./assets/js/features/events/00-event-utils.js'), 'event utility scripts should load after app bootstrap registration');
assert(html.indexOf('./assets/js/features/events/05-view-feature-events.js') < html.indexOf('./assets/js/features/events.js'), 'event bootstrap must load after event owner modules');
assert(bootstrap.includes('function setupAppEventListeners()'), 'setupAppEventListeners owner missing');
assert(coreEvents.includes('function bindCoreStartupEvents()'), 'core startup event bindings not owned by core-startup event module');
assert(generatedEvents.includes('setupGeneratedHtmlEventDelegation'), 'delegated generated events not owned by generated-action event module');
assert(generatedEvents.includes('generatedActionHandlers'), 'generated data-action handler map missing');
assert(settlementInputEvents.includes('setupSettlementInputEvents'), 'settlement input event owner missing');
assert(viewEvents.includes('setupViewAndFeatureEvents'), 'view/feature event owner missing');
assert(!app.includes('function setupStaticEventListeners()'), 'old setupStaticEventListeners still in app.js');
assert(!app.includes('function setupRefactorEventListeners()'), 'old setupRefactorEventListeners still in app.js');
assert(!app.includes('D.body.onclick'), 'body click owner should not remain in app.js');

console.log('Event owner check OK');
