const { test, expect } = require('@playwright/test');

test.setTimeout(120000);

const VIEWPORTS = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1280, height: 720 }
];
const THEMES = ['light', 'dark'];
const MODAL_VIEWPORTS = VIEWPORTS.filter(({ width }) => width === 390 || width === 1280);
const EMPTY_VIEWPORTS = MODAL_VIEWPORTS;
const TOAST_VIEWPORTS = MODAL_VIEWPORTS;
const SNAPSHOT_OPTIONS = {
  animations: 'disabled',
  caret: 'hide',
  maxDiffPixelRatio: 0.02,
  threshold: 0.25
};

async function installStableEnvironment(page) {
  await page.route('**/firebase-config.js', route => route.fulfill({
    status: 200,
    contentType: 'application/javascript',
    body: 'window.SANPO_FIREBASE_CONFIG = {};'
  }));
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem('sanpo_coach_seen_v1', 'true');
    Date.now = () => 1767225600000;
  });
}

async function boot(page, { theme, seeded, room }) {
  await installStableEnvironment(page);
  await page.goto(`./index.html?room=${room}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => (
    typeof window.switchView === 'function'
    && typeof window.switchCarPlan === 'function'
    && typeof window.SanpoTheme?.applyTheme === 'function'
  ));
  if (seeded) {
    await page.waitForFunction(() => typeof window.executeDebugMode === 'function');
    await page.evaluate(() => window.executeDebugMode());
    await page.waitForFunction(() => document.querySelectorAll('.car-box').length >= 3);
  }
  await page.evaluate(nextTheme => {
    window.SanpoTheme.applyTheme(nextTheme);
    document.querySelector('#appStatusToast')?.classList.remove('visible');
    document.querySelector('.app-coachmark')?.remove();
    document.querySelectorAll('.coachmark-target').forEach(node => node.classList.remove('coachmark-target'));
    window.scrollTo(0, 0);
  }, theme);
  await page.waitForTimeout(120);
}

async function setSurface(page, surface) {
  await page.evaluate(nextSurface => {
    if (nextSurface === 'car' || nextSurface === 'team') {
      window.switchView('list');
      window.switchCarPlan(nextSurface === 'team' ? 'plan-team' : 'plan-car');
    } else {
      window.switchView(nextSurface);
    }
    document.querySelector('#appStatusToast')?.classList.remove('visible');
    window.scrollTo(0, 0);
  }, surface);
  const expectedClass = surface === 'car' || surface === 'team'
    ? 'view-mode-list'
    : `view-mode-${surface}`;
  await expect(page.locator('body')).toHaveClass(new RegExp(expectedClass));
  await page.waitForTimeout(80);
}

async function expectFullPageSnapshot(page, name) {
  await page.evaluate(() => document.fonts?.ready);
  await expect(page).toHaveScreenshot(name, { ...SNAPSHOT_OPTIONS, fullPage: true });
}

async function expectViewportSnapshot(page, name) {
  await page.evaluate(() => document.fonts?.ready);
  await expect(page).toHaveScreenshot(name, SNAPSHOT_OPTIONS);
}

async function auditCurrentSurface(page, { checkTouchTargets }) {
  const audit = await page.evaluate(({ shouldCheckTouchTargets }) => {
    const isVisible = node => {
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.display !== 'none'
        && style.visibility !== 'hidden'
        && Number(style.opacity) > 0
        && rect.width > 0
        && rect.height > 0;
    };
    const accessibleName = node => (
      node.getAttribute('aria-label')
      || node.getAttribute('title')
      || node.querySelector?.('[slot="tooltip-content"]')?.textContent
      || node.textContent
      || ''
    ).trim().replace(/\s+/g, ' ');
    const visibleControls = Array.from(document.querySelectorAll(
      'button, summary, [role="button"], cds-button, cds-icon-button'
    )).filter(isVisible);
    const unnamedControls = visibleControls
      .filter(node => !accessibleName(node))
      .map(node => node.id || String(node.className));
    const undersized = shouldCheckTouchTargets
      ? visibleControls.map(node => {
        const rect = node.getBoundingClientRect();
        return {
          selector: node.id ? `#${node.id}` : `.${String(node.className).trim().replace(/\s+/g, '.')}`,
          knownDebt: node.matches([
            '.capacity-edit-btn',
            '.driver-menu-btn',
            '.member-menu-btn',
            '.seisan-edit-btn',
            '.app-empty-card .seisan-btn.primary'
          ].join(', ')),
          width: Math.round(rect.width * 10) / 10,
          height: Math.round(rect.height * 10) / 10
        };
      }).filter(item => item.width < 48 || item.height < 48)
      : [];
    return {
      documentOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      unnamedControls,
      unexpectedUndersized: undersized.filter(item => !item.knownDebt),
      knownTouchDebt: undersized.filter(item => item.knownDebt),
      unhiddenFontAwesomeIcons: Array.from(document.querySelectorAll('i.fas, i.far, i.fab'))
        .filter(isVisible)
        .filter(icon => icon.getAttribute('aria-hidden') !== 'true').length
    };
  }, { shouldCheckTouchTargets: checkTouchTargets });

  expect(audit.documentOverflow).toBeFalsy();
  expect(audit.unnamedControls).toEqual([]);
  expect(audit.unexpectedUndersized).toEqual([]);
  expect(audit.unhiddenFontAwesomeIcons).toBe(0);
  return audit.knownTouchDebt;
}

async function auditKeyboardFocus(page) {
  await page.evaluate(() => {
    document.body.setAttribute('tabindex', '-1');
    document.body.focus();
    window.scrollTo(0, 0);
  });
  await page.keyboard.press('Tab');
  const focus = await page.evaluate(() => {
    const node = document.activeElement;
    const style = getComputedStyle(node);
    return {
      id: node?.id || '',
      tagName: node?.tagName || '',
      accessibleName: (
        node?.getAttribute?.('aria-label')
        || node?.getAttribute?.('title')
        || node?.textContent
        || ''
      ).trim().replace(/\s+/g, ' '),
      focusVisible: node?.matches?.(':focus-visible') || false,
      outlineStyle: style.outlineStyle,
      outlineWidth: parseFloat(style.outlineWidth)
    };
  });
  expect(focus.tagName).not.toBe('BODY');
  expect(focus.accessibleName).toBeTruthy();
  expect(focus.focusVisible).toBeTruthy();
  expect(focus.outlineStyle).not.toBe('none');
  expect(focus.outlineWidth).toBeGreaterThanOrEqual(2);
  await page.evaluate(() => {
    document.activeElement?.blur();
    document.body.removeAttribute('tabindex');
  });
}

async function closeAllModals(page) {
  await page.evaluate(() => {
    document.querySelectorAll('.modal.show').forEach(modal => {
      window.bootstrap?.Modal?.getInstance(modal)?.hide();
      modal.classList.remove('show');
      modal.style.display = 'none';
      modal.setAttribute('aria-hidden', 'true');
      modal.removeAttribute('aria-modal');
    });
    document.querySelectorAll('.modal-backdrop').forEach(node => node.remove());
    document.body.classList.remove('modal-open');
  });
  await page.waitForTimeout(80);
}

const MODALS = [
  {
    name: 'participant-import',
    selector: '#batchImportModal',
    open: () => window.openBatchModal()
  },
  {
    name: 'user-guide',
    selector: '#userGuideModal',
    open: () => {
      window.mountUserGuide?.();
      window.modals.userGuide.show();
    }
  },
  {
    name: 'settlement-settings',
    selector: '#settlementSettingsModal',
    open: () => window.openSettlementSettings()
  },
  {
    name: 'settlement-car-edit',
    selector: '#settlementCarEditModal',
    open: () => window.openSettlementCarEditor(encodeURIComponent('藤原 拓海'))
  },
  {
    name: 'route-helper',
    selector: '#routeDistanceModal',
    open: () => window.openRouteDistanceHelper()
  },
  {
    name: 'empty-seat-picker',
    selector: '#seatMemberPickerModal',
    open: () => {
      window.switchView('list');
      window.switchCarPlan('plan-team');
      const slot = Array.from(document.querySelectorAll('.seat-slot')).find(node => !node.querySelector('.member-card'));
      window.openSeatMemberPicker(slot);
    }
  }
];

const PHASE4_FORM_MODALS = [
  {
    name: 'common-edit',
    selector: '#commonEditModal',
    control: 'cds-text-input#editModalInput',
    nativeControl: 'input',
    accessibleName: '参加者名を編集',
    open: () => { void window.appPrompt('参加者名を編集', '藤原 拓海', { title: '参加者を編集' }); }
  },
  {
    name: 'debug',
    selector: '#debugModal',
    control: 'cds-select#debugCarCount',
    nativeControl: 'select',
    accessibleName: 'サンプルデータの車の数',
    open: () => window.openDebugModal()
  }
];

for (const viewport of VIEWPORTS) {
  for (const theme of THEMES) {
    test(`phase 1 main surfaces ${viewport.width}px ${theme}`, async ({ page }, testInfo) => {
      const consoleProblems = [];
      page.on('console', message => {
        if (['error', 'warning'].includes(message.type())) consoleProblems.push(message.text());
      });
      page.on('pageerror', error => consoleProblems.push(error.message));
      await page.setViewportSize(viewport);
      await boot(page, { theme, seeded: true, room: `CARBON-PHASE1-${viewport.width}-${theme}` });

      for (const surface of ['car', 'team', 'sheet', 'seisan']) {
        await setSurface(page, surface);
        const knownTouchDebt = await auditCurrentSurface(page, { checkTouchTargets: viewport.width <= 768 });
        if (knownTouchDebt.length) {
          testInfo.annotations.push({
            type: 'known-touch-target-debt',
            description: `${surface}: ${knownTouchDebt.map(item => `${item.selector} ${item.width}x${item.height}`).join(', ')}`
          });
        }
        await expectFullPageSnapshot(page, `${surface}-${viewport.width}-${theme}.png`);
        if (surface === 'team') {
          await expect(page.locator('#bottom-tray')).toHaveScreenshot(
            `unassigned-tray-${viewport.width}-${theme}.png`,
            SNAPSHOT_OPTIONS
          );
        }
      }

      await setSurface(page, 'car');
      await auditKeyboardFocus(page);
      expect(consoleProblems).toEqual([]);
    });
  }
}

for (const viewport of MODAL_VIEWPORTS) {
  for (const theme of THEMES) {
    test(`phase 1 major modals ${viewport.width}px ${theme}`, async ({ page }) => {
      const consoleProblems = [];
      page.on('console', message => {
        if (['error', 'warning'].includes(message.type())) consoleProblems.push(message.text());
      });
      page.on('pageerror', error => consoleProblems.push(error.message));
      await page.setViewportSize(viewport);
      await boot(page, { theme, seeded: true, room: `CARBON-MODALS-${viewport.width}-${theme}` });

      for (const modalCase of MODALS) {
        await closeAllModals(page);
        await page.evaluate(modalCase.open);
        const modal = page.locator(modalCase.selector);
        await expect(modal).toBeVisible();
        const aria = await modal.evaluate(node => ({
          labelledBy: node.getAttribute('aria-labelledby'),
          ariaModal: node.getAttribute('aria-modal'),
          hidden: node.getAttribute('aria-hidden')
        }));
        expect(aria.labelledBy).toBeTruthy();
        expect(aria.ariaModal).toBe('true');
        expect(aria.hidden).not.toBe('true');
        await expectViewportSnapshot(page, `modal-${modalCase.name}-${viewport.width}-${theme}.png`);
      }

      await closeAllModals(page);
      expect(consoleProblems).toEqual([]);
    });
  }
}

for (const viewport of VIEWPORTS) {
  for (const theme of THEMES) {
    test(`phase 4A Carbon form modals ${viewport.width}px ${theme}`, async ({ page }) => {
      const consoleProblems = [];
      page.on('console', message => {
        if (['error', 'warning'].includes(message.type())) consoleProblems.push(message.text());
      });
      page.on('pageerror', error => consoleProblems.push(error.message));
      await page.setViewportSize(viewport);
      await boot(page, { theme, seeded: true, room: `CARBON-FORMS-${viewport.width}-${theme}` });

      for (const modalCase of PHASE4_FORM_MODALS) {
        await closeAllModals(page);
        await page.evaluate(modalCase.open);
        const modal = page.locator(modalCase.selector);
        const host = page.locator(modalCase.control);
        await expect(modal).toBeVisible();
        await expect(host).toBeVisible();
        const audit = await host.evaluate(async (node, { nativeControl, accessibleName }) => {
          await node.updateComplete;
          const control = node.shadowRoot?.querySelector(nativeControl);
          const hostRect = node.getBoundingClientRect();
          const controlRect = control?.getBoundingClientRect();
          return {
            upgraded: !!node.shadowRoot,
            actualAccessibleName: control?.getAttribute('aria-label') || '',
            expectedAccessibleName: accessibleName,
            hostHeight: hostRect.height,
            controlHeight: controlRect?.height || 0,
            overflow: document.documentElement.scrollWidth > window.innerWidth + 1
          };
        }, { nativeControl: modalCase.nativeControl, accessibleName: modalCase.accessibleName });
        expect(audit).toMatchObject({
          upgraded: true,
          actualAccessibleName: audit.expectedAccessibleName,
          overflow: false
        });
        expect(audit.hostHeight).toBeGreaterThanOrEqual(48);
        expect(audit.controlHeight).toBeGreaterThanOrEqual(48);
        await expectViewportSnapshot(page, `modal-${modalCase.name}-${viewport.width}-${theme}.png`);
      }

      await closeAllModals(page);
      expect(consoleProblems).toEqual([]);
    });
  }
}

for (const viewport of EMPTY_VIEWPORTS) {
  for (const theme of THEMES) {
    test(`phase 1 empty states ${viewport.width}px ${theme}`, async ({ page }) => {
      const consoleProblems = [];
      page.on('console', message => {
        if (['error', 'warning'].includes(message.type())) consoleProblems.push(message.text());
      });
      page.on('pageerror', error => consoleProblems.push(error.message));
      await page.setViewportSize(viewport);
      await boot(page, { theme, seeded: false, room: `CARBON-EMPTY-${viewport.width}-${theme}` });

      for (const surface of ['car', 'sheet', 'seisan']) {
        await setSurface(page, surface);
        await auditCurrentSurface(page, { checkTouchTargets: viewport.width <= 768 });
        await expectFullPageSnapshot(page, `empty-${surface}-${viewport.width}-${theme}.png`);
      }

      expect(consoleProblems).toEqual([]);
    });
  }
}

for (const viewport of TOAST_VIEWPORTS) {
  for (const theme of THEMES) {
    test(`phase 3B Toast Notification ${viewport.width}px ${theme}`, async ({ page }) => {
      const consoleProblems = [];
      page.on('console', message => {
        if (['error', 'warning'].includes(message.type())) consoleProblems.push(message.text());
      });
      page.on('pageerror', error => consoleProblems.push(error.message));
      await page.setViewportSize(viewport);
      await boot(page, { theme, seeded: true, room: `CARBON-TOAST-${viewport.width}-${theme}` });
      await setSurface(page, 'car');
      await page.evaluate(() => {
        window.AppUI.showStatus(
          '参加者の入力内容を確認してください。長い日本語メッセージも画面内で折り返して表示します。',
          { tone: 'warning', duration: 30000 }
        );
      });
      const toast = page.locator('#appStatusToast');
      await expect(toast).toBeVisible();
      await expect(toast).toHaveAttribute('kind', 'warning');
      const geometry = await toast.evaluate(node => {
        const rect = node.getBoundingClientRect();
        const closeButton = node.shadowRoot?.querySelector('button');
        const closeRect = closeButton?.getBoundingClientRect();
        return {
          left: rect.left,
          right: rect.right,
          closeWidth: closeRect?.width || 0,
          closeHeight: closeRect?.height || 0,
          overflow: document.documentElement.scrollWidth > window.innerWidth + 1
        };
      });
      expect(geometry.left).toBeGreaterThanOrEqual(0);
      expect(geometry.right).toBeLessThanOrEqual(viewport.width);
      expect(geometry.closeWidth).toBeGreaterThanOrEqual(48);
      expect(geometry.closeHeight).toBeGreaterThanOrEqual(48);
      expect(geometry.overflow).toBeFalsy();
      await expect(toast).toHaveScreenshot(`toast-${viewport.width}-${theme}.png`, SNAPSHOT_OPTIONS);
      expect(consoleProblems).toEqual([]);
    });
  }
}
