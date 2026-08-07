import fs from 'node:fs';

const index = fs.readFileSync('index.html', 'utf8');
const tray = fs.readFileSync('assets/js/features/waiting-tray.js', 'utf8');
const trayCss = fs.readFileSync('assets/css/cars-members-tray/waiting-tray/04-tray-mobile.css', 'utf8');

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

expect(index.includes('<cds-popover id="autoAssignPopover"') && index.includes('align="top-end"'), 'Assignment conditions must use the official Carbon Popover with a north-facing top-end alignment.');
expect(!/<cds-popover id="autoAssignPopover"[^>]*\bautoalign\b/.test(index), 'Tray settings must not rely on Carbon autoalign inside the fixed bottom tray.');
expect(index.includes('<cds-icon-button id="traySettingsBtn"'), 'Assignment conditions trigger must remain an official Carbon Icon Button.');
expect(tray.includes("traySettingsPopoverEl.toggleAttribute('open', next)"), 'Pre-upgrade state changes must use the reflected open attribute.');
expect(tray.includes("if (customElements.get(traySettingsPopoverTag)) return traySettingsPopoverEl.open === true;"), 'After upgrade, Carbon open property must be the state source so close events cannot leave aria-expanded stale.');
expect(tray.includes("if (customElements.get(traySettingsPopoverTag))") && tray.includes('traySettingsPopoverEl.open = next;'), 'The reactive Carbon open property may only be written after the custom element is defined.');
expect(tray.includes("traySettingsPopoverEl.autoalign = false") && tray.includes("removeAttribute('autoalign')"), 'The fixed bottom-tray settings must explicitly disable Carbon auto-align so its hide middleware cannot make an open panel invisible.');
expect(tray.includes("customElements.whenDefined(traySettingsPopoverTag).then(initializeTraySettingsPopover)"), 'The Carbon Popover initialization must run after definition.');
expect(!tray.includes("traySettingsTriggerEl?.addEventListener('click', async"), 'The settings click controller must remain synchronous.');
expect(tray.includes("traySettingsPopoverEl.align = 'top-end'"), 'The Carbon Popover must be pinned to the requested north-facing placement.');
expect(/\.auto-assign-menu-body\s*\{[^}]*display:\s*block/.test(trayCss), 'The Popover content host must not carry the panel width used by Carbon static alignment.');
expect(/\.auto-assign-menu-body::part\(content\)\s*\{[^}]*width:\s*min\(320px/.test(trayCss), 'The panel width must live on Carbon PopoverContent itself so top-end anchors to the trigger without horizontal overflow.');

console.log('Carbon guidance v35 contract: PASS');
