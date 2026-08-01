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
  await page.goto(`./index.html?room=CARBON-PHASE2A-${width}-${theme}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => (
    document.documentElement.dataset.carbonReady === 'true'
    && customElements.get('cds-button')
    && customElements.get('cds-icon-button')
    && window.SanpoCarbon
    && window.SanpoTheme?.applyTheme
  ));
  await page.evaluate(nextTheme => window.SanpoTheme.applyTheme(nextTheme), theme);
  await page.evaluate(() => document.fonts.ready);
}

test('official Carbon runtime, icons, fonts, and four low-risk buttons are active', async ({ page }) => {
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
  expect(runtime.carbonButtons).toBe(4);
  expect(runtime.iconCount).toBeGreaterThanOrEqual(10);
  expect(runtime.pendingIcons).toBe(0);
  expect(runtime.latinLoaded).toBeTruthy();
  expect(runtime.japaneseLoaded).toBeTruthy();
  expect(runtime.fontResources.some(url => url.endsWith('IBMPlexSans-Regular.woff2'))).toBeTruthy();
  expect(runtime.fontResources.some(url => url.endsWith('IBMPlexSansJP-Regular.woff2'))).toBeTruthy();
  expect(runtime.horizontalOverflow).toBeFalsy();

  const controlAudit = await page.evaluate(() => (
    ['shareLinkBtn', 'overviewMenuBtn', 'overviewDrawerCloseBtn', 'overviewTimetableAddBtn'].map(id => {
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

  await page.locator('#overviewMenuBtn').click();
  await expect(page.locator('#overviewDrawer')).toHaveClass(/is-open/);
  await expect(page.locator('#overviewMenuBtn')).toHaveAttribute('aria-expanded', 'true');
  const beforeRows = await page.locator('.overview-timetable-row').count();
  await page.locator('#overviewTimetableAddBtn').click();
  await expect(page.locator('.overview-timetable-row')).toHaveCount(beforeRows + 1);
  await page.locator('#overviewDrawerCloseBtn').click();
  await expect(page.locator('#overviewDrawer')).not.toHaveClass(/is-open/);
  await expect(page.locator('#overviewMenuBtn')).toHaveAttribute('aria-expanded', 'false');

  expect(consoleProblems).toEqual([]);
});
