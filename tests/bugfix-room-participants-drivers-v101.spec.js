import { test, expect } from '@playwright/test';

async function openLocalRoom(page, viewport = { width: 390, height: 844 }) {
  await page.setViewportSize(viewport);
  await page.addInitScript(() => {
    Object.defineProperty(window, 'SANPO_FIREBASE_CONFIG', {
      configurable: true,
      get: () => ({}),
      set: () => {}
    });
  });
  await page.goto('/?room=BUGFIX101');
  await page.waitForFunction(() => window.SanpoCanonicalState?.get?.() && window.SanpoApplicantSync);
}

async function seedRoom(page, source) {
  await page.evaluate(source);
  await page.waitForTimeout(100);
}

test('brand link keeps the current room while clearing only transient view state', async ({ page }) => {
  await openLocalRoom(page);
  await seedRoom(page, () => {
    const room = window.SanpoCanonicalState.get();
    room.roomName = 'ヘッダー遷移保持テスト';
    document.getElementById('roomNameInput').value = room.roomName;
    const owner = window.SanpoCanonicalState.ensureParticipant(room.participants, { name: '保持参加者A' });
    room.allocations.car.groups = { car1: { id: 'car1', ownerId: owner, capacity: 3, order: 0 } };
    room.allocations.car.placements = { [owner]: { kind: 'member', driver: true, groupId: 'car1', order: 0 } };
    room.allocations.team.groups = { team1: { id: 'team1', ownerId: owner, capacity: 5, order: 0 } };
    room.allocations.team.placements = { [owner]: { kind: 'member', driver: true, groupId: 'team1', order: 0 } };
    window.SanpoCanonicalState.set(room);
    window.renderActiveCarPlanToDom();
    window.updateUI();
    window.save();
  });
  await page.goto('/?room=BUGFIX101&view=seisan');
  await page.waitForFunction(() => document.querySelector('cds-header-name'));

  const brand = page.locator('cds-header-name');
  await expect(brand).toHaveAttribute('href', /room=BUGFIX101/);
  await expect(brand).not.toHaveAttribute('href', /view=/);
  await brand.locator('a').click();
  await page.waitForURL(/room=BUGFIX101/);
  expect(new URL(page.url()).searchParams.get('room')).toBe('BUGFIX101');
  await expect.poll(() => page.evaluate(() => ({
    roomName: window.SanpoCanonicalState.get()?.roomName,
    participantCount: Object.keys(window.SanpoCanonicalState.get()?.participants || {}).length,
    carCount: Object.keys(window.SanpoCanonicalState.get()?.allocations?.car?.groups || {}).length,
    teamCount: Object.keys(window.SanpoCanonicalState.get()?.allocations?.team?.groups || {}).length
  }))).toEqual({ roomName: 'ヘッダー遷移保持テスト', participantCount: 1, carCount: 1, teamCount: 1 });
  const secondTab = await page.context().newPage();
  await secondTab.goto('/?room=BUGFIX101');
  await secondTab.waitForFunction(() => window.SanpoCanonicalState?.get?.());
  await expect.poll(() => secondTab.evaluate(() => ({
    roomName: window.SanpoCanonicalState.get()?.roomName,
    participantCount: Object.keys(window.SanpoCanonicalState.get()?.participants || {}).length,
    carCount: Object.keys(window.SanpoCanonicalState.get()?.allocations?.car?.groups || {}).length,
    teamCount: Object.keys(window.SanpoCanonicalState.get()?.allocations?.team?.groups || {}).length
  }))).toEqual({ roomName: 'ヘッダー遷移保持テスト', participantCount: 1, carCount: 1, teamCount: 1 });
  await secondTab.close();
});

test('unchecked manual participant stays removed after saving selection', async ({ page }) => {
  await openLocalRoom(page);
  await seedRoom(page, () => {
    const room = window.SanpoCanonicalState.get();
    room.meta.applicationSync = {
      kind: 'formApplicationSync', version: 2, title: '選択テスト', responseCount: 1,
      syncedAt: Date.now(), applicants: { a1: { name: '応募者A', grade: 1, canDrive: false, capacity: 0, updatedAt: 1 } }
    };
    window.SanpoCanonicalState.ensureParticipant(room.participants, { name: '手動参加者B', grade: 2 });
    window.SanpoCanonicalState.set(room);
    window.SanpoApplicantSync.render();
    window.save();
  });
  await page.locator('#tab-participants').click();
  await page.locator('#participantsEditToggle').click();
  const manual = page.locator('cds-checkbox[data-manual-participant-id]').first();
  await expect(manual).toHaveJSProperty('checked', true);
  await manual.locator('label').click();
  await page.locator('#formApplicantApplyBtn').click();
  await expect.poll(() => page.evaluate(() => Object.values(window.SanpoCanonicalState.get().participants || {}).some(p => p.name === '手動参加者B'))).toBe(false);
  await expect(page.locator('cds-checkbox[data-manual-participant-id]')).toHaveCount(0);
  await page.reload();
  await page.waitForFunction(() => window.SanpoCanonicalState?.get?.());
  await expect.poll(() => page.evaluate(() => Object.values(window.SanpoCanonicalState.get().participants || {}).some(p => p.name === '手動参加者B'))).toBe(false);
});

test('settlement driver rows follow car allocation driver tags', async ({ page }) => {
  await openLocalRoom(page);
  await seedRoom(page, () => {
    const room = window.SanpoCanonicalState.get();
    const owner = window.SanpoCanonicalState.ensureParticipant(room.participants, { name: '車所有者A' });
    const passenger = window.SanpoCanonicalState.ensureParticipant(room.participants, { name: '運転手B' });
    room.allocations.car.groups = { car1: { id: 'car1', ownerId: owner, capacity: 3, order: 0 } };
    room.allocations.car.placements = {
      [owner]: { kind: 'member', driver: false, groupId: 'car1', order: 0 },
      [passenger]: { kind: 'member', driver: true, groupId: 'car1', order: 1 }
    };
    window.SanpoCanonicalState.ensureAllParticipantsPlaced(room.allocations.car, room.participants);
    window.SanpoCanonicalState.set(room);
    window.renderActiveCarPlanToDom();
    window.updateUI();
  });
  await page.locator('#tab-seisan').click();
  await expect(page.locator('.seisan-car-summary-row')).toHaveCount(1);
  await expect(page.locator('.seisan-car-summary-name')).toHaveText('車所有者A車');
  await expect(page.locator('.seisan-car-driver-names')).toHaveText('運転手：運転手B');

  await page.locator('#tab-list').click();
  const passengerMenu = page.locator('#cars-container .seat-slot .member-card cds-overflow-menu.person-overflow-menu').first();
  await passengerMenu.click();
  await passengerMenu.locator('[data-person-action="driver"]').evaluate(node => node.click());
  await page.locator('#tab-seisan').click();
  await expect(page.locator('.seisan-car-summary-name')).toHaveText('車所有者A車');
  await expect(page.locator('.seisan-car-driver-names')).toHaveText('運転手：未設定');
});

test('each tagged driver in one car receives a collection offset', async ({ page }) => {
  await openLocalRoom(page);
  await seedRoom(page, () => {
    const room = window.SanpoCanonicalState.get();
    const owner = window.SanpoCanonicalState.ensureParticipant(room.participants, { name: '藤原 拓海' });
    const coDriver = window.SanpoCanonicalState.ensureParticipant(room.participants, { name: '茂木 なつき' });
    const passengerA = window.SanpoCanonicalState.ensureParticipant(room.participants, { name: '同乗者C' });
    const passengerB = window.SanpoCanonicalState.ensureParticipant(room.participants, { name: '同乗者D' });
    room.allocations.car.groups = { car1: { id: 'car1', ownerId: owner, capacity: 3, order: 0 } };
    room.allocations.car.placements = {
      [owner]: { kind: 'member', driver: true, groupId: 'car1', order: 0 },
      [coDriver]: { kind: 'member', driver: true, groupId: 'car1', order: 1 },
      [passengerA]: { kind: 'member', driver: false, groupId: 'car1', order: 2 },
      [passengerB]: { kind: 'member', driver: false, groupId: 'car1', order: 3 }
    };
    window.SanpoCanonicalState.ensureAllParticipantsPlaced(room.allocations.car, room.participants);
    window.SanpoCanonicalState.set(room);
    window.renderActiveCarPlanToDom();
    window.updateUI();
  });
  await page.locator('#tab-seisan').click();
  const { shareText, ...totals } = await page.evaluate(() => {
    const state = window.ensureSettlementState();
    state.driverCollectionOffset = true;
    state.driverCollectionFree = false;
    state.rounding = 100;
    state.cars = {
      ...state.cars,
      '藤原 拓海': { dist: '120', eco: '10', price: '100', rentalType: 'private', extras: [] }
    };
    const result = window.calculateSettlement(window.getRoomDataOnly(), state);
    window.renderSettlementView();
    return {
      perPerson: result.perPerson,
      payerCount: result.payerCount,
      offsetDriverCount: result.cars[0].offsetDriverCount,
      collectionOffsetPerDriver: result.cars[0].collectionOffsetPerDriver,
      collectionOffset: result.cars[0].collectionOffset,
      totalDriverCollectionOffset: result.totalDriverCollectionOffset,
      driverTotal: result.driverTotal,
      expectedCollected: result.expectedCollected,
      shareText: window.buildSettlementOverviewText({ title: '交代運転テスト', state, result })
    };
  });
  expect(totals).toEqual({
    perPerson: 300,
    payerCount: 2,
    offsetDriverCount: 2,
    collectionOffsetPerDriver: 300,
    collectionOffset: 600,
    totalDriverCollectionOffset: 600,
    driverTotal: 600,
    expectedCollected: 600
  });
  expect(shareText).toContain('運転手2人分の集金控除：¥600（1人あたり¥300）');
  await expect(page.locator('.seisan-car-summary-name')).toHaveText('藤原 拓海車');
  await expect(page.locator('.seisan-car-driver-names')).toHaveText('運転手：藤原 拓海、茂木 なつき（車単位で一括支払い）');
  await expect(page.locator('#seisan-car-list')).toContainText('集金控除');
  await expect(page.locator('#seisan-car-list')).toContainText('運転手2人');
  await expect(page.locator('#seisan-car-list')).toContainText('¥600');
});

test('mobile add-car action keeps its label visible', async ({ page }) => {
  await openLocalRoom(page);
  await seedRoom(page, () => {
    const room = window.SanpoCanonicalState.get();
    window.SanpoCanonicalState.ensureParticipant(room.participants, { name: '参加者A' });
    window.SanpoCanonicalState.set(room);
    window.renderActiveCarPlanToDom();
    window.updateUI();
  });
  const add = page.locator('#assignmentWorkspaceAddGroupBtn');
  await expect(add).toBeVisible();
  await expect(add).toContainText('車を追加');
  const labelDisplay = await add.locator('span:not([slot="icon"])').first().evaluate(node => getComputedStyle(node).display);
  expect(labelDisplay).not.toBe('none');
  await page.locator('#tab-team').click();
  await expect(add).toContainText('班を追加');
});
