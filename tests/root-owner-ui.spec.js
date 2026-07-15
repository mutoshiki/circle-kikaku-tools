const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

const ROOT = path.resolve(__dirname, '..');
const asset = rel => fs.readFileSync(path.join(ROOT, rel));

async function installRoutes(page) {
  await page.route('**/*', async route => {
    const url = route.request().url();
    if (url === 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css') {
      return route.fulfill({ status: 200, contentType: 'text/css', body: asset('node_modules/bootstrap/dist/css/bootstrap.min.css') });
    }
    if (url === 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js') {
      return route.fulfill({ status: 200, contentType: 'application/javascript', body: asset('node_modules/bootstrap/dist/js/bootstrap.bundle.min.js') });
    }
    if (url === 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css') {
      return route.fulfill({ status: 200, contentType: 'text/css', body: asset('node_modules/@fortawesome/fontawesome-free/css/all.min.css') });
    }
    if (url.startsWith('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/')) {
      const filename = path.basename(new URL(url).pathname);
      return route.fulfill({ status: 200, contentType: 'font/woff2', body: asset(`node_modules/@fortawesome/fontawesome-free/webfonts/${filename}`) });
    }
    if (url === 'https://cdnjs.cloudflare.com/ajax/libs/Sortable/1.15.0/Sortable.min.js') {
      return route.fulfill({ status: 200, contentType: 'application/javascript', body: asset('node_modules/sortablejs/Sortable.min.js') });
    }
    if (url.endsWith('/firebase-config.js')) {
      return route.fulfill({ status: 200, contentType: 'application/javascript', body: 'window.SANPO_FIREBASE_CONFIG = {};' });
    }
    return route.continue();
  });
}

async function gotoApp(page, room) {
  await installRoutes(page);
  await page.goto(`./index.html?room=${room}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.switchView === 'function' && typeof window.executeDebugMode === 'function');
}

async function seed(page) {
  await page.evaluate(() => window.executeDebugMode());
  await page.waitForTimeout(300);
}

test('header actions share one borderless mobile icon contract', async ({ page }) => {
  await gotoApp(page, 'ROOT-HEADER-CONTRACT');
  await page.setViewportSize({ width: 390, height: 844 });

  const styles = await page.locator('.header-actions .header-action').evaluateAll(nodes => nodes.map(node => {
    const cs = getComputedStyle(node);
    const icon = node.querySelector('i');
    const iconStyle = getComputedStyle(icon);
    return {
      width: cs.width,
      height: cs.height,
      borderTopWidth: cs.borderTopWidth,
      borderRightWidth: cs.borderRightWidth,
      borderBottomWidth: cs.borderBottomWidth,
      borderLeftWidth: cs.borderLeftWidth,
      backgroundColor: cs.backgroundColor,
      color: cs.color,
      iconSize: iconStyle.fontSize
    };
  }));

  expect(styles).toHaveLength(4);
  for (const style of styles) {
    expect(style).toEqual(styles[0]);
    expect(parseFloat(style.width)).toBeGreaterThanOrEqual(42);
    expect(parseFloat(style.iconSize)).toBeGreaterThanOrEqual(18);
    expect([style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth]).toEqual(['0px', '0px', '0px', '0px']);
  }
});


test('theme follows the device and can also be changed manually', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await gotoApp(page, 'ROOT-THEME-CONTRACT');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => window.SanpoTheme?.effectiveTheme?.() === 'light');

  const lightBackground = await page.locator('body').evaluate(node => getComputedStyle(node).backgroundColor);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

  await page.locator('.header-more > button').click();
  await expect(page.locator('#themeToggleBtn')).toBeVisible();
  await expect(page.locator('#themeToggleBtn')).toContainText('ダークモードに切り替え');
  await page.locator('#themeToggleBtn').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('#themeToggleBtn')).toContainText('ライトモードに切り替え');

  const darkBackground = await page.locator('body').evaluate(node => getComputedStyle(node).backgroundColor);
  expect(darkBackground).not.toBe(lightBackground);

  await page.locator('.header-more > button').click();
  await expect(page.locator('#themeToggleBtn')).toBeVisible();
  await page.locator('#themeToggleBtn').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('#themeToggleBtn')).toContainText('ダークモードに切り替え');

  await page.emulateMedia({ colorScheme: 'dark' });
  await page.waitForFunction(() => window.SanpoTheme?.effectiveTheme?.() === 'dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('#themeToggleBtn')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#themeToggleBtn')).toContainText('ライトモードに切り替え');

  await page.emulateMedia({ colorScheme: 'light' });
  await page.waitForFunction(() => window.SanpoTheme?.effectiveTheme?.() === 'light');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('lock setup supports independent allocation and settlement scopes', async ({ page }) => {
  await gotoApp(page, 'ROOT-LOCK-SCOPES');
  await page.locator('#editLockBtn').click();

  const panel = page.locator('#passphrase-panel');
  await expect(panel).toBeVisible();
  await expect(panel.locator('.lock-scope-option')).toHaveCount(2);
  await expect(panel).toContainText('車割・班割');
  await expect(panel).toContainText('精算');

  await panel.locator('input[value="settlement"]').uncheck();
  await panel.locator('.passphrase-input').nth(0).fill('scope-test');
  await panel.locator('.passphrase-input').nth(1).fill('scope-test');
  await panel.locator('.passphrase-submit').click();
  await expect(panel).toBeHidden();
  await expect(page.locator('#editLockBtn')).toHaveClass(/is-partial-lock/);

  await page.evaluate(() => {
    Object.keys(localStorage)
      .filter(key => key.startsWith('syawari_edit_trust_'))
      .forEach(key => localStorage.removeItem(key));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.switchView === 'function');

  await page.locator('#tab-list').click();
  await expect(page.locator('#passphrase-panel')).toBeVisible();
  await page.locator('#passphrase-panel .passphrase-cancel').click();
  await expect(page.locator('#passphrase-panel')).toBeHidden();

  await page.locator('#tab-seisan').click();
  await expect(page.locator('#seisan-view-area')).toBeVisible();
  await expect(page.locator('#passphrase-panel')).toHaveCount(0);
});

test('cards, capacity popup, overview and edit action use the shared quiet surfaces', async ({ page }) => {
  await gotoApp(page, 'ROOT-SURFACE-CONTRACT');
  await seed(page);
  await page.evaluate(() => window.switchView('list'));
  await page.waitForTimeout(120);

  const cards = await page.evaluate(() => {
    const seatCards = Array.from(document.querySelectorAll('.seat-slot .member-card'));
    const waitingList = document.querySelector('#waiting-list');
    waitingList.appendChild(seatCards.at(-1));
    const assigned = document.querySelector('.seat-slot .member-card');
    const waiting = waitingList.querySelector('.member-card');
    const pick = node => {
      const cs = getComputedStyle(node);
      return {
        backgroundColor: cs.backgroundColor,
        borderRadius: cs.borderRadius,
        borderTopWidth: cs.borderTopWidth,
        boxShadow: cs.boxShadow
      };
    };
    return { assigned: pick(assigned), waiting: pick(waiting) };
  });
  expect(cards.assigned).toEqual(cards.waiting);
  expect(cards.assigned.borderTopWidth).toBe('1px');
  expect(cards.assigned.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');

  await page.evaluate(() => document.querySelector('#waiting-list .member-menu-btn')?.click());
  const personMenu = page.locator('.person-pop-menu');
  await expect(personMenu).toBeVisible();
  const menuLayer = await personMenu.evaluate(node => {
    const tray = document.querySelector('#bottom-tray');
    const rect = node.getBoundingClientRect();
    const topElement = document.elementFromPoint(rect.left + rect.width / 2, rect.top + Math.min(rect.height / 2, 20));
    return {
      menuZ: Number(getComputedStyle(node).zIndex),
      trayZ: Number(getComputedStyle(tray).zIndex),
      menuOwnsTopPoint: node === topElement || node.contains(topElement)
    };
  });
  expect(menuLayer.menuZ).toBeGreaterThan(menuLayer.trayZ);
  expect(menuLayer.menuOwnsTopPoint).toBeTruthy();
  await page.keyboard.press('Escape');
  await expect(personMenu).toHaveCount(0);

  await page.evaluate(() => document.querySelector('.capacity-edit-btn')?.click());
  await expect(page.locator('#commonEditModal')).toBeVisible();
  await page.waitForTimeout(250);
  const modalSurface = await page.locator('#commonEditModal .modal-content').evaluate(node => {
    const cs = getComputedStyle(node);
    const probe = document.createElement('div');
    probe.style.background = 'var(--surface-lowest)';
    document.body.appendChild(probe);
    const expectedSurface = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return {
      borderWidths: [cs.borderTopWidth, cs.borderRightWidth, cs.borderBottomWidth, cs.borderLeftWidth],
      radii: [cs.borderTopLeftRadius, cs.borderTopRightRadius, cs.borderBottomRightRadius, cs.borderBottomLeftRadius],
      backgroundColor: cs.backgroundColor,
      expectedSurface,
      modalOpacity: getComputedStyle(node.closest('.modal')).opacity
    };
  });
  expect(modalSurface.borderWidths).toEqual(['0px', '0px', '0px', '0px']);
  expect(new Set(modalSurface.radii).size).toBe(1);
  expect(modalSurface.backgroundColor).toBe(modalSurface.expectedSurface);
  expect(modalSurface.modalOpacity).toBe('1');
  await page.evaluate(() => {
    const modal = document.querySelector('#commonEditModal');
    window.bootstrap.Modal.getInstance(modal)?.hide();
    modal.classList.remove('show');
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
    document.querySelectorAll('.modal-backdrop').forEach(node => node.remove());
    document.body.classList.remove('modal-open');
  });
  await expect(page.locator('#commonEditModal')).toBeHidden();

  await page.evaluate(() => document.querySelector('#overviewMenuBtn')?.click());
  const overviewBorders = await page.locator('#overviewDrawer .overview-panel').evaluateAll(nodes => nodes.map(node => {
    const cs = getComputedStyle(node);
    return [cs.borderTopWidth, cs.borderRightWidth, cs.borderBottomWidth, cs.borderLeftWidth];
  }));
  overviewBorders.forEach(widths => expect(widths).toEqual(['0px', '0px', '0px', '0px']));
  await page.evaluate(() => document.querySelector('#overviewDrawerCloseBtn')?.click());

  await page.evaluate(() => window.switchView('sheet'));
  await page.waitForTimeout(120);
  const quickEdit = await page.locator('#sheet-quick-edit-btn').evaluate(node => {
    const cs = getComputedStyle(node);
    const root = getComputedStyle(document.documentElement);
    return {
      backgroundColor: cs.backgroundColor,
      accent: root.getPropertyValue('--accent-color').trim(),
      borderWidth: cs.borderTopWidth,
      size: parseFloat(cs.width)
    };
  });
  expect(quickEdit.borderWidth).toBe('0px');
  expect(quickEdit.size).toBeGreaterThanOrEqual(44);
  expect(quickEdit.backgroundColor).not.toBe(quickEdit.accent);
});

test('430px allocation cards stay distinct while the command band scrolls away', async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 932 });
  await gotoApp(page, 'ROOT-CARD-SCROLL-CONTRACT');
  await seed(page);
  await page.evaluate(() => window.switchView('list'));
  await page.waitForTimeout(120);

  const beforeTop = await page.locator('#top-area > .edit-header:first-child').evaluate(node => node.getBoundingClientRect().top);
  await page.locator('#top-area').evaluate(node => node.scrollTo(0, 320));
  await page.waitForTimeout(50);
  const afterTop = await page.locator('#top-area > .edit-header:first-child').evaluate(node => node.getBoundingClientRect().top);
  const state = await page.evaluate(() => {
    const card = document.querySelector('.seat-slot .member-card');
    const emptySeat = document.createElement('div');
    emptySeat.className = 'seat-slot';
    document.body.appendChild(emptySeat);
    const cardStyle = getComputedStyle(card);
    const emptySeatStyle = getComputedStyle(emptySeat);
    const toolbarStyle = getComputedStyle(document.querySelector('#top-area > .edit-header:first-child'));
    const result = {
      cardBorder: cardStyle.borderTopWidth,
      cardBackground: cardStyle.backgroundColor,
      emptySeatBackground: emptySeatStyle.backgroundColor,
      toolbarBorder: toolbarStyle.borderTopWidth,
      toolbarBackground: toolbarStyle.backgroundColor,
      toolbarPosition: toolbarStyle.position,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
    };
    emptySeat.remove();
    return result;
  });

  expect(state.cardBorder).toBe('1px');
  expect(state.cardBackground).not.toBe('rgba(0, 0, 0, 0)');
  expect(state.cardBackground).not.toBe(state.emptySeatBackground);
  expect(state.toolbarBorder).toBe('0px');
  expect(state.toolbarBackground).toBe('rgba(0, 0, 0, 0)');
  expect(state.toolbarPosition).toBe('relative');
  expect(afterTop).toBeLessThan(beforeTop - 100);
  expect(state.overflow).toBeLessThanOrEqual(0);
});

test('swap preview hides the displaced original instead of showing two copies', async ({ page }) => {
  await gotoApp(page, 'ROOT-DRAG-SINGLE-VISUAL');
  await seed(page);
  await page.evaluate(() => window.switchView('list'));
  await page.waitForTimeout(120);

  const result = await page.evaluate(() => {
    const source = document.querySelector('.seat-slot .member-card');
    const target = Array.from(document.querySelectorAll('.seat-slot')).find(slot => slot !== source.parentElement && slot.querySelector('.member-card'));
    const sourceRect = source.getBoundingClientRect();
    window.startManualCardDrag(source, {
      clientX: sourceRect.left + sourceRect.width / 2,
      clientY: sourceRect.top + sourceRect.height / 2,
      pointerType: 'mouse',
      pointerId: 91
    });
    window.moveManualDragCardTo(target);
    const displaced = target.querySelector('.seat-card-will-move');
    const previews = document.querySelectorAll('.swap-preview-card');
    const state = {
      previewCount: previews.length,
      displacedVisibility: getComputedStyle(displaced).visibility,
      displacedOpacity: getComputedStyle(displaced).opacity,
      visibleDisplacedCount: Array.from(document.querySelectorAll('.seat-card-will-move')).filter(node => {
        const cs = getComputedStyle(node);
        return cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0;
      }).length
    };
    window.finishManualCardDrag(false);
    return state;
  });

  expect(result.previewCount).toBe(1);
  expect(result.displacedVisibility).toBe('hidden');
  expect(result.displacedOpacity).toBe('0');
  expect(result.visibleDisplacedCount).toBe(0);
});

test('shared sheet labels, capacities and ordinary helper actions use one quiet contract', async ({ page }) => {
  await gotoApp(page, 'ROOT-SHARED-UI-UNIFICATION');
  await seed(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.switchView('sheet'));
  await page.waitForTimeout(120);

  const headings = await page.locator('.sheet-car-header:not(.sheet-label-header)').evaluateAll(nodes => (
    nodes.map(node => node.childNodes[0]?.textContent.trim())
  ));
  expect(headings).toEqual(['車1', '車2', '車3', '班1', '班2', '班3']);

  const capacities = await page.locator('.sheet-capacity-badge').evaluateAll(nodes => nodes.map(node => {
    const style = getComputedStyle(node);
    return {
      className: node.className,
      color: style.color,
      backgroundColor: style.backgroundColor,
      borderColor: style.borderColor
    };
  }));
  const full = capacities.find(item => item.className.includes('is-full'));
  const available = capacities.find(item => !item.className.includes('is-full') && !item.className.includes('is-over'));
  expect(full).toBeTruthy();
  expect(available).toBeTruthy();
  expect({ color: full.color, backgroundColor: full.backgroundColor, borderColor: full.borderColor }).toEqual({
    color: available.color,
    backgroundColor: available.backgroundColor,
    borderColor: available.borderColor
  });

  await page.evaluate(() => window.switchView('seisan'));
  await page.waitForTimeout(120);
  const copyStyle = await page.locator('[data-action="copy-settlement-text"]').evaluate(node => {
    const style = getComputedStyle(node);
    return {
      backgroundColor: style.backgroundColor,
      color: style.color,
      borderColor: style.borderColor,
      borderRadius: style.borderRadius,
      minHeight: style.minHeight
    };
  });

  await page.locator('#seisan-car-list [data-action="open-settlement-car-edit"]').first().click();
  await expect(page.locator('#settlementCarEditModal')).toBeVisible();
  const distanceStyle = await page.locator('.seisan-distance-shortcut').evaluate(node => {
    const style = getComputedStyle(node);
    return {
      backgroundColor: style.backgroundColor,
      color: style.color,
      borderColor: style.borderColor,
      borderRadius: style.borderRadius,
      minHeight: style.minHeight
    };
  });

  expect({
    backgroundColor: distanceStyle.backgroundColor,
    color: distanceStyle.color,
    borderColor: distanceStyle.borderColor
  }).toEqual({
    backgroundColor: copyStyle.backgroundColor,
    color: copyStyle.color,
    borderColor: copyStyle.borderColor
  });
  expect(parseFloat(copyStyle.minHeight)).toBeGreaterThanOrEqual(36);
  expect(parseFloat(distanceStyle.minHeight)).toBeGreaterThanOrEqual(36);
  expect(copyStyle.borderRadius).toBe('0px');
  expect(distanceStyle.borderRadius).toBe('0px');

  const accent = await page.evaluate(() => {
    const probe = document.createElement('span');
    probe.style.color = 'var(--accent-color)';
    document.body.appendChild(probe);
    const value = getComputedStyle(probe).color;
    probe.remove();
    return value;
  });
  expect(copyStyle.backgroundColor).not.toBe(accent);
  expect(distanceStyle.backgroundColor).not.toBe(accent);
});
