import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const render = read('assets/js/features/settlement/03-render.js');
const template = read('assets/js/templates/settlement/03-car-cost-templates.js');

if (template.includes('has-focus="false"')) {
  throw new Error('Settlement issue notifications must not use a truthy Boolean has-focus="false" attribute.');
}
if (!render.includes('function suppressSettlementIssueNotificationFocus')) {
  throw new Error('Settlement renderer must own actionable notification focus policy.');
}
if (!render.includes('notification.hasFocus = false')) {
  throw new Error('Settlement renderer must disable Carbon actionable notification focus.');
}
if (!render.includes('suppressSettlementIssueNotificationFocus(carList)')) {
  throw new Error('Settlement car warning render must pass through the shared focus owner.');
}
if (!render.includes('function focusSettlementValidationError(host)')) {
  throw new Error('Settlement validation scrolling must use one shared owner.');
}
if (!render.includes('(control || host).focus?.({ preventScroll: true })')) {
  throw new Error('Validation focus must prevent browser scrolling after the deliberate scroll.');
}
if (/function validateSettlementSettings\([\s\S]*?\n}\n\nfunction restoreSettlementSettingsOpeningSnapshot/.test(render)
    && /validateSettlementSettings\([\s\S]*focusFirstSettlementSettingsValidationError/.test(render.match(/function validateSettlementSettings\([\s\S]*?\n}\n\nfunction restoreSettlementSettingsOpeningSnapshot/)[0])) {
  throw new Error('Passive settlement settings validation must not scroll; callers handle user-submit focus once.');
}

console.log('Settlement warning scroll contract passed.');
