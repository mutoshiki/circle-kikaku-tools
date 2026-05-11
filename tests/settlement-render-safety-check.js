const { readText } = require('./helpers/read-project');

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

const render = readText('assets/js/features/settlement/03-render.js');
const templates = readText('assets/js/templates/settlement-templates.js');
const generatedEvents = readText('assets/js/features/events/03-generated-action-events.js');

assert(render.includes('organizerEl.replaceChildren'), 'organizer select should be built with DOM options, not innerHTML');
assert(!render.includes('organizerEl.innerHTML'), 'organizer select still writes participant names with innerHTML');
assert(templates.includes('encodeURIComponent(car.name)'), 'driver names stored in data-action attributes must be encoded');
assert(generatedEvents.includes('SanpoApp?.runAction'), 'generated template actions should dispatch through SanpoApp action registry');

console.log('Settlement render safety check OK');
