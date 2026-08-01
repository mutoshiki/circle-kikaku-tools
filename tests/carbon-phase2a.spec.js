const { test, expect } = require('@playwright/test');

test.setTimeout(120000);

async function boot(page, { theme = 'light', width = 390 } = {}) {
  await page.route('**/firebase-config.js', route => route.fulfill({
    status: 200,
    contentType: 'application/javascript',
    body: 'window.SANPO_FIREBASE_CONFIG = {};'
  }));
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem('sanpo_coach_seen_v1', 'true');
  });
  await page.setViewportSize({ width, height: width < 600 ? 844 : 720 });
  await page.goto(`./index.html?room=CARBON-PHASE2C-${width}-${theme}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => (
    document.documentElement.dataset.carbonReady === 'true'
    && customElements.get('cds-button')
    && customElements.get('cds-icon-button')
    && window.SanpoCarbon
    && window.SanpoIconAdapter
    && window.SanpoTheme?.applyTheme
  ));
  await page.evaluate(nextTheme => window.SanpoTheme.applyTheme(nextTheme), theme);
  await page.evaluate(() => document.fonts.ready);
}

test('official Carbon runtime, icons, fonts, and Phase 2C low-risk controls are active', async ({ page }) => {
  const consoleProblems = [];
  page.on('console', message => {
    if (['error', 'warning'].includes(message.type())) consoleProblems.push(message.text());
  });
  page.on('pageerror', error => consoleProblems.push(error.message));
  await boot(page);

  const runtime = await page.evaluate(async () => {
    const latin = await document.fonts.load('400 16px "IBM Plex Sans"', 'Carbon');
    const japanese = await document.fonts.load('400 16px "IBM Plex Sans JP"', '企画 車割 精算');
    const resources = performance.getEntriesByType('resource').map(entry => entry.name);
    return {
      versions: window.SanpoCarbon.versions,
      carbonButtons: document.querySelectorAll('cds-button, cds-icon-button').length,
      iconCount: document.querySelectorAll('svg.carbon-icon').length,
      pendingIcons: document.querySelectorAll('[data-carbon-icon]').length,
      latinLoaded: latin.length > 0 && document.fonts.check('400 16px "IBM Plex Sans"', 'Carbon'),
      japaneseLoaded: japanese.length > 0 && document.fonts.check('400 16px "IBM Plex Sans JP"', '企画'),
      fontResources: resources.filter(url => /IBMPlexSans(?:JP)?-Regular\.woff2/.test(url)),
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  });

  expect(runtime.versions).toEqual({
    webComponents: '2.60.0',
    icons: '11.85.0',
    plexSans: '1.1.0',
    plexSansJp: '3.0.0'
  });
  expect(runtime.carbonButtons).toBe(6);
  expect(runtime.iconCount).toBeGreaterThanOrEqual(32);
  expect(runtime.pendingIcons).toBe(0);
  expect(runtime.latinLoaded).toBeTruthy();
  expect(runtime.japaneseLoaded).toBeTruthy();
  expect(runtime.fontResources.some(url => url.endsWith('IBMPlexSans-Regular.woff2'))).toBeTruthy();
  expect(runtime.fontResources.some(url => url.endsWith('IBMPlexSansJP-Regular.woff2'))).toBeTruthy();
  expect(runtime.horizontalOverflow).toBeFalsy();

  const controlAudit = await page.evaluate(() => (
    ['shareLinkBtn', 'overviewMenuBtn', 'overviewDrawerCloseBtn', 'overviewTimetableAddBtn', 'overviewTimetableCopyBtn'].map(id => {
      const host = document.getElementById(id);
      const rect = host.getBoundingClientRect();
      const button = host.shadowRoot?.querySelector('button');
      const buttonRect = button?.getBoundingClientRect();
      return {
        id,
        hostWidth: rect.width,
        hostHeight: rect.height,
        internalButton: Boolean(button),
        internalHeight: buttonRect?.height || 0,
        internalName: button?.getAttribute('aria-label')
          || host.getAttribute('aria-label')
          || host.querySelector('[slot="tooltip-content"]')?.textContent?.trim()
          || host.textContent?.trim()
          || '',
        disabled: button?.disabled || false
      };
    })
  ));
  controlAudit.forEach(control => {
    expect(control.hostWidth, control.id).toBeGreaterThanOrEqual(48);
    expect(control.hostHeight, control.id).toBeGreaterThanOrEqual(47.5);
    expect(control.internalButton, control.id).toBeTruthy();
    expect(control.internalHeight, control.id).toBeGreaterThanOrEqual(44);
    expect(control.internalName, control.id).toBeTruthy();
    expect(control.disabled, control.id).toBeFalsy();
  });

  const emptyActionAudit = await page.evaluate(() => {
    const host = document.querySelector('cds-button[data-action="switch-list"]');
    const rect = host?.getBoundingClientRect();
    const button = host?.shadowRoot?.querySelector('button');
    const buttonRect = button?.getBoundingClientRect();
    return {
      found: Boolean(host),
      hostWidth: rect?.width || 0,
      hostHeight: rect?.height || 0,
      internalHeight: buttonRect?.height || 0,
      name: host?.textContent?.trim().replace(/\s+/g, ' ') || ''
    };
  });
  expect(emptyActionAudit.found).toBeTruthy();
  expect(emptyActionAudit.hostWidth).toBeGreaterThanOrEqual(48);
  expect(emptyActionAudit.hostHeight).toBeGreaterThanOrEqual(47.5);
  expect(emptyActionAudit.internalHeight).toBeGreaterThanOrEqual(44);
  expect(emptyActionAudit.name).toBe('車割・班割を開く');

  await page.locator('cds-button[data-action="switch-list"]').click();
  await expect(page.locator('body')).toHaveClass(/view-mode-list/);
  await page.locator('#tab-sheet').click();
  await expect(page.locator('body')).toHaveClass(/view-mode-sheet/);

  await page.locator('#overviewMenuBtn').click();
  await expect(page.locator('#overviewDrawer')).toHaveClass(/is-open/);
  await expect(page.locator('#overviewMenuBtn')).toHaveAttribute('aria-expanded', 'true');
  const beforeRows = await page.locator('.overview-timetable-row').count();
  await page.locator('#overviewTimetableAddBtn').click();
  await expect(page.locator('.overview-timetable-row')).toHaveCount(beforeRows + 1);

  await page.locator('#overviewTimetableCopyBtn').focus();
  const focusAudit = await page.evaluate(() => {
    const host = document.getElementById('overviewTimetableCopyBtn');
    const button = host.shadowRoot?.querySelector('button');
    const style = button ? getComputedStyle(button) : null;
    const beforeStyle = button ? getComputedStyle(button, '::before') : null;
    return {
      hostFocusWithin: host.matches(':focus-within'),
      internalFocused: host.shadowRoot?.activeElement === button,
      focusIndicator: [style?.outlineStyle, style?.boxShadow, beforeStyle?.outlineStyle, beforeStyle?.boxShadow]
        .filter(Boolean)
        .some(value => value !== 'none' && !/^rgba?\(0, 0, 0, 0\)/.test(value))
    };
  });
  expect(focusAudit.hostFocusWithin).toBeTruthy();
  expect(focusAudit.internalFocused).toBeTruthy();
  expect(focusAudit.focusIndicator).toBeTruthy();

  await page.evaluate(() => document.getElementById('overviewTimetableCopyBtn').disabled = true);
  await expect.poll(() => page.evaluate(() => (
    document.getElementById('overviewTimetableCopyBtn').shadowRoot?.querySelector('button')?.disabled
  ))).toBeTruthy();
  await page.evaluate(() => document.getElementById('overviewTimetableCopyBtn').disabled = false);
  await page.locator('.overview-timetable-row [data-field="title"]').first().fill('集合');
  await page.locator('#overviewTimetableCopyBtn').click();
  await expect(page.locator('#appStatusToast')).toContainText('予定をコピーしました');
  await page.locator('#overviewDrawerCloseBtn').click();
  await expect(page.locator('#overviewDrawer')).not.toHaveClass(/is-open/);
  await expect(page.locator('#overviewMenuBtn')).toHaveAttribute('aria-expanded', 'false');

  expect(consoleProblems).toEqual([]);
});

test('Phase 2C state icon adapter preserves theme, edit lock, and waiting tray contracts', async ({ page }) => {
  const consoleProblems = [];
  page.on('console', message => {
    if (['error', 'warning'].includes(message.type())) consoleProblems.push(message.text());
  });
  page.on('pageerror', error => consoleProblems.push(error.message));
  await boot(page);

  const readStateIcon = (selector, group) => page.locator(selector).evaluate((container, stateGroup) => {
    const icons = Array.from(container.querySelectorAll(`[data-state-icon="${stateGroup}"]`));
    const icon = icons[0];
    return {
      count: icons.length,
      name: icon?.dataset.carbonIconName || icon?.dataset.carbonIcon || '',
      state: icon?.dataset.iconState || '',
      ariaHidden: icon?.getAttribute('aria-hidden') || '',
      pending: icon?.matches('[data-carbon-icon]') || false
    };
  }, group);

  const themeMenu = page.locator('.header-more > .dropdown-toggle');
  await themeMenu.click();
  const themeButton = page.locator('#themeToggleBtn');
  await expect(themeButton).toBeVisible();
  await themeButton.focus();
  await expect(themeButton).toBeFocused();
  const themeRect = await themeButton.boundingBox();
  expect(themeRect.height).toBeGreaterThanOrEqual(48);
  expect(await themeButton.getAttribute('aria-label')).toBe('ダークモードに切り替え');
  expect(await themeButton.getAttribute('aria-pressed')).toBe('false');
  expect(await readStateIcon('#themeToggleBtn', 'theme')).toEqual({ count: 1, name: 'moon', state: 'light', ariaHidden: 'true', pending: false });

  await themeButton.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await themeButton.getAttribute('aria-label')).toBe('ライトモードに切り替え');
  expect(await themeButton.getAttribute('aria-pressed')).toBe('true');
  expect(await readStateIcon('#themeToggleBtn', 'theme')).toEqual({ count: 1, name: 'sun', state: 'dark', ariaHidden: 'true', pending: false });
  await page.evaluate(() => window.SanpoTheme.applyTheme('light'));

  const lockButton = page.locator('#editLockBtn');
  const lockRect = await lockButton.boundingBox();
  expect(lockRect.width).toBeGreaterThanOrEqual(48);
  expect(lockRect.height).toBeGreaterThanOrEqual(48);
  await lockButton.focus();
  await expect(lockButton).toBeFocused();
  expect(await readStateIcon('#editLockBtn', 'editLock')).toEqual({ count: 1, name: 'unlocked', state: 'unlocked', ariaHidden: 'true', pending: false });

  await lockButton.click();
  const setupPanel = page.locator('#passphrase-panel');
  await expect(setupPanel).toBeVisible();
  const setupPasswords = setupPanel.locator('input[type="password"]');
  await setupPasswords.nth(0).fill('phase2c-lock');
  await setupPasswords.nth(1).fill('phase2c-lock');
  await setupPanel.locator('button[type="submit"]').click();
  await expect(setupPanel).toHaveCount(0);
  await expect(lockButton).toHaveAttribute('aria-label', '車割・班割・精算のロックを解除');
  await expect(lockButton).toContainText('ロック中');
  expect(await readStateIcon('#editLockBtn', 'editLock')).toEqual({ count: 1, name: 'locked', state: 'locked', ariaHidden: 'true', pending: false });

  await lockButton.click();
  const unlockPanel = page.locator('#passphrase-panel');
  await expect(unlockPanel).toBeVisible();
  await unlockPanel.locator('input[type="password"]').fill('phase2c-lock');
  await unlockPanel.locator('button[type="submit"]').click();
  await expect(unlockPanel).toHaveCount(0);
  await expect(lockButton).toHaveAttribute('aria-label', '車割・班割と精算のロック範囲を選ぶ');
  await expect(lockButton).toContainText('ロック');
  expect(await readStateIcon('#editLockBtn', 'editLock')).toEqual({ count: 1, name: 'unlocked', state: 'unlocked', ariaHidden: 'true', pending: false });

  await page.locator('#tab-list').click();
  await expect(page.locator('body')).toHaveClass(/view-mode-list/);
  await page.evaluate(() => {
    const tray = document.getElementById('bottom-tray');
    tray.classList.add('waiting-empty');
    tray.classList.remove('empty-open', 'minimized');
    tray.dataset.userMinimized = 'true';
    window.updateTrayToggleLabel();
  });
  const trayHandle = page.locator('#tray-handle');
  await expect(trayHandle).toBeVisible();
  const trayRect = await trayHandle.boundingBox();
  expect(trayRect.height).toBeGreaterThanOrEqual(48);
  await trayHandle.focus();
  await expect(trayHandle).toBeFocused();
  await expect(trayHandle).toHaveAttribute('aria-label', '未割り当てメンバーを開閉');
  await expect(page.locator('#tray-toggle-label')).toContainText('未割り当てメンバーを開く');
  expect(await readStateIcon('#tray-toggle-label', 'waitingTray')).toEqual({ count: 1, name: 'chevron--up', state: 'closed', ariaHidden: 'true', pending: false });

  await trayHandle.press('Enter');
  await expect(page.locator('#tray-toggle-label')).toContainText('未割り当てメンバーを閉じる');
  expect(await readStateIcon('#tray-toggle-label', 'waitingTray')).toEqual({ count: 1, name: 'chevron--down', state: 'open', ariaHidden: 'true', pending: false });
  await trayHandle.press(' ');
  await expect(page.locator('#tray-toggle-label')).toContainText('未割り当てメンバーを開く');
  expect(await readStateIcon('#tray-toggle-label', 'waitingTray')).toEqual({ count: 1, name: 'chevron--up', state: 'closed', ariaHidden: 'true', pending: false });

  const decorativeAudit = await page.evaluate(() => Array.from(document.querySelectorAll([
    '#userGuideModalTitle .carbon-icon',
    '#settlementSettingsModalTitle .carbon-icon',
    '#settlementCarEditModalTitle .carbon-icon',
    '#routeDistanceModalTitle .carbon-icon',
    '#historyModalTitle .carbon-icon',
    '#planningCheckModalTitle .carbon-icon',
    '#debugModalTitle .carbon-icon',
    '.batch-import-helper-title .carbon-icon',
    '.batch-import-notice .carbon-icon',
    '.route-helper-title .carbon-icon'
  ].join(','))).map(icon => icon.getAttribute('aria-hidden')));
  expect(decorativeAudit.length).toBeGreaterThanOrEqual(10);
  expect(decorativeAudit.every(value => value === 'true')).toBeTruthy();

  expect(consoleProblems).toEqual([]);
});
