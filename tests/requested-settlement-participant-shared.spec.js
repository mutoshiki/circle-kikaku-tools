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

test('mobile settlement settings stay centered, contained and show a red count error', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await gotoSeededApp(page, 'REQUESTED-SETTINGS-MOBILE');
  await page.locator('#tab-seisan').click();
  await page.locator('[data-action="open-settlement-settings"]').click();
  await expect(page.locator('#settlementSettingsModal')).toBeVisible();

  const modalGeometry = await page.locator('#settlementSettingsModal .modal-dialog').evaluate(node => {
    const rect = node.getBoundingClientRect();
    return {
      left: rect.left,
      right: rect.right,
      center: rect.left + rect.width / 2,
      viewportCenter: window.innerWidth / 2,
      overflow: node.scrollWidth > node.clientWidth
    };
  });
  expect(Math.abs(modalGeometry.center - modalGeometry.viewportCenter)).toBeLessThanOrEqual(1);
  expect(modalGeometry.left).toBeGreaterThanOrEqual(0);
  expect(modalGeometry.right).toBeLessThanOrEqual(360);
  expect(modalGeometry.overflow).toBeFalsy();

  const rounding = await page.locator('.seisan-rounding-options').evaluate(node => {
    const parent = node.getBoundingClientRect();
    const buttons = [...node.children].map(child => child.getBoundingClientRect());
    return {
      overflow: node.scrollWidth > node.clientWidth,
      contained: buttons.every(rect => rect.left >= parent.left - 0.5 && rect.right <= parent.right + 0.5),
      distinctRows: new Set(buttons.map(rect => Math.round(rect.top))).size
    };
  });
  expect(rounding.overflow).toBeFalsy();
  expect(rounding.contained).toBeTruthy();
  expect(rounding.distinctRows).toBe(2);

  await page.locator('#seisanStandaloneEnabled').check();
  const counts = await page.locator('#seisanStandaloneFields .seisan-field').evaluateAll(nodes => nodes.map(node => {
    const rect = node.getBoundingClientRect();
    return { top: rect.top, left: rect.left, right: rect.right, width: rect.width };
  }));
  expect(counts).toHaveLength(2);
  expect(Math.abs(counts[0].top - counts[1].top)).toBeLessThanOrEqual(1);
  expect(counts[0].right).toBeLessThanOrEqual(counts[1].left);
  expect(counts.every(item => item.width > 0)).toBeTruthy();

  await page.locator('[data-action="save-settlement-settings"]').click();
  const error = page.locator('#seisanStandaloneError');
  await expect(error).toBeVisible();
  const errorStyle = await error.evaluate(node => {
    const probe = document.createElement('span');
    probe.style.color = 'var(--semantic-danger)';
    document.body.appendChild(probe);
    const expected = getComputedStyle(probe).color;
    probe.remove();
    const actual = getComputedStyle(node);
    return { color: actual.color, expected, weight: Number(actual.fontWeight) };
  });
  expect(errorStyle.color).toBe(errorStyle.expected);
  expect(errorStyle.weight).toBeGreaterThanOrEqual(600);
});

test('participant registration keeps one horizontally scrollable auto-detection table and concise labels', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoSeededApp(page, 'REQUESTED-PARTICIPANT-TABLE');
  await page.evaluate(() => window.switchView('list'));
  await page.locator('#batchOpenBtn').click();
  await expect(page.locator('#batchImportModal')).toBeVisible();

  const labels = await page.locator('#batchImportModal .batch-import-textarea').evaluateAll(nodes => nodes.map(node => ({
    id: node.id,
    label: node.closest('.col-12').querySelector('label')?.textContent.trim() || ''
  })));
  expect(labels).toEqual([
    { id: 'batchMembers', label: '同乗者（改行区切り）' },
    { id: 'batchDrivers', label: '車出し' },
    { id: 'batchGrade1', label: '1年生' },
    { id: 'batchGrade2', label: '2年生' },
    { id: 'batchGrade3', label: '3年生' },
    { id: 'batchGrade4', label: '4年生' }
  ]);

  await page.locator('.batch-import-auto-details > summary').click();
  const table = await page.locator('.batch-auto-table-wrap').evaluate(node => {
    const tableNode = node.querySelector('table');
    const row = tableNode.querySelector('tbody tr');
    return {
      wrapperOverflowX: getComputedStyle(node).overflowX,
      scrollable: node.scrollWidth > node.clientWidth,
      tableDisplay: getComputedStyle(tableNode).display,
      rowDisplay: getComputedStyle(row).display,
      tableWidth: tableNode.getBoundingClientRect().width,
      viewportWidth: window.innerWidth
    };
  });
  expect(['auto', 'scroll']).toContain(table.wrapperOverflowX);
  expect(table.scrollable).toBeTruthy();
  expect(table.tableDisplay).toBe('table');
  expect(table.rowDisplay).toBe('table-row');
  expect(table.tableWidth).toBeGreaterThan(table.viewportWidth);
});

test('shared view places timetable left of car allocation and omits nonexistent seat rows', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoSeededApp(page, 'REQUESTED-SHARED-LAYOUT');
  await page.evaluate(() => window.switchView('sheet'));
  await page.waitForTimeout(250);

  const primary = await page.locator('.sheet-primary-row').evaluate(node => {
    const timetable = node.children[0];
    const allocationStack = node.children[1];
    const sections = [...allocationStack.querySelectorAll(':scope > .sheet-plan-section')];
    const timetableRect = timetable.getBoundingClientRect();
    const carRect = sections[0]?.getBoundingClientRect();
    const teamRect = sections[1]?.getBoundingClientRect();
    return {
      firstIsTimetable: timetable.classList.contains('sheet-timetable-section'),
      secondIsAllocationStack: allocationStack.classList.contains('sheet-allocation-stack'),
      headings: sections.map(section => section.querySelector('.sheet-plan-heading')?.textContent.trim()),
      timeRight: timetableRect.right,
      carLeft: carRect?.left || 0,
      carBottom: carRect?.bottom || 0,
      teamTop: teamRect?.top || 0,
      carLeftAlignedWithTeam: carRect && teamRect ? Math.abs(carRect.left - teamRect.left) <= 1 : false
    };
  });
  expect(primary.firstIsTimetable).toBeTruthy();
  expect(primary.secondIsAllocationStack).toBeTruthy();
  expect(primary.headings.slice(0, 2)).toEqual(['車割', '班割']);
  expect(primary.timeRight).toBeLessThanOrEqual(primary.carLeft);
  expect(primary.teamTop).toBeGreaterThanOrEqual(primary.carBottom);
  expect(primary.carLeftAlignedWithTeam).toBeTruthy();

  const seats = await page.locator('.sheet-plan-section:not(.sheet-timetable-section) .sheet-car-col').evaluateAll(columns => columns.map(column => {
    const badge = column.querySelector('.sheet-capacity-badge')?.textContent.trim() || '0/0';
    const capacity = Number(badge.split('/')[1] || 0);
    return {
      capacity,
      seatRows: column.querySelectorAll('.sheet-seat-row:not(.sheet-label-row)').length,
      disabledRows: column.querySelectorAll('.sheet-seat-disabled').length,
      emptyRows: column.querySelectorAll('.sheet-seat-row.empty').length
    };
  }));
  expect(seats.length).toBeGreaterThanOrEqual(1);
  expect(seats.every(item => item.seatRows === item.capacity)).toBeTruthy();
  expect(seats.every(item => item.disabledRows === 0)).toBeTruthy();
  expect(seats.some(item => item.emptyRows > 0)).toBeTruthy();
});

test('driver cards use two columns, readable wrapped rows and signed negative extras', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoSeededApp(page, 'REQUESTED-DRIVER-CARDS');
  await page.locator('#tab-seisan').click();

  const grid = await page.locator('#seisan-car-list').evaluate(node => ({
    cards: node.children.length,
    className: node.className,
    columns: getComputedStyle(node).gridTemplateColumns.split(' ').filter(Boolean).length
  }));
  expect(grid.cards).toBeGreaterThanOrEqual(3);
  expect(grid.className).toContain('is-two-column');
  expect(grid.columns).toBe(2);

  const firstCard = page.locator('#seisan-car-list .seisan-car-summary-row').first();
  const cardContract = await firstCard.evaluate(node => {
    const firstLine = node.querySelector('.seisan-cost-preview-line');
    const sign = firstLine?.querySelector('.seisan-amount-sign');
    const itemName = firstLine?.querySelector('.seisan-cost-line > span:first-child');
    const costLine = firstLine?.querySelector('.seisan-cost-line');
    const tag = costLine?.querySelector('.seisan-cost-type-badge, .seisan-payment-tag');
    const amount = costLine?.querySelector('.seisan-cost-line-amount');
    const total = node.querySelector('.seisan-cost-total-row');
    const totalStyle = getComputedStyle(total);
    const nameRect = itemName?.getBoundingClientRect();
    const tagRect = tag?.getBoundingClientRect();
    const amountRect = amount?.getBoundingClientRect();
    const lineRect = costLine?.getBoundingClientRect();
    return {
      firstSignVisibility: sign ? getComputedStyle(sign).visibility : '',
      firstSignText: sign?.textContent || '',
      nameWhiteSpace: itemName ? getComputedStyle(itemName).whiteSpace : '',
      nameOverflowWrap: itemName ? getComputedStyle(itemName).overflowWrap : '',
      dividerWidth: parseFloat(totalStyle.borderTopWidth),
      dividerColor: totalStyle.borderTopColor,
      labelSize: parseFloat(getComputedStyle(itemName).fontSize),
      detailSize: parseFloat(getComputedStyle(amount).fontSize),
      sameGridRow: [itemName, tag, amount].every(element => getComputedStyle(element).gridRowStart === 'auto'),
      visualOrder: !!(nameRect && tagRect && amountRect && nameRect.left <= tagRect.left && tagRect.right <= amountRect.left),
      amountRightAligned: !!(amountRect && lineRect && Math.abs(amountRect.right - lineRect.right) <= 1.5)
    };
  });
  expect(cardContract.firstSignText).toBe('＋');
  expect(cardContract.firstSignVisibility).toBe('hidden');
  expect(cardContract.nameWhiteSpace).toBe('normal');
  expect(['anywhere', 'break-word']).toContain(cardContract.nameOverflowWrap);
  expect(cardContract.dividerWidth).toBeGreaterThanOrEqual(2);
  expect(cardContract.detailSize).toBeCloseTo(cardContract.labelSize, 1);
  expect(cardContract.sameGridRow).toBeTruthy();
  expect(cardContract.visualOrder).toBeTruthy();
  expect(cardContract.amountRightAligned).toBeTruthy();

  await firstCard.locator('[data-action="open-settlement-car-edit"]').click();
  const options = await page.locator('#settlementCarEditModal .seisan-extra-type').first().locator('option').allTextContents();
  expect(options).toEqual(['割勘', '部費', '割勘（マイナス）', '部費（マイナス）']);

  const negativeResult = await page.evaluate(() => {
    const data = {
      cars: [{ name: '試験', capacity: 2, members: [{ name: '参加者' }] }],
      waiting: []
    };
    const state = {
      rounding: '100', organizerFree: false, organizerName: '', driverCollectionOffset: false,
      driverCollectionFree: false, driverReward: '0', paid: {}, driverPaid: {},
      cars: {
        試験: {
          dist: '', eco: '', price: '', rentalType: 'private',
          extras: [
            { name: '割引', amount: '300', type: 'split-minus' },
            { name: '補助返却', amount: '200', type: 'club-minus' }
          ]
        }
      }
    };
    const result = window.calculateSettlement(data, state);
    return {
      totalSplit: result.totalSplit,
      totalClub: result.totalClub,
      extraTypes: result.cars[0].extras.map(extra => extra.type),
      extraAmounts: result.cars[0].extras.map(extra => extra.amountValue)
    };
  });
  expect(negativeResult.totalSplit).toBe(-300);
  expect(negativeResult.totalClub).toBe(-200);
  expect(negativeResult.extraTypes).toEqual(['split-minus', 'club-minus']);
  expect(negativeResult.extraAmounts).toEqual([-300, -200]);
});
