import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const expect = (condition, message) => {
  if (!condition) throw new Error(message);
};

const startupEvents = read('assets/js/features/events/01-core-startup-events.js');
const dataState = read('assets/js/core/data-state.js');
const personMenu = read('assets/js/features/person-menu.js');
const cardCss = read('assets/css/cars-members-tray/01-shared-card-primitives.css');
const personCards = read('assets/js/features/person-cards.js');

expect(
  !startupEvents.includes("t.closest('.member-name-text, .driver-name-disp')"),
  'Participant names must not be delegated click controls.'
);
expect(
  !startupEvents.includes('toggleStatus(') && !dataState.includes('function toggleStatus('),
  'Legacy tap-to-cycle-gender behavior is still present.'
);
expect(
  !personMenu.includes("action === 'gender'") && !personMenu.includes('setPersonGender'),
  'Gender actions must be completely absent from the participant menu.'
);
expect(
  !personCards.includes("action: 'gender'") && !personCards.includes('data-person-action="gender"'),
  'The participant menu must not render a gender control.'
);
expect(
  personMenu.includes("action === 'driver'") && personMenu.includes('setPersonDriverRole(targetPerson)'),
  'Driver/leader changes must be wired to the explicit person-menu role toggle.'
);
expect(
  personCards.includes('data-person-action="driver"'),
  'The Carbon person menu must expose the driver/leader toggle.'
);
expect(
  !personCards.includes('data-person-action="name"'),
  'Participant name editing must not be exposed by the person menu.'
);
expect(
  !cardCss.includes('.member-card:focus-within'),
  'A card-wide focus-within ring would leave a false pointer-selected state.'
);
expect(
  personCards.includes('<cds-overflow-menu') && personCards.includes('<cds-menu-item'),
  'Person actions must continue to use official Carbon menu components.'
);

console.log('person-card-interaction-contract: PASS');
