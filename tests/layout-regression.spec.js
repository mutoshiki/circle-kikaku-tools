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

async function gotoSeededApp(page, room) {
  await installOfflineAssets(page);
  await page.goto(`./index.html?room=${room}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.switchView === 'function' && typeof window.executeDebugMode === 'function');
  await page.evaluate(() => window.executeDebugMode());
  await page.waitForTimeout(320);
}

for (const viewport of [
  { width: 360, height: 800 },
  { width: 390, height: 844 }
]) {
  test(`shared view restores free legacy movement at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await gotoSeededApp(page, `SHARED-LEGACY-MOVE-${viewport.width}`);
    await page.evaluate(() => window.switchView('sheet'));
    await expect(page.locator('#sheet-view-area')).toBeVisible();
    await expect(page.locator('#sheet-content')).toBeVisible();
    await page.waitForTimeout(250);

    const canvas = page.locator('#sheet-canvas');
    const content = page.locator('#sheet-content');
    const canvasBox = await canvas.boundingBox();
    if (!canvasBox) throw new Error('shared sheet canvas is not measurable');

    const before = await content.evaluate(node => {
      const matrix = new DOMMatrix(getComputedStyle(node).transform);
      return {
        x: matrix.e,
        y: matrix.f,
        scale: matrix.a,
        bottomPadding: parseFloat(getComputedStyle(node).paddingBottom),
        documentOverflow: document.documentElement.scrollWidth > window.innerWidth
      };
    });

    await page.mouse.move(canvasBox.x + canvasBox.width * 0.7, canvasBox.y + canvasBox.height * 0.68);
    await page.mouse.down();
    await page.mouse.move(canvasBox.x + canvasBox.width * 0.36, canvasBox.y + canvasBox.height * 0.32, { steps: 8 });
    await page.mouse.up();

    const after = await content.evaluate(node => {
      const matrix = new DOMMatrix(getComputedStyle(node).transform);
      return { x: matrix.e, y: matrix.f, scale: matrix.a };
    });

    expect(before.scale).toBeGreaterThanOrEqual(0.7);
    expect(after.x).not.toBe(before.x);
    expect(after.y).not.toBe(before.y);
    expect(after.scale).toBeCloseTo(before.scale, 4);
    expect(before.bottomPadding).toBeGreaterThanOrEqual(100);
    expect(before.documentOverflow).toBeFalsy();
  });

  test(`distance fuel and price stay horizontal without overlap at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await gotoSeededApp(page, `GAS-GRID-${viewport.width}`);
    await page.locator('#tab-seisan').click();
    await page.locator('#seisan-car-list [data-action="open-settlement-car-edit"]').first().click();
    await expect(page.locator('#settlementCarEditModal')).toBeVisible();

    const fields = page.locator('#settlementCarEditModal .seisan-gas-field-row > label');
    await expect(fields).toHaveCount(3);
    const labels = await fields.locator('.seisan-mini-label').allTextContents();
    expect(labels).toEqual(['移動距離（km）', '燃費（km/L）', 'ガソリン単価（円/L）']);

    const geometry = await fields.evaluateAll(nodes => nodes.map(node => {
      const input = node.querySelector('input');
      const rect = node.getBoundingClientRect();
      const inputRect = input.getBoundingClientRect();
      return {
        top: rect.top,
        left: rect.left,
        right: rect.right,
        width: rect.width,
        inputLeft: inputRect.left,
        inputRight: inputRect.right,
        inputWidth: inputRect.width
      };
    }));

    expect(Math.max(...geometry.map(item => item.top)) - Math.min(...geometry.map(item => item.top))).toBeLessThanOrEqual(1);
    expect(geometry.every(item => item.width > 0 && item.inputWidth > 0)).toBeTruthy();
    for (let index = 0; index < geometry.length - 1; index += 1) {
      expect(geometry[index].right).toBeLessThanOrEqual(geometry[index + 1].left);
      expect(geometry[index].inputRight).toBeLessThanOrEqual(geometry[index + 1].inputLeft);
    }
    const extraRow = page.locator('#settlementCarEditModal .seisan-extra-row').first();
    await expect(extraRow).toBeVisible();
    const extraGeometry = await extraRow.evaluate(node => {
      const controls = [...node.children].map(child => {
        const rect = child.getBoundingClientRect();
        return { top: rect.top, left: rect.left, right: rect.right, width: rect.width };
      });
      return { controls, rowWidth: node.getBoundingClientRect().width };
    });
    expect(extraGeometry.controls).toHaveLength(4);
    expect(Math.max(...extraGeometry.controls.map(item => item.top)) - Math.min(...extraGeometry.controls.map(item => item.top))).toBeLessThanOrEqual(1);
    for (let index = 0; index < extraGeometry.controls.length - 1; index += 1) {
      expect(extraGeometry.controls[index].right).toBeLessThanOrEqual(extraGeometry.controls[index + 1].left);
    }

    const addButton = page.locator('#settlementCarEditModal [data-action="add-settlement-extra"]');
    const addGeometry = await addButton.evaluate(node => {
      const button = node.getBoundingClientRect();
      const row = node.closest('.seisan-add-row').getBoundingClientRect();
      const extra = node.closest('.seisan-car-row').querySelector('.seisan-extra-row').getBoundingClientRect();
      return {
        buttonWidth: button.width,
        buttonHeight: button.height,
        rowWidth: row.width,
        buttonTop: button.top,
        extraBottom: extra.bottom
      };
    });
    expect(addGeometry.buttonWidth).toBeLessThan(addGeometry.rowWidth - 40);
    expect(addGeometry.buttonHeight).toBeGreaterThanOrEqual(48);
    expect(addGeometry.buttonTop).toBeGreaterThan(addGeometry.extraBottom);

    const modalOverflow = await page.locator('#settlementCarEditModal .modal-dialog').evaluate(node => node.scrollWidth > node.clientWidth);
    expect(modalOverflow).toBeFalsy();
  });
}

test('participant registration help keeps its left disclosure triangles', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoSeededApp(page, 'PARTICIPANT-DISCLOSURE');
  await page.evaluate(() => window.switchView('list'));
  await page.locator('#batchOpenBtn').click();
  await expect(page.locator('#batchImportModal')).toBeVisible();

  const summaries = page.locator('#batchImportModal .batch-import-help-details > summary');
  await expect(summaries).toHaveCount(2);
  await expect(summaries).toHaveText(['貼り付け方を見る', '自動判定の仕組み']);

  for (let index = 0; index < 2; index += 1) {
    const markerStyle = await summaries.nth(index).evaluate(node => {
      const pseudo = getComputedStyle(node, '::before');
      return {
        display: pseudo.display,
        borderLeftWidth: parseFloat(pseudo.borderLeftWidth),
        borderLeftColor: pseudo.borderLeftColor,
        width: node.getBoundingClientRect().width
      };
    });
    expect(markerStyle.display).not.toBe('none');
    expect(markerStyle.borderLeftWidth).toBeGreaterThanOrEqual(7);
    expect(markerStyle.borderLeftColor).not.toBe('rgba(0, 0, 0, 0)');
    expect(markerStyle.width).toBeGreaterThan(200);
  }

  await summaries.first().click();
  await expect(page.locator('#batchImportModal .batch-import-help-details').first()).toHaveAttribute('open', '');
});

test('pinpoint settlement and shared-view fixes stay readable and operable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoSeededApp(page, 'PINPOINT-FOLLOWUP');

  await page.locator('#tab-seisan').click();
  const collectionPanel = page.locator('.seisan-collection-panel');
  await expect(collectionPanel).toBeVisible();
  await expect(collectionPanel.locator('.seisan-title')).toContainText('割勘集金チェック');

  const describedRow = collectionPanel.locator('.seisan-check-item:has(.seisan-check-note)').first();
  await expect(describedRow).toBeVisible();
  const copyGeometry = await describedRow.evaluate(node => {
    const name = node.querySelector('.seisan-check-name').getBoundingClientRect();
    const note = node.querySelector('.seisan-check-note').getBoundingClientRect();
    return {
      nameRight: name.right,
      noteLeft: note.left,
      noteWidth: note.width,
      noteText: node.querySelector('.seisan-check-note').textContent.trim()
    };
  });
  expect(copyGeometry.noteText.length).toBeGreaterThan(0);
  expect(copyGeometry.noteWidth).toBeGreaterThan(40);
  expect(copyGeometry.noteLeft).toBeGreaterThanOrEqual(copyGeometry.nameRight - 1);

  const detailAmount = page.locator('#seisan-car-list .seisan-cost-line-amount').first();
  const totalAmount = page.locator('#seisan-car-list .seisan-cost-total-row .seisan-car-summary-total').first();
  await expect(detailAmount).toBeVisible();
  const amountSizes = await page.evaluate(() => ({
    detail: parseFloat(getComputedStyle(document.querySelector('#seisan-car-list .seisan-cost-line-amount')).fontSize),
    total: parseFloat(getComputedStyle(document.querySelector('#seisan-car-list .seisan-cost-total-row .seisan-car-summary-total')).fontSize)
  }));
  expect(amountSizes.detail).toBeGreaterThanOrEqual(18);
  expect(amountSizes.total).toBeGreaterThan(amountSizes.detail);

  await page.evaluate(() => window.switchView('sheet'));
  const driverRow = page.locator('.sheet-driver-row:not(.sheet-label-row):has(.grade-badge)').first();
  await expect(driverRow).toBeVisible();
  const badgeOrder = await driverRow.evaluate(node => {
    const badge = node.querySelector('.grade-badge').getBoundingClientRect();
    const name = node.querySelector('.sheet-driver-name').getBoundingClientRect();
    return { badgeLeft: badge.left, badgeRight: badge.right, nameLeft: name.left };
  });
  expect(badgeOrder.badgeLeft).toBeLessThan(badgeOrder.nameLeft);
  expect(badgeOrder.badgeRight).toBeLessThanOrEqual(badgeOrder.nameLeft + 1);

  await expect(page.locator('#zoom-controls')).toHaveCount(0);
  await expect(page.locator('.sheet-plan-section:not(.sheet-timetable-section) > .sheet-plan-heading')).toHaveText(['車割', '班割']);

  const canvas = page.locator('#sheet-canvas');
  const canvasBox = await canvas.boundingBox();
  if (!canvasBox) throw new Error('shared sheet canvas is not measurable');

  const beforeZoom = await page.locator('#sheet-content').evaluate(node => new DOMMatrix(getComputedStyle(node).transform).a);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  const centerX = canvasBox.x + canvasBox.width * 0.5;
  const centerY = canvasBox.y + canvasBox.height * 0.52;
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [
      { x: centerX - 36, y: centerY, radiusX: 4, radiusY: 4, force: 1, id: 1 },
      { x: centerX + 36, y: centerY, radiusX: 4, radiusY: 4, force: 1, id: 2 }
    ]
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [
      { x: centerX - 70, y: centerY - 12, radiusX: 4, radiusY: 4, force: 1, id: 1 },
      { x: centerX + 70, y: centerY + 12, radiusX: 4, radiusY: 4, force: 1, id: 2 }
    ]
  });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const afterZoom = await page.locator('#sheet-content').evaluate(node => new DOMMatrix(getComputedStyle(node).transform).a);
  expect(afterZoom).toBeGreaterThan(beforeZoom);

  const touchPanBefore = await page.locator('#sheet-content').evaluate(node => { const matrix = new DOMMatrix(getComputedStyle(node).transform); return { x: matrix.e, y: matrix.f }; });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: centerX, y: centerY, radiusX: 4, radiusY: 4, force: 1, id: 3 }]
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: centerX - 64, y: centerY - 86, radiusX: 4, radiusY: 4, force: 1, id: 3 }]
  });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const touchPanAfter = await page.locator('#sheet-content').evaluate(node => { const matrix = new DOMMatrix(getComputedStyle(node).transform); return { x: matrix.e, y: matrix.f }; });
  expect(touchPanAfter.x !== touchPanBefore.x || touchPanAfter.y !== touchPanBefore.y).toBeTruthy();

  const panBefore = await page.locator('#sheet-content').evaluate(node => { const matrix = new DOMMatrix(getComputedStyle(node).transform); return { x: matrix.e, y: matrix.f }; });
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.72, canvasBox.y + canvasBox.height * 0.65);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.38, canvasBox.y + canvasBox.height * 0.35, { steps: 6 });
  await page.mouse.up();
  const panAfter = await page.locator('#sheet-content').evaluate(node => { const matrix = new DOMMatrix(getComputedStyle(node).transform); return { x: matrix.e, y: matrix.f }; });
  expect(panAfter.x !== panBefore.x || panAfter.y !== panBefore.y).toBeTruthy();

  await page.locator('#overviewMenuBtn').click();
  await expect(page.locator('#overviewDrawer')).toHaveClass(/is-open/);
  const layerOrder = await page.evaluate(() => ({
    drawer: Number(getComputedStyle(document.querySelector('#overviewDrawer')).zIndex),
    scrim: Number(getComputedStyle(document.querySelector('#overviewDrawerScrim')).zIndex),
    quickEdit: Number(getComputedStyle(document.querySelector('#sheet-quick-edit-btn')).zIndex || getComputedStyle(document.querySelector('#sheet-bottom-controls')).zIndex || 0),
    floatingToken: Number(getComputedStyle(document.documentElement).getPropertyValue('--z-floating')),
    modalToken: Number(getComputedStyle(document.documentElement).getPropertyValue('--z-modal'))
  }));
  expect(layerOrder.drawer).toBeGreaterThan(layerOrder.floatingToken);
  expect(layerOrder.scrim).toBeGreaterThan(layerOrder.floatingToken);
  expect(layerOrder.modalToken).toBeGreaterThan(layerOrder.floatingToken);
  await page.locator('#overviewDrawerCloseBtn').click();

  const finalBefore = await page.locator('#sheet-content').evaluate(node => node.lastElementChild?.getBoundingClientRect().bottom ?? 0);
  for (let index = 0; index < 3; index += 1) {
    await page.mouse.move(canvasBox.x + canvasBox.width * 0.58, canvasBox.y + canvasBox.height * 0.72);
    await page.mouse.down();
    await page.mouse.move(canvasBox.x + canvasBox.width * 0.58, canvasBox.y + canvasBox.height * 0.2, { steps: 8 });
    await page.mouse.up();
  }
  const finalAfter = await page.locator('#sheet-content').evaluate(node => node.lastElementChild?.getBoundingClientRect().bottom ?? 0);
  expect(finalAfter).toBeLessThan(finalBefore - 100);
});
