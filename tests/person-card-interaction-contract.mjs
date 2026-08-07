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
  personMenu.includes("else if (action === 'gender') setPersonGender(targetPerson, choiceValue);"),
  'Gender changes must remain wired to the explicit person-menu choice.'
);
expect(
  personCards.includes('data-person-choice="${action}"') && personCards.includes("action: 'gender'"),
  'The Carbon menu-item gender submenu is missing.'
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
