import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const write = (path, value) => fs.writeFileSync(path, value);
const replace = (text, before, after, label) => {
  if (text.includes(after)) return text;
  if (!text.includes(before)) throw new Error(`Missing patch target: ${label}`);
  return text.replace(before, after);
};

// Static app shell: remove the duplicate allocation switcher and shared count summary.
{
  const path = 'index.html';
  let text = read(path);
  text = text.replace('            <div id="car-plan-switcher" class="car-plan-bar allocation-mode-toggle" aria-label="車割と班割の切り替え"></div>\n', '');
  text = text.replace('          <div class="sheet-title-copy">\n            <span id="sheet-summary" aria-label="車割と班割の集計">車割 車出し 0 同乗者 0 全員 0 待機 0 / 班割 班長 0 メンバー 0 全員 0 待機 0</span>\n          </div>\n', '');
  const assetVersions = new Map([
    ['assets/css/app-shell/layout/02-panels.css', 'mobile-fix-v71'],
    ['assets/css/app-shell/header/01-header-base.css', 'mobile-fix-v71'],
    ['assets/css/app-shell/header/03-tabs-actions.css', 'mobile-fix-v71'],
    ['assets/css/cars-members-tray/01-shared-card-primitives.css', 'mobile-fix-v71'],
    ['assets/css/cars-members-tray/person-card/02-person-name-grade.css', 'mobile-fix-v71'],
    ['assets/css/cars-members-tray/person-card/03-person-menu.css', 'mobile-fix-v71'],
    ['assets/css/cars-members-tray/waiting-tray/06-action-and-list-layout.css', 'mobile-fix-v71'],
    ['assets/css/cars-members-tray/car-card/04-group-mode.css', 'mobile-fix-v71'],
    ['assets/css/settlement/05-carbon-layout-refinement.css', 'mobile-fix-v71'],
    ['assets/css/settlement/car-inputs/03-extra-costs.css', 'mobile-fix-v71'],
    ['assets/css/settlement/car-inputs/04-edit-modal.css', 'mobile-fix-v71'],
    ['assets/css/sheet-view/layout/01-sheet-frame.css', 'mobile-fix-v71'],
    ['assets/js/features/person-cards.js', 'mobile-fix-v71'],
    ['assets/js/core/modal-controller.js', 'mobile-fix-v71'],
    ['assets/js/templates/settlement/03-car-cost-templates.js', 'mobile-fix-v71'],
    ['assets/js/templates/settlement/04-extra-input-templates.js', 'mobile-fix-v71'],
    ['assets/js/features/sheet-view.js', 'mobile-fix-v71']
  ]);
  for (const [asset, version] of assetVersions) {
    const escaped = asset.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    text = text.replace(new RegExp(`${escaped}(?:\\?v=[^"']+)?`, 'g'), `${asset}?v=${version}`);
  }
  write(path, text);
}

// Carbon g100 shell menu icon must remain Gray 10 instead of inheriting blue link color.
{
  const path = 'assets/css/app-shell/header/01-header-base.css';
  let text = read(path);
  const owner = `\n#overviewMenuBtn.app-shell-menu-button,\n#overviewMenuBtn.app-shell-menu-button > :is([slot="icon"], .carbon-icon),\n#overviewMenuBtn.app-shell-menu-button::part(button) {\n  color: #f4f4f4;\n  --cds-icon-primary: #f4f4f4;\n  --cds-link-primary: #f4f4f4;\n}\n`;
  if (!text.includes('#overviewMenuBtn.app-shell-menu-button')) {
    const anchor = `.app-shell-menu-button {\n  flex: 0 0 48px;\n  width: 48px;\n  min-width: 48px;\n  height: 48px;\n  min-height: 48px;\n  color: #f4f4f4;\n  --cds-icon-primary: #f4f4f4;\n}\n`;
    text = replace(text, anchor, anchor + owner, 'header hamburger foreground');
  }
  write(path, text);
}

// Remove the former duplicated allocation switcher presentation owner.
{
  const path = 'assets/css/app-shell/header/03-tabs-actions.css';
  let text = read(path);
  text = text.replace(`/* 車割 / 班割 remain visible in the allocation toolbar as the Carbon Content\n * Switcher for switching two formats of the same allocation content. */\n#car-plan-switcher { display: flex; }\n`, '');
  write(path, text);
}

write('assets/css/app-shell/layout/02-panels.css', `/* Allocation commands: one Carbon page action. Allocation type is selected\n * only from the primary Carbon Tabs, so this toolbar does not duplicate it. */\n#top-area > .edit-header:first-child,\n.allocation-toolbar {\n  position: relative;\n  z-index: var(--z-local-raised);\n  margin: 0 0 var(--space-4);\n  padding: 0;\n  border: 0;\n  border-radius: 0;\n  background: transparent;\n  box-shadow: none;\n  backdrop-filter: none;\n}\n\n.allocation-toolbar-inner {\n  display: grid;\n  grid-template-columns: minmax(0, 320px);\n  align-items: stretch;\n  gap: 0;\n  min-width: 0;\n}\n\n#batchOpenBtn {\n  min-width: 0;\n  width: 100%;\n}\n\n.app-subtitle { display: none; }\n.edit-project-input-row .carbon-icon { color: var(--accent-color); font-size: 1rem; }\n\n@media (max-width: 520px) {\n  .allocation-toolbar-inner { grid-template-columns: minmax(0, 1fr); }\n}\n`);

// Keep the card surface draggable but remove its dedicated drag glyph.
{
  const path = 'assets/js/features/person-cards.js';
  let text = read(path);
  text = text.replace('        <div class="member-main-line">\n            <span class="person-drag-affordance" role="img" aria-label="ドラッグして移動"><span data-carbon-icon="draggable" aria-hidden="true"></span></span>\n            <div class="member-name-text">${safeName}</div>\n', '        <div class="member-main-line">\n            <div class="member-name-text">${safeName}</div>\n');
  write(path, text);
}

// The former car/team switcher no longer has markup, so remove its dead CSS owner.
{
  const path = 'assets/css/cars-members-tray/car-card/04-group-mode.css';
  let text = read(path);
  text = text.replace('/* Car/team mode selector and exceptional capacity state. */', '/* Allocation exceptional-capacity state and random-action layout. */');
  text = text.replace(/\n\.allocation-mode-toggle\.car-plan-bar \{[\s\S]*?\.edit-header-tools-only\.allocation-toolbar #car-plan-switcher \{ order: 2; margin-right: 0; \}\n/, '\n');
  write(path, text);
}

// Shared view: remove count rendering and make mobile one continuous scroll owner.
{
  const path = 'assets/js/features/sheet-view.js';
  let text = read(path);
  text = text.replace('    // getData() can expose only the active allocation in the normalized room schema.\n    // Feed the complete plan snapshot to the shared-view header so its car/team counts\n    // stay visible and agree with the sections rendered directly below it.\n    updateSheetSummary({ ...data, carPlans: plans });\n\n', '');
  write(path, text);
}
{
  const path = 'assets/css/sheet-view/layout/01-sheet-frame.css';
  let text = read(path);
  text = text.replace(/#sheet-title-bar \{[\s\S]*?\}\n#sheet-room-name/, `#sheet-title-bar {\n  position: absolute;\n  top: var(--space-3);\n  right: var(--space-4);\n  left: auto;\n  z-index: var(--z-local-sticky);\n  display: flex;\n  align-items: center;\n  justify-content: flex-end;\n  width: fit-content;\n  min-height: 48px;\n  margin: 0;\n  padding: 0;\n  border: 0;\n  border-radius: 0;\n  background: transparent;\n  color: var(--text-main);\n  box-shadow: none;\n  backdrop-filter: none;\n}\n#sheet-room-name`);
  text = text.replace('#sheet-title-bar #sheet-summary { color: var(--text-sub); }\n', '');
  text = text.replace('.sheet-title-copy { display: flex; flex: 1 1 auto; flex-direction: column; min-width: 0; }\n', '');
  text = text.replace('padding: 108px var(--space-4) var(--space-8);', 'padding: 76px var(--space-4) var(--space-8);');
  text = text.replace(`  #sheet-title-bar {\n    right: var(--space-4);\n    left: var(--space-4);\n    min-height: 88px;\n    padding: var(--space-3);\n  }\n  .sheet-content { gap: var(--space-5); padding-top: 124px; }\n`, `  #sheet-title-bar {\n    right: var(--space-4);\n    min-height: 48px;\n    padding: 0;\n  }\n  .sheet-content { gap: var(--space-5); padding-top: var(--space-4); }\n`);
  text = text.replace(`  #sheet-title-bar {\n    position: relative;\n    top: auto;\n    right: auto;\n    left: auto;\n    flex: 0 0 auto;\n    width: auto;\n    margin: var(--space-3) var(--space-4) 0;\n  }\n`, `  #sheet-title-bar {\n    position: relative;\n    top: auto;\n    right: auto;\n    left: auto;\n    flex: 0 0 auto;\n    width: fit-content;\n    margin: var(--space-3) var(--space-4) 0 auto;\n  }\n`);
  write(path, text);
}

// Remove the late shared-summary compatibility override so it cannot undo the canonical owner.
{
  const path = 'assets/css/settlement/05-carbon-layout-refinement.css';
  let text = read(path);
  const marker = '/* Carbon Gray 90/80/10 and Blue 90/20 keep compact tags readable in dark mode. */';
  const index = text.indexOf(marker);
  if (index >= 0) {
    let kept = text.slice(index);
    const mobile = kept.indexOf('\n@media (max-width: 640px)');
    if (mobile >= 0) kept = kept.slice(0, mobile).trimEnd() + '\n';
    text = `/* Compatibility rules that have not yet moved to their canonical owners.\n * Shared-view geometry is owned by sheet-view/layout/; this late file must not\n * override the removed participant summary or the responsive scroll owner. */\n\n${kept}`;
  }
  write(path, text);
}

// Settlement editor: reset body position on every open and use readable medium fields.
{
  const path = 'assets/js/core/modal-controller.js';
  let text = read(path);
  const before = `        if (carEditModal && carEditModal.dataset.settlementModalBound !== 'true') {\n            carEditModal.dataset.settlementModalBound = 'true';\n            carEditModal.addEventListener('sanpo:modal-hiding', event => {\n`;
  const after = `        if (carEditModal && carEditModal.dataset.settlementModalBound !== 'true') {\n            carEditModal.dataset.settlementModalBound = 'true';\n            carEditModal.addEventListener('sanpo:modal-shown', () => {\n                const body = carEditModal.querySelector(':scope > cds-modal-body.app-modal-body, :scope > .app-modal-body');\n                if (!body) return;\n                body.scrollTop = 0;\n                body.scrollLeft = 0;\n                requestAnimationFrame(() => {\n                    body.scrollTop = 0;\n                    body.scrollLeft = 0;\n                });\n            });\n            carEditModal.addEventListener('sanpo:modal-hiding', event => {\n`;
  if (!text.includes("carEditModal.addEventListener('sanpo:modal-shown'")) text = replace(text, before, after, 'settlement modal scroll reset');
  write(path, text);
}
{
  const path = 'assets/js/templates/settlement/03-car-cost-templates.js';
  let text = read(path);
  text = text.replace('<cds-text-input size="lg" data-field="standaloneDriverName"', '<cds-text-input size="md" density="condensed" data-field="standaloneDriverName"');
  for (const field of ['dist', 'eco', 'price']) text = text.replace(`<cds-text-input type="number" size="lg" inputmode="decimal" min="0" step="any" data-field="${field}"`, `<cds-text-input type="number" size="md" density="condensed" inputmode="decimal" min="0" step="any" data-field="${field}"`);
  write(path, text);
}
{
  const path = 'assets/js/templates/settlement/04-extra-input-templates.js';
  let text = read(path);
  text = text.replace('    const showColumnLabels = index === 0;\n    const columnLabel = text => showColumnLabels ? `<span class="seisan-extra-field-label">${text}</span>` : \'\';\n', '    const columnLabel = text => `<span class="seisan-extra-field-label">${text}</span>`;\n');
  text = text.replace('size="lg" density="condensed" data-extra-field="name"', 'size="md" density="condensed" data-extra-field="name"');
  text = text.replace('type="text" size="lg" density="condensed" inputmode="numeric"', 'type="text" size="md" density="condensed" inputmode="numeric"');
  text = text.replace('<cds-select size="lg" density="condensed" data-extra-field="type"', '<cds-select size="md" density="condensed" data-extra-field="type"');
  write(path, text);
}
{
  const path = 'assets/css/settlement/car-inputs/03-extra-costs.css';
  let text = read(path);
  text = text.replace('  min-height: 48px;\n}\n\n#settlementCarEditModal .seisan-extra-field--amount', '  min-height: 40px;\n}\n\n#settlementCarEditModal .seisan-extra-field--amount');
  text = text.replace('  min-height: 48px;\n}\n\n@media (max-width: 640px)', '  min-height: 40px;\n}\n\n@media (max-width: 640px)');
  text = text.replace(`  #settlementCarEditModal .seisan-extra-row {\n    grid-template-columns: minmax(0, 1fr) minmax(112px, 0.75fr) 48px;\n    gap: var(--space-2);\n  }\n\n`, `  #settlementCarEditModal .seisan-extra-row {\n    grid-template-columns: minmax(0, 1fr) minmax(112px, 0.75fr) 48px;\n    gap: var(--space-2);\n    padding-block: var(--space-2);\n    border-bottom: 1px solid var(--cds-border-subtle, var(--border-section));\n  }\n\n  #settlementCarEditModal .seisan-extra-row:first-child { padding-top: 0; }\n  #settlementCarEditModal .seisan-extra-row:last-child { border-bottom: 0; }\n`);
  text = text.replace('  #settlementCarEditModal .seisan-extra-row--labeled > .seisan-icon-btn {\n    margin-top: calc(var(--font-size-caption) * 1.2 + var(--space-1));\n  }\n', '  #settlementCarEditModal .seisan-extra-row > .seisan-icon-btn {\n    margin-top: calc(var(--font-size-caption) * 1.2 + var(--space-1));\n  }\n');
  write(path, text);
}
{
  const path = 'assets/css/settlement/car-inputs/04-edit-modal.css';
  let text = read(path);
  if (!text.includes('#settlementCarEditModal .app-modal-body > * + *')) text = text.replace('#settlementCarEditModal .app-modal-heading {', '#settlementCarEditModal .app-modal-body > * + * {\n  margin-top: var(--space-5);\n}\n#settlementCarEditModal .app-modal-heading {');
  write(path, text);
}

// Regression contracts reflect the single-nav, no-summary, no-drag-glyph design.
{
  const path = 'tests/design-refinement-contract.mjs';
  let text = read(path);
  if (!text.includes("const headerBase = await read('assets/css/app-shell/header/01-header-base.css');")) text = text.replace("const header = await read('assets/css/app-shell/header/03-tabs-actions.css');\n", "const header = await read('assets/css/app-shell/header/03-tabs-actions.css');\nconst headerBase = await read('assets/css/app-shell/header/01-header-base.css');\nconst panels = await read('assets/css/app-shell/layout/02-panels.css');\n");
  if (!text.includes("const lateRefinement = await read('assets/css/settlement/05-carbon-layout-refinement.css');")) text = text.replace("const settlement = await read('assets/css/settlement/page-shell/01-layout.css');\n", "const settlement = await read('assets/css/settlement/page-shell/01-layout.css');\nconst lateRefinement = await read('assets/css/settlement/05-carbon-layout-refinement.css');\n");
  text = text.replace("expect(people.includes('person-drag-affordance') && people.includes('data-carbon-icon=\"draggable\"'), 'Draggable person cards need a quiet Carbon drag affordance.');", "expect(!people.includes('person-drag-affordance') && !people.includes('data-carbon-icon=\"draggable\"'), 'Allocation person cards must not render a dedicated drag glyph; the card surface itself remains draggable.');");
  text = text.replace("expect(sheetView.includes('updateSheetSummary({ ...data, carPlans: plans })'), 'Shared-view counts must use the same complete plan snapshot as the rendered allocations.');", "expect(!sheetView.includes('updateSheetSummary({ ...data, carPlans: plans })'), 'Removed shared-view counts must not be rendered or recomputed by the presentation view.');");
  const marker = "expect(header.includes('--cds-icon-primary: #f4f4f4;'), 'Persistent g100 header utilities must use Carbon Gray 10 foreground.');\n";
  if (!text.includes('must not duplicate car/team switching')) text = text.replace(marker, marker + "expect(headerBase.includes('#overviewMenuBtn.app-shell-menu-button') && headerBase.includes('color: #f4f4f4;'), 'The Carbon shell menu glyph must stay Gray 10/white rather than inherit interactive blue.');\nexpect(!index.includes('id=\"car-plan-switcher\"'), 'Allocation pages must not duplicate car/team switching below the primary tabs.');\nexpect(!index.includes('id=\"sheet-summary\"'), 'Shared view must not render the removed participant-count summary.');\nexpect(!lateRefinement.includes('#sheet-title-bar') && !lateRefinement.includes('#sheet-summary'), 'Late compatibility CSS must not reintroduce removed shared-summary geometry.');\nexpect(panels.includes('grid-template-columns: minmax(0, 320px);'), 'Allocation toolbar must collapse to the single participant-registration action.');\n");
  if (!text.includes('Long settlement forms should use Carbon medium fields')) text = text.replace("expect(extraTemplate.includes('割勘 −') && extraTemplate.includes('部費 −'), 'Negative burden labels must be concise in the closed select.');", "expect(extraTemplate.includes('割勘 −') && extraTemplate.includes('部費 −'), 'Negative burden labels must be concise in the closed select.');\nexpect(extraTemplate.includes('size=\"md\" density=\"condensed\" data-extra-field=\"name\"') && extraTemplate.includes('size=\"md\" density=\"condensed\" inputmode=\"numeric\"'), 'Long settlement forms should use Carbon medium fields for denser, readable mobile entry.');");
  write(path, text);
}
{
  const path = 'tests/carbon-complete.spec.js';
  let text = read(path);
  const navAnchor = "      await expect(page.locator('#view-toggle-bar')).toBeVisible();\n";
  if (!text.includes("const menuColor = await page.locator('#overviewMenuBtn')")) text = text.replace(navAnchor, navAnchor + "      const menuColor = await page.locator('#overviewMenuBtn').evaluate(node => getComputedStyle(node).color);\n      expect(menuColor).toBe('rgb(244, 244, 244)');\n");
  if (!text.includes("if (view === 'sheet') await expect(page.locator('#sheet-summary')).toHaveCount(0);")) text = text.replace("        await expectNoDocumentOverflow(page);\n        if (view === 'sheet' && viewport.width < 1056) {", "        await expectNoDocumentOverflow(page);\n        if (view === 'sheet') await expect(page.locator('#sheet-summary')).toHaveCount(0);\n        if (view === 'sheet' && viewport.width < 1056) {");
  text = text.replace("    await hostClick(page, '#car-plan-switcher cds-content-switcher-item[value=\"team\"]');\n    expect(await page.evaluate(() => window.getActiveCarPlan().templateType)).toBe('team');\n    await hostClick(page, '#car-plan-switcher cds-content-switcher-item[value=\"car\"]');\n    expect(await page.evaluate(() => window.getActiveCarPlan().templateType)).toBe('car');\n", "    await expect(page.locator('#car-plan-switcher')).toHaveCount(0);\n    await hostClick(page, '#tab-team');\n    expect(await page.evaluate(() => window.getActiveCarPlan().templateType)).toBe('team');\n    await hostClick(page, '#tab-list');\n    expect(await page.evaluate(() => window.getActiveCarPlan().templateType)).toBe('car');\n");
  text = text.replace("    await expect(page.locator('#sheet-summary')).not.toContainText('全員 0');", "    await expect(page.locator('#sheet-summary')).toHaveCount(0);");
  write(path, text);
}

console.log('Applied mobile fix v71');
