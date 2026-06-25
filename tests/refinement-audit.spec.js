const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

const ROOT = path.resolve(__dirname, '..');
const SIZES = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1280, height: 720 },
  { width: 1440, height: 900 }
];
const MODALS = [
  '#commonEditModal',
  '#batchImportModal',
  '#userGuideModal',
  '#settlementSettingsModal',
  '#settlementCarEditModal',
  '#routeDistanceModal',
  '#historyModal',
  '#debugModal'
];

function asset(rel) {
  return fs.readFileSync(path.join(ROOT, rel));
}

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
      const name = path.basename(new URL(url).pathname);
      return route.fulfill({ status: 200, contentType: 'font/woff2', body: asset(`node_modules/@fortawesome/fontawesome-free/webfonts/${name}`) });
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

async function gotoSeeded(page, room = 'REFINEMENT-AUDIT') {
  await installRoutes(page);
  await page.goto(`./index.html?room=${room}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.executeDebugMode === 'function' && typeof window.switchView === 'function');
  await page.evaluate(() => window.executeDebugMode());
  await page.waitForTimeout(350);
}

async function switchView(page, view) {
  await page.evaluate(nextView => window.switchView(nextView), view);
  await page.waitForTimeout(80);
}

async function overflowState(page, rootSelector) {
  return page.evaluate(selector => {
    const doc = document.documentElement;
    const root = document.querySelector(selector);
    return {
      documentOverflow: doc.scrollWidth > doc.clientWidth + 1,
      rootOverflow: root ? root.scrollWidth > root.clientWidth + 1 : false,
      documentScrollWidth: doc.scrollWidth,
      documentClientWidth: doc.clientWidth,
      rootScrollWidth: root?.scrollWidth || 0,
      rootClientWidth: root?.clientWidth || 0
    };
  }, rootSelector);
}

async function closeModal(page, selector) {
  await page.evaluate(sel => {
    const el = document.querySelector(sel);
    window.bootstrap?.Modal?.getInstance(el)?.hide();
  }, selector);
  await page.waitForTimeout(220);
  await page.evaluate(sel => {
    const el = document.querySelector(sel);
    el?.classList.remove('show');
    if (el) {
      el.style.display = 'none';
      el.setAttribute('aria-hidden', 'true');
    }
    document.querySelectorAll('.modal-backdrop').forEach(node => node.remove());
    document.body.classList.remove('modal-open');
  }, selector);
}


test('six target widths keep all main views and long-content stress free of horizontal overflow', async ({ page }) => {
  const consoleErrors = [];
  const requestFailures = [];
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', error => consoleErrors.push(error.message));
  page.on('requestfailed', request => {
    if (!request.url().startsWith('data:')) requestFailures.push(`${request.url()} ${request.failure()?.errorText || ''}`);
  });

  await gotoSeeded(page);

  for (const size of SIZES) {
    await page.setViewportSize(size);

    for (const [view, root] of [['list', '#top-area'], ['sheet', '#sheet-view-area'], ['seisan', '#seisan-view-area']]) {
      await switchView(page, view);
      const state = await overflowState(page, root);
      expect(state, `${size.width}px ${view}`).toEqual(expect.objectContaining({ documentOverflow: false, rootOverflow: false }));
    }

    await switchView(page, 'list');
    await page.evaluate(() => {
      const longTitle = '飯綱高原 新歓ドライブ・写真撮影・交流会 参加者最終確認版 2026';
      const title = document.querySelector('#roomNameInput');
      if (title) title.value = longTitle;
      document.querySelectorAll('.car-name-label').forEach((node, index) => {
        node.textContent = `とても長い運転者氏名と車両情報を含む車名 ${index + 1}号車`;
      });
      document.querySelectorAll('.member-name-text').forEach((node, index) => {
        node.textContent = `非常に長い参加者氏名${index + 1}・所属情報`;
      });
    });
    let stress = await overflowState(page, '#top-area');
    expect(stress.documentOverflow, `${size.width}px long list`).toBeFalsy();
    expect(stress.rootOverflow, `${size.width}px long list root`).toBeFalsy();

    await switchView(page, 'seisan');
    await page.evaluate(() => {
      document.querySelectorAll('.seisan-summary-value, .seisan-car-summary-total, .seisan-driver-amount').forEach(node => {
        node.textContent = '¥99,999,999';
      });
    });
    stress = await overflowState(page, '#seisan-view-area');
    expect(stress.documentOverflow, `${size.width}px long amount`).toBeFalsy();
    expect(stress.rootOverflow, `${size.width}px long amount root`).toBeFalsy();
  }

  expect(consoleErrors).toEqual([]);
  expect(requestFailures).toEqual([]);
});

test('focus, disabled, selected and closed-drawer states remain distinct and operable', async ({ page }) => {
  await gotoSeeded(page, 'REFINEMENT-STATES');
  await page.setViewportSize({ width: 390, height: 844 });
  await switchView(page, 'list');

  await page.evaluate(() => document.activeElement?.blur());
  const keyboardFocus = [];
  for (let index = 0; index < 5; index += 1) {
    await page.keyboard.press('Tab');
    keyboardFocus.push(await page.evaluate(() => {
      const node = document.activeElement;
      const cs = getComputedStyle(node);
      return {
        tag: node?.tagName || '',
        id: node?.id || '',
        className: node?.className || '',
        focusVisible: node?.matches?.(':focus-visible') || false,
        outlineStyle: cs.outlineStyle,
        outlineWidth: parseFloat(cs.outlineWidth),
        outlineOffset: parseFloat(cs.outlineOffset)
      };
    }));
  }
  expect(keyboardFocus.map(item => item.id)).toEqual([
    'roomNameInput',
    '',
    'editLockBtn',
    'shareLinkBtn',
    'overviewMenuBtn'
  ]);
  for (const focus of keyboardFocus) {
    expect(focus.focusVisible, `${focus.id || focus.className} focus-visible`).toBeTruthy();
    expect(focus.outlineStyle, `${focus.id || focus.className} outline`).not.toBe('none');
    expect(focus.outlineWidth, `${focus.id || focus.className} outline width`).toBeGreaterThanOrEqual(2);
    expect(focus.outlineOffset, `${focus.id || focus.className} outline offset`).toBeGreaterThanOrEqual(2);
  }

  const menuBox = await page.locator('.member-menu-btn').first().boundingBox();
  expect(menuBox.width).toBeGreaterThanOrEqual(32);
  expect(menuBox.height).toBeGreaterThanOrEqual(32);

  const disabled = page.locator('#batchOpenBtn');
  await disabled.evaluate(node => { node.disabled = true; });
  const disabledStyle = await disabled.evaluate(node => {
    const cs = getComputedStyle(node);
    return { opacity: Number(cs.opacity), pointerEvents: cs.pointerEvents, cursor: cs.cursor };
  });
  expect(disabledStyle.opacity).toBeLessThanOrEqual(0.5);
  expect(disabledStyle.pointerEvents).toBe('none');
  expect(disabledStyle.cursor).toBe('not-allowed');

  const activeTab = page.locator('.view-tab.active');
  const inactiveTab = page.locator('.view-tab:not(.active)').first();
  const [activeStyle, inactiveStyle] = await Promise.all([
    activeTab.evaluate(node => {
      const cs = getComputedStyle(node, '::after');
      return `${cs.backgroundColor}|${cs.height}|${cs.left}|${cs.right}`;
    }),
    inactiveTab.evaluate(node => {
      const cs = getComputedStyle(node, '::after');
      return `${cs.backgroundColor}|${cs.height}|${cs.left}|${cs.right}`;
    })
  ]);
  expect(activeStyle).not.toBe(inactiveStyle);

  const drawer = page.locator('#overviewDrawer');
  const closed = await drawer.evaluate(node => {
    const cs = getComputedStyle(node);
    return { visibility: cs.visibility, pointerEvents: cs.pointerEvents, transform: cs.transform };
  });
  expect(closed.visibility).toBe('hidden');
  expect(closed.pointerEvents).toBe('none');

  await page.locator('#overviewMenuBtn').click();
  await expect(drawer).toHaveClass(/is-open/);
  const opened = await drawer.evaluate(node => {
    const cs = getComputedStyle(node);
    return { visibility: cs.visibility, pointerEvents: cs.pointerEvents };
  });
  expect(opened).toEqual({ visibility: 'visible', pointerEvents: 'auto' });
});

test('every modal fits the viewport and exposes a reachable scroll region', async ({ page }) => {
  await gotoSeeded(page, 'REFINEMENT-MODALS');

  for (const size of [{ width: 390, height: 844 }, { width: 1280, height: 720 }]) {
    await page.setViewportSize(size);
    await page.evaluate(() => window.mountGuideTemplates?.());

    for (const selector of MODALS) {
      await closeModal(page, selector);
      await page.evaluate(sel => {
        if (sel === '#historyModal') {
          window.showHistory?.();
          return;
        }
        if (sel === '#settlementSettingsModal') {
          window.openSettlementSettings?.();
          return;
        }
        if (sel === '#settlementCarEditModal') {
          window.openSettlementCarEditor?.(encodeURIComponent('高橋 健介'));
          return;
        }
        if (sel === '#debugModal') {
          window.openDebugModal?.();
          return;
        }
        const el = document.querySelector(sel);
        window.bootstrap.Modal.getOrCreateInstance(el).show();
      }, selector);
      const modal = page.locator(selector);
      await expect(modal, `${size.width}px ${selector}`).toBeVisible();
      const layout = await modal.locator('.modal-content').evaluate(node => {
        const rect = node.getBoundingClientRect();
        const body = node.querySelector('.modal-body');
        return {
          top: rect.top,
          bottom: rect.bottom,
          left: rect.left,
          right: rect.right,
          viewportWidth: innerWidth,
          viewportHeight: innerHeight,
          bodyScrollable: body ? body.scrollHeight >= body.clientHeight : true,
          bodyClientHeight: body?.clientHeight || 0
        };
      });
      expect(layout.top, `${selector} top`).toBeGreaterThanOrEqual(-1);
      expect(layout.left, `${selector} left`).toBeGreaterThanOrEqual(-1);
      expect(layout.right, `${selector} right`).toBeLessThanOrEqual(size.width + 1);
      expect(layout.bottom, `${selector} bottom`).toBeLessThanOrEqual(size.height + 1);
      expect(layout.bodyClientHeight, `${selector} body height`).toBeGreaterThan(0);
      await closeModal(page, selector);
    }
  }
});
