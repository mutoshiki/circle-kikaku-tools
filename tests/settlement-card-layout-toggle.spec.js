const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

const ROOT = path.resolve(__dirname, '..');
const asset = relativePath => fs.readFileSync(path.join(ROOT, relativePath));

async function installOfflineAssets(page) {
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

async function gotoSeededSettlement(page, room) {
  await installOfflineAssets(page);
  await page.goto(`./index.html?room=${room}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.switchView === 'function' && typeof window.executeDebugMode === 'function');
  await page.evaluate(() => {
    localStorage.removeItem('syawari_settlement_car_layout');
    window.executeDebugMode();
  });
  await page.waitForTimeout(320);
  await page.locator('#tab-seisan').click();
  await expect(page.locator('#seisan-car-list .seisan-car-summary-row')).toHaveCount(3);
}

async function readCardGeometry(page) {
  return page.locator('#seisan-car-list .seisan-car-summary-row').first().evaluate(card => {
    const lines = [...card.querySelectorAll('.seisan-cost-line')];
    const total = card.querySelector('.seisan-cost-total-row');
    const detailLabel = lines[0]?.querySelector(':scope > span:first-child');
    const detailAmount = lines[0]?.querySelector('.seisan-cost-line-amount');
    const totalAmount = total?.querySelector('.seisan-car-summary-total');
    const badges = lines
      .map(line => line.querySelector('.seisan-cost-type-badge, .seisan-payment-tag'))
      .filter(Boolean);
    const amounts = lines
      .map(line => line.querySelector('.seisan-cost-line-amount'))
      .filter(Boolean);
    const badgeLefts = badges.map(node => node.getBoundingClientRect().left);
    const amountRights = [...amounts, totalAmount].filter(Boolean).map(node => node.getBoundingClientRect().right);
    const rowContracts = [...lines, total].filter(Boolean).map(line => {
      const name = line.querySelector(':scope > span:first-child');
      const badge = line.querySelector('.seisan-cost-type-badge, .seisan-payment-tag');
      const amount = line.querySelector('.seisan-car-summary-total');
      const lineRect = line.getBoundingClientRect();
      const nameRect = name?.getBoundingClientRect();
      const badgeRect = badge?.getBoundingClientRect();
      const amountRect = amount?.getBoundingClientRect();
      return {
        contained: !!(nameRect && badgeRect && amountRect &&
          nameRect.left >= lineRect.left - 1 &&
          amountRect.right <= lineRect.right + 1),
        ordered: !!(nameRect && badgeRect && amountRect &&
          nameRect.right <= badgeRect.left + 1 &&
          badgeRect.right <= amountRect.left + 1)
      };
    });
    const labelStyle = getComputedStyle(detailLabel);
    const detailStyle = getComputedStyle(detailAmount);
    const totalStyle = getComputedStyle(totalAmount);
    return {
      badgeSpread: badgeLefts.length ? Math.max(...badgeLefts) - Math.min(...badgeLefts) : 0,
      amountSpread: amountRights.length ? Math.max(...amountRights) - Math.min(...amountRights) : 0,
      rowsContained: rowContracts.every(row => row.contained),
      rowsOrdered: rowContracts.every(row => row.ordered),
      labelTypography: {
        fontSize: labelStyle.fontSize,
        fontWeight: labelStyle.fontWeight,
        color: labelStyle.color,
        letterSpacing: labelStyle.letterSpacing,
        fontFamily: labelStyle.fontFamily
      },
      detailTypography: {
        fontSize: detailStyle.fontSize,
        fontWeight: detailStyle.fontWeight,
        color: detailStyle.color,
        letterSpacing: detailStyle.letterSpacing,
        fontFamily: detailStyle.fontFamily
      },
      totalTypography: {
        fontSize: totalStyle.fontSize,
        fontWeight: totalStyle.fontWeight,
        color: totalStyle.color,
        letterSpacing: totalStyle.letterSpacing,
        fontFamily: totalStyle.fontFamily
      }
    };
  });
}

test('driver payment layout icon switches between compact and one-column views and persists', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoSeededSettlement(page, 'PAYMENT-LAYOUT-TOGGLE');

  const toggle = page.locator('#seisanCarLayoutToggle');
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(toggle.locator('.seisan-layout-grid-icon > span')).toHaveCount(4);

  const headerGeometry = await page.locator('.seisan-car-panel .seisan-head').evaluate(header => {
    const title = header.querySelector('.seisan-title').getBoundingClientRect();
    const button = header.querySelector('#seisanCarLayoutToggle').getBoundingClientRect();
    return { separated: title.right <= button.left + 1, buttonInside: button.right <= header.getBoundingClientRect().right + 1 };
  });
  expect(headerGeometry.separated).toBeTruthy();
  expect(headerGeometry.buttonInside).toBeTruthy();

  const compactGrid = await page.locator('#seisan-car-list').evaluate(node => ({
    className: node.className,
    columns: getComputedStyle(node).gridTemplateColumns.split(' ').filter(Boolean).length
  }));
  expect(compactGrid.className).toContain('is-two-column');
  expect(compactGrid.columns).toBe(2);

  const compactGeometry = await readCardGeometry(page);
  expect(compactGeometry.badgeSpread).toBeLessThanOrEqual(1.5);
  expect(compactGeometry.amountSpread).toBeLessThanOrEqual(1.5);
  expect(compactGeometry.rowsContained).toBeTruthy();
  expect(compactGeometry.rowsOrdered).toBeTruthy();
  expect(compactGeometry.detailTypography).toEqual(compactGeometry.labelTypography);
  expect(compactGeometry.totalTypography).toEqual(compactGeometry.labelTypography);

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(toggle.locator('.seisan-layout-grid-icon > span')).toHaveCount(4);
  const listGrid = await page.locator('#seisan-car-list').evaluate(node => ({
    className: node.className,
    columns: getComputedStyle(node).gridTemplateColumns.split(' ').filter(Boolean).length,
    stored: localStorage.getItem('syawari_settlement_car_layout')
  }));
  expect(listGrid.className).not.toContain('is-two-column');
  expect(listGrid.columns).toBe(1);
  expect(listGrid.stored).toBe('list');

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.switchView === 'function');
  await page.locator('#tab-seisan').click();
  await expect(page.locator('#seisanCarLayoutToggle')).toHaveAttribute('aria-pressed', 'false');
  expect(await page.locator('#seisan-car-list').evaluate(node => getComputedStyle(node).gridTemplateColumns.split(' ').filter(Boolean).length)).toBe(1);

  await page.locator('#seisanCarLayoutToggle').click();
  await expect(page.locator('#seisanCarLayoutToggle')).toHaveAttribute('aria-pressed', 'true');
  expect(await page.locator('#seisan-car-list').evaluate(node => getComputedStyle(node).gridTemplateColumns.split(' ').filter(Boolean).length)).toBe(2);
});

for (const width of [320, 360, 390, 430]) {
  test(`compact driver cards remain aligned without horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await gotoSeededSettlement(page, `PAYMENT-LAYOUT-${width}`);

    const pageContract = await page.evaluate(() => {
      const list = document.querySelector('#seisan-car-list');
      const listRect = list.getBoundingClientRect();
      const cards = [...list.querySelectorAll(':scope > .seisan-car-summary-row')];
      const titleRect = document.querySelector('.seisan-car-panel .seisan-title').getBoundingClientRect();
      const toggleRect = document.querySelector('#seisanCarLayoutToggle').getBoundingClientRect();
      return {
        viewportOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
        listOverflow: list.scrollWidth > list.clientWidth + 1,
        cardsInside: cards.every(card => {
          const rect = card.getBoundingClientRect();
          return rect.left >= listRect.left - 1 && rect.right <= listRect.right + 1;
        }),
        titleToggleSeparated: titleRect.right <= toggleRect.left + 1,
        columns: getComputedStyle(list).gridTemplateColumns.split(' ').filter(Boolean).length
      };
    });
    expect(pageContract.viewportOverflow).toBeFalsy();
    expect(pageContract.listOverflow).toBeFalsy();
    expect(pageContract.cardsInside).toBeTruthy();
    expect(pageContract.titleToggleSeparated).toBeTruthy();
    expect(pageContract.columns).toBe(2);

    const geometry = await readCardGeometry(page);
    expect(geometry.badgeSpread).toBeLessThanOrEqual(1.5);
    expect(geometry.amountSpread).toBeLessThanOrEqual(1.5);
    expect(geometry.rowsContained).toBeTruthy();
    expect(geometry.rowsOrdered).toBeTruthy();
    expect(geometry.detailTypography).toEqual(geometry.labelTypography);
    expect(geometry.totalTypography).toEqual(geometry.labelTypography);
  });
}
