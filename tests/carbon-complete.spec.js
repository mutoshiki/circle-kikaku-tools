import { test, expect } from '@playwright/test';

async function seed(page) {
  await page.goto('/');
  await page.waitForFunction(() => customElements.get('cds-button') && customElements.get('cds-modal') && customElements.get('cds-menu'));
  await page.evaluate(() => window.executeDebugMode?.());
  await page.waitForTimeout(250);
  await page.evaluate(() => document.querySelectorAll('.app-status-toast').forEach(node => node.classList.remove('visible')));
}

async function hostClick(page, selector, index = 0) {
  const locator = page.locator(selector).nth(index);
  await expect(locator).toBeAttached();
  const tagName = await locator.evaluate(node => node.tagName);
  if (tagName === 'CDS-HEADER-MENU-BUTTON') {
    const button = locator.locator('button');
    await expect(button).toBeVisible();
    await button.click();
  } else if (tagName === 'CDS-OVERFLOW-MENU') await locator.click();
  else await locator.evaluate(node => node.click());
  await page.waitForTimeout(80);
}

async function setHostValue(page, selector, value, index = -1) {
  const locator = page.locator(selector).nth(index);
  await locator.evaluate((node, next) => {
    node.value = next;
    node.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    node.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  }, value);
  await page.waitForTimeout(50);
}

async function expectNoDocumentOverflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBeTruthy();
}

for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
  test.describe(`${viewport.width}px Carbon shell`, () => {
    test.use({ viewport });

    test('primary destinations, theme, navigation and app drawer remain operable', async ({ page }) => {
      const errors = [];
      page.on('pageerror', error => errors.push(String(error)));
      await seed(page);
      const registered = await page.evaluate(() => [
        'cds-button', 'cds-icon-button', 'cds-content-switcher', 'cds-toast-notification',
        'cds-inline-notification', 'cds-tag', 'cds-text-input', 'cds-select',
        'cds-checkbox', 'cds-textarea', 'cds-number-input', 'cds-toggle', 'cds-modal',
        'cds-overflow-menu', 'cds-menu', 'cds-menu-item'
      ].every(name => customElements.get(name)));
      expect(registered).toBeTruthy();
      await expect(page.locator('#app-layout')).toBeVisible();
      await expect(page.locator('#view-toggle-bar')).toBeVisible();
      await expect(page.locator('#view-toggle-bar > cds-tab')).toHaveCount(4);
      await expect(page.locator('#tab-sheet')).toHaveCount(0);
      const menuColor = await page.locator('#overviewMenuBtn').evaluate(node => getComputedStyle(node).color);
      expect(menuColor).toBe('rgb(244, 244, 244)');
      for (const view of ['list', 'seisan']) {
        await page.evaluate(next => window.switchView(next), view);
        await expect(page.locator('#app-view-navigation')).toBeVisible();
        await expectNoDocumentOverflow(page);
      }
      const before = await page.evaluate(() => document.documentElement.dataset.theme);
      await hostClick(page, '#themeToggleBtn');
      expect(await page.evaluate(() => document.documentElement.dataset.theme)).not.toBe(before);
      await page.evaluate(() => {
        Object.defineProperty(navigator, 'clipboard', {
          configurable: true,
          value: { writeText: async value => { window.__copiedShareUrl = value; } }
        });
      });
      await hostClick(page, '#shareLinkBtn');
      await expect(page.locator('#appStatusToast')).toContainText('リンクをコピーしました');
      const copiedShareUrl = await page.evaluate(() => window.__copiedShareUrl || '');
      const copiedParams = new URL(copiedShareUrl).searchParams;
      expect(copiedParams.has('view')).toBe(false);
      expect(copiedParams.has('allocation')).toBe(false);
      await expect(page.locator('#share-links-modal')).toHaveCount(0);
      await hostClick(page, '#overviewMenuBtn');
      await expect.poll(() => page.locator('#overviewDrawer').evaluate(node => Boolean(node.expanded || node.hasAttribute('expanded')))).toBeTruthy();
      await expect(page.locator('#overviewDrawer cds-side-nav-link')).toHaveCount(4);
      await hostClick(page, '#overviewMenuBtn');
      await expect.poll(() => page.locator('#overviewDrawer').evaluate(node => Boolean(node.expanded || node.hasAttribute('expanded')))).toBeFalsy();
      expect(errors).toEqual([]);
    });
  });
}

test.describe('Allocation, menus and accessibility', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('role-tagged people stay put during random assignment and new groups can be created', async ({ page }) => {
    await seed(page);
    await page.evaluate(() => window.switchView('list'));

    const roleCard = page.locator('.seat-slot > .member-card').first();
    await expect(roleCard).toBeVisible();
    const rolePlacement = await roleCard.evaluate(card => {
      window.setPersonDriverRole(card, true);
      const box = card.closest('.car-box');
      return {
        id: card.dataset.participantId,
        groupId: box?.dataset.groupId,
        seatIndex: Array.from(box?.querySelectorAll('.seat-slot') || []).indexOf(card.parentElement)
      };
    });

    const candidate = page.locator('.seat-slot > .member-card').nth(1);
    await expect(candidate).toBeVisible();
    const groupCount = await page.locator('.car-box').count();
    await candidate.evaluate(card => {
      document.querySelector('#waiting-list')?.appendChild(card);
      window.updateUI();
      window.save();
    });

    await hostClick(page, '#assignmentWorkspaceAddGroupBtn');
    await expect(page.locator('#assignmentGroupCreateModal')).toHaveAttribute('open', '');
    await expect(page.locator('#assignmentGroupOwnerSelect > cds-select-item')).toHaveCount(1);
    await hostClick(page, '#assignmentGroupCreateConfirm');
    await expect(page.locator('#assignmentGroupCreateModal')).not.toHaveAttribute('open', '');
    await expect(page.locator('.car-box')).toHaveCount(groupCount + 1);

    await hostClick(page, '#shuffleAssignBtn');
    await hostClick(page, '#appConfirmModal [data-role="ok"]');
    await expect.poll(() => page.locator(`.member-card[data-participant-id="${rolePlacement.id}"]`).count()).toBe(1);
    expect(await page.locator(`.member-card[data-participant-id="${rolePlacement.id}"]`).evaluate(card => {
      const box = card.closest('.car-box');
      return {
        groupId: box?.dataset.groupId,
        seatIndex: Array.from(box?.querySelectorAll('.seat-slot') || []).indexOf(card.parentElement)
      };
    })).toEqual({ groupId: rolePlacement.groupId, seatIndex: rolePlacement.seatIndex });
  });

  test('car/team tabs, one random action and official person menus work in the viewport', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    await seed(page);
    await page.evaluate(() => window.switchView('list'));
    await expect(page.locator('#assignmentWorkspaceHeader')).toBeVisible();
    await expect(page.locator('#car-plan-switcher')).toHaveCount(0);
    await expect(page.locator('#tab-team')).toBeVisible();
    await expect(page.locator('#tab-sheet')).toHaveCount(0);
    await expect(page.locator('#assignmentTypeSwitcher')).toHaveCount(0);
    await expect(page.locator('#assignmentWorkspaceActions > #shuffleAssignBtn')).toHaveCount(1);
    await expect(page.locator('#shuffleAssignBtn')).toContainText('ランダムに割り当て');
    await expect(page.locator('cds-contained-list.car-box')).toHaveCount(3);
    const compactWorkspace = await page.locator('cds-contained-list.car-box').first().evaluate(card => {
      const row = card.querySelector('.driver-seat');
      const tag = card.querySelector('.driver-role-tag');
      const toolbarButtons = [...document.querySelectorAll('#assignmentWorkspaceActions cds-button')];
      return {
        rowHeight: Math.round(row?.getBoundingClientRect().height || 0),
        tagHeight: Math.round(tag?.getBoundingClientRect().height || 0),
        toolbarHeights: toolbarButtons.map(button => Math.round(button.getBoundingClientRect().height)),
        primaryActions: toolbarButtons.filter(button => button.getAttribute('kind') === 'primary').length
      };
    });
    expect(compactWorkspace.rowHeight).toBeGreaterThanOrEqual(48);
    expect(compactWorkspace.rowHeight).toBeLessThanOrEqual(64);
    expect(compactWorkspace.tagHeight).toBe(24);
    expect(compactWorkspace.toolbarHeights.every(height => height === 48)).toBeTruthy();
    expect(compactWorkspace.primaryActions).toBe(1);
    await expect(page.locator('#fillEmptySeatsBtn, #traySettingsBtn, #autoAssignPopover, #autoAssignMenu, #optFemale, #optMale, #optGrade, #clearAllBtn')).toHaveCount(0);
    await expect(page.locator('#bottom-tray')).toBeHidden();

    await hostClick(page, '#tab-team');
    expect(await page.evaluate(() => window.getActiveCarPlan().templateType)).toBe('team');
    await hostClick(page, '#tab-list');
    expect(await page.evaluate(() => window.getActiveCarPlan().templateType)).toBe('car');

    const firstPerson = page.locator('.member-card,.driver-seat').first();
    await expect(firstPerson).not.toHaveAttribute('data-gender', /.*/);
    await firstPerson.locator('.member-name-text,.driver-name-disp').click();
    await expect(page.locator('#commonEditModal')).not.toHaveAttribute('open', '');

    const personOverflow = firstPerson.locator('cds-overflow-menu.person-overflow-menu');
    await personOverflow.click();
    await expect(personOverflow).toHaveJSProperty('open', true);
    await expect.poll(() => personOverflow.evaluate(node => ({
      carbonOwnsOverlay: node.autoalign === true,
      popover: node.hasAttribute('popover'),
      placeholder: node.previousElementSibling?.classList.contains('person-menu-top-layer-placeholder') === true
    }))).toEqual({ carbonOwnsOverlay: true, popover: false, placeholder: false });
    await page.mouse.click(8, 96);
    await expect(personOverflow).toHaveJSProperty('open', false);
    expect(await firstPerson.evaluate(node => getComputedStyle(node).outlineStyle)).toBe('none');
    await personOverflow.click();
    await expect(personOverflow).toHaveJSProperty('open', true);
    const personMenu = personOverflow.locator(':scope > cds-menu.person-pop-menu');
    const personSurface = await personMenu.evaluate(node => {
      const panel = node.shadowRoot?.querySelector('ul');
      return {
        background: panel ? getComputedStyle(panel).backgroundColor : '',
        triggerColor: getComputedStyle(node.parentElement).color
      };
    });
    expect(personSurface).toEqual({ background: 'rgb(255, 255, 255)', triggerColor: 'rgb(22, 22, 22)' });
    await expect(personMenu.locator(':scope > cds-menu-item')).toHaveCount(5);
    await expect(personMenu.locator('[data-person-action="name"], [data-person-action="gender"]')).toHaveCount(0);
    await expect(page.locator('cds-tooltip[open]')).toHaveCount(0);
    const menuItemsInViewport = await personMenu.locator(':scope > cds-menu-item').evaluateAll(items => items.every(item => {
      const box = item.getBoundingClientRect();
      return box.left >= 7 && box.right <= innerWidth - 7 && box.top >= 7 && box.bottom <= innerHeight - 7;
    }));
    expect(menuItemsInViewport).toBeTruthy();
    const gradeMenuItem = personMenu.locator(':scope > cds-menu-item[label="学年"]');
    await gradeMenuItem.evaluate(node => node._openSubmenu?.());
    await gradeMenuItem.locator('cds-menu-item[data-choice-value="2"]').evaluate(node => node.click());
    await expect(page.locator('.member-card,.driver-seat').first()).toContainText('2年');
    await expect.poll(() => personOverflow.evaluate(node => ({
      open: node.open === true,
      popover: node.hasAttribute('popover'),
      placeholder: node.previousElementSibling?.classList.contains('person-menu-top-layer-placeholder') === true
    }))).toEqual({ open: false, popover: false, placeholder: false });

    const groupOverflow = page.locator('cds-overflow-menu.assignment-group-menu').first();
    await groupOverflow.click();
    await expect(groupOverflow).toHaveJSProperty('open', true);
    expect(await groupOverflow.evaluate(node => {
      const menu = node.querySelector('cds-menu');
      const panel = menu?.shadowRoot?.querySelector('ul');
      return {
        background: panel ? getComputedStyle(panel).backgroundColor : '',
        triggerColor: getComputedStyle(node).color
      };
    })).toEqual({ background: 'rgb(255, 255, 255)', triggerColor: 'rgb(22, 22, 22)' });
    await page.mouse.click(8, 96);
    await expect(groupOverflow).toHaveJSProperty('open', false);

    const capacityAction = page.locator('[data-action="edit-capacity"]').first();
    expect(await capacityAction.evaluate(node => {
      const button = node.shadowRoot?.querySelector('button');
      return button ? getComputedStyle(button).color : '';
    })).toBe('rgb(22, 22, 22)');
    await capacityAction.click();
    await expect(page.locator('#commonEditModal')).toHaveAttribute('open', '');
    await page.locator('#editModalInput').evaluate((node, next) => {
      const control = node.shadowRoot?.querySelector('input');
      if (!(control instanceof HTMLInputElement)) throw new Error('Carbon number input not found');
      control.value = next;
      control.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      control.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    }, '4');
    await expect(page.locator('#editModalInput')).toHaveJSProperty('value', '4');
    await page.locator('#saveEditBtn').click();
    await expect(page.locator('#commonEditModal')).not.toHaveAttribute('open', '');
    await expect(page.locator('.car-box').first()).toHaveAttribute('data-capacity', '4');
    expect(await page.evaluate(() => Number(window.getActiveCarPlan().cars[0].capacity))).toBe(4);

    await hostClick(page, '#shuffleAssignBtn');
    await expect(page.locator('#appConfirmModal')).toHaveAttribute('open', '');
    await hostClick(page, '#appConfirmModal [data-role="ok"]');
    await expect(page.locator('#appConfirmModal')).not.toHaveAttribute('open', '');
    expect(await page.evaluate(() => window.getActiveCarPlan().cars.every(car => car.members.length <= car.capacity))).toBeTruthy();

    const quality = await page.evaluate(() => {
      const visible = element => {
        const box = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return box.width > 0 && box.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
      };
      const controls = [...document.querySelectorAll('cds-button,cds-icon-button,cds-overflow-menu,cds-checkbox,cds-toggle,a,[role="button"]')].filter(visible);
      return {
        unnamed: controls.filter(element => !(element.getAttribute('aria-label') || element.getAttribute('label') || element.getAttribute('label-text') || element.textContent.trim() || element.title)).length,
        small: controls.filter(element => {
          const box = element.getBoundingClientRect();
          return (box.width < 44 || box.height < 44) && !element.matches('.capacity-edit-pill, .car-return-btn');
        }).length
      };
    });
    expect(quality).toEqual({ unnamed: 0, small: 0 });
    expect(errors).toEqual([]);
  });
});

test.describe('Carbon modal and participant workflows', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('participant spreadsheet import creates participants', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => customElements.get('cds-textarea'));
    await page.evaluate(() => window.openBatchModal());
    await expect(page.locator('#batchImportModal')).toHaveAttribute('open', '');
    await expect(page.locator('#batchImportModalTitle')).toBeFocused();
    await setHostValue(page, '#googleFormPasteArea', '名前\t学籍番号もしくは学年\t車出し\n山田 太郎\t24T1234A\tする\n佐藤 花子\t2年\tしない');
    await hostClick(page, '#applyGoogleFormPasteBtn');
    expect(await page.locator('#batchDrivers').evaluate(node => node.value)).toContain('山田 太郎');
    await hostClick(page, '#executeBatchBtn');
    await expect(page.locator('#batchImportModal')).not.toHaveAttribute('open', '');
  });

  test('major and dynamic modals avoid button autofocus and close correctly', async ({ page }) => {
    await seed(page);
    const cases = [
      ['window.modals.userGuide.show()', 'userGuideModal'],
      ['showHistory()', 'historyModal'],
      ['openPlanningCheck()', 'planningCheckModal'],
      ['openDebugModal()', 'debugModal'],
      ['openSettlementSettings()', 'settlementSettingsModal'],
      ['openRouteDistanceHelper()', 'routeDistanceModal'],
      ['openBatchModal()', 'batchImportModal']
    ];
    for (const [command, id] of cases) {
      await page.evaluate(command);
      await expect(page.locator(`#${id}`)).toHaveAttribute('open', '');
      expect(await page.evaluate(() => document.activeElement?.tagName)).toBe('CDS-MODAL-HEADING');
      await page.locator(`#${id} cds-modal-close-button`).evaluate(node => node.click());
      await expect(page.locator(`#${id}`)).not.toHaveAttribute('open', '');
    }
    await page.evaluate(() => { window.__confirmPromise = window.appConfirm('確認', { title: '確認' }); });
    await hostClick(page, '#appConfirmModal [data-role="cancel"]');
    await expect(page.locator('#appConfirmModal')).not.toHaveAttribute('open', '');
    await page.evaluate(() => { window.__alertPromise = window.appAlert('通知', { title: '通知' }); });
    await hostClick(page, '#appAlertModal [data-role="ok"]');
    await expect(page.locator('#appAlertModal')).not.toHaveAttribute('open', '');
    await hostClick(page, '#editLockBtn');
    await expect(page.locator('#passphrase-panel cds-text-input')).toHaveCount(2);
    await expect(page.locator('#passphrase-panel cds-checkbox')).toHaveCount(2);
    await hostClick(page, '#passphrase-panel cds-modal-close-button');
    await expect(page.locator('#passphrase-panel')).toHaveCount(0);
  });
});

test.describe('First-run rendering and submit regression', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('Carbon toast feedback stays concise without occupying the product-title slot', async ({ page }) => {
    await page.goto(`/?room=SYNC-STATUS-${Date.now()}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.showMiniToast === 'function' && customElements.get('cds-toast-notification'));
    await page.evaluate(() => window.showMiniToast('リンクをコピーしました', 'success'));
    const toast = page.locator('#appStatusToast');
    await expect(toast).toBeVisible();
    await expect(toast.locator('[slot="title"]')).toHaveText('完了しました');
    await expect(toast.locator('[slot="subtitle"]')).toHaveText('リンクをコピーしました');
    await expect(toast.locator('[slot="title"]')).toHaveCount(1);
    expect((await toast.getAttribute('title')) || '').toBe('');
    const placement = await page.evaluate(() => {
      const region = document.querySelector('#appNotificationRegion')?.getBoundingClientRect();
      const title = document.querySelector('#projectTitleRegion')?.getBoundingClientRect();
      return { region, title, width: innerWidth };
    });
    expect(placement.region.right).toBeLessThanOrEqual(placement.width);
    expect(placement.region.top).toBeGreaterThanOrEqual(0);
    if (placement.title) expect(placement.region.left).toBeGreaterThan(placement.title.left);
    await page.waitForTimeout(2600);
    await expect(page.locator('#appStatusToast')).toHaveCount(0);
  });

  test('first meaningful list and settlement screens use the same entry choices', async ({ page }) => {
    const room = `FIRST-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await page.goto(`/?room=${room}`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toHaveClass(/view-mode-list/);
    await expect(page.locator('#list-empty-hint')).toContainText('参加者');

    const cases = [
      ['list', '#list-empty-hint .app-entry-choice'],
      ['seisan', '#seisan-empty-state .app-entry-choice']
    ];
    for (const [view, selector] of cases) {
      await page.evaluate(next => window.switchView(next), view);
      const empty = page.locator(selector);
      await expect(empty).toBeVisible();
      await expect(empty.locator('cds-button')).toHaveCount(2);
      await expect(empty).toContainText('参加者');
      await expect(empty).toContainText('人数だけで精算');
      await expect(empty.locator('[data-action="open-participants"]')).toHaveCount(1);
    }
  });

  test('participant and settlement settings submit buttons close their Carbon modals', async ({ page }) => {
    const room = `SUBMIT-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await page.goto(`/?room=${room}`);
    await page.waitForFunction(() => customElements.get('cds-modal') && window.SanpoApplicantSync);
    await page.evaluate(() => window.switchView('list'));
    await hostClick(page, '#list-empty-hint [data-action="open-participants"]');
    await expect(page.locator('#participants-view-area')).toBeVisible();
    await expect(page.locator('#participantManualAddBtn')).toBeVisible();
    await hostClick(page, '#participantManualAddBtn');
    await expect(page.locator('#batchImportModal')).toHaveAttribute('open', '');
    await setHostValue(page, '#batchMembers', '山田 太郎');
    await hostClick(page, '#executeBatchBtn');
    await expect(page.locator('#batchImportModal')).not.toHaveAttribute('open', '');
    await page.evaluate(() => window.switchView('list'));
    await expect(page.locator('.member-card')).toHaveCount(1);
    await page.evaluate(() => { window.switchView('seisan'); window.openStandaloneSettlementSettings(); });
    await expect(page.locator('#settlementSettingsModal')).toHaveAttribute('open', '');
    await setHostValue(page, '#seisanStandaloneDriverCount', '1');
    await setHostValue(page, '#seisanStandaloneMemberCount', '3');
    await hostClick(page, '#saveSettlementSettingsBtn');
    await expect(page.locator('#settlementSettingsModal')).not.toHaveAttribute('open', '');
  });

  test('sample data is restored, rendered, persisted and closes the sample modal', async ({ page }) => {
    const room = `SAMPLE-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await page.goto(`/?room=${room}`);
    await page.waitForFunction(() => customElements.get('cds-modal') && typeof window.executeDebugMode === 'function');
    await page.evaluate(() => window.openDebugModal());
    await expect(page.locator('#debugModal')).toHaveAttribute('open', '');
    await hostClick(page, '#executeDebugBtn');
    await expect(page.locator('#debugModal')).not.toHaveAttribute('open', '');
    await expect(page.locator('.car-box')).toHaveCount(3);
    expect(await page.evaluate(() => {
      const data = window.getData();
      const saved = JSON.parse(localStorage.getItem(`sampokai_v10_split_${new URLSearchParams(location.search).get('room')}`) || '{}');
      return {
        error: window.__sampleDataLastError || '',
        roomName: data.roomName,
        allocationTypes: Object.keys(data.allocations || {}).sort(),
        participants: Object.keys(data.participants || {}).length,
        savedParticipants: Object.keys(saved.participants || {}).length,
        settlementCars: Object.keys(window.SanpoCanonicalState.settlementToUi(data.settlement || {}, data.participants || {}).cars || {}).length
      };
    })).toEqual({
      error: '',
      roomName: '秋名山登山企画',
      allocationTypes: ['car', 'team'],
      participants: 13,
      savedParticipants: 13,
      settlementCars: 3
    });
    await page.reload();
    await page.waitForFunction(() => typeof window.getData === 'function' && Object.keys(window.getData({ skipDomSync: true }).participants || {}).length === 13);
    expect(await page.evaluate(() => Object.keys(window.getData({ skipDomSync: true }).participants || {}).length)).toBe(13);
  });
});

test.describe('Settlement and route workflows', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('settings, vehicle cost validation and route helper remain functional', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    await seed(page);
    await page.evaluate(() => window.switchView('seisan'));
    await hostClick(page, '[data-action="open-settlement-settings"]');
    await expect(page.locator('#settlementSettingsModal cds-content-switcher')).toHaveCount(2);
    await hostClick(page, '#settlementSettingsModal [data-action="save-settlement-settings"]');
    await hostClick(page, '[data-action="open-settlement-car-edit"]');
    await hostClick(page, '#settlementCarEditModal [data-action="open-settlement-gas-settings"]');
    const gasPanel = page.locator('#settlementGasEditPanel');
    await expect(gasPanel).toBeVisible();
    const placeholders = await Promise.all(['dist', 'eco', 'price'].map(field => gasPanel.locator(`[data-field="${field}"]`).getAttribute('placeholder')));
    expect(placeholders).toEqual(['例：186', '例：18', '例：158']);
    const rental = gasPanel.locator('[data-field="rentalType"]');
    await expect(rental).toHaveJSProperty('value', 'private');
    await rental.locator('cds-radio-button[value="times"]').click();
    await expect(page.locator('#settlementGasEditPanel [data-field="rentalType"]')).toHaveJSProperty('value', 'times');
    await expect(page.locator('#settlementGasEditPanel [data-field="eco"]')).toHaveCount(0);
    await expect(page.locator('#settlementGasEditPanel [data-field="price"]')).toHaveCount(0);
    await page.locator('#settlementGasEditPanel [data-field="rentalType"] cds-radio-button[value="private"]').click();
    await expect(page.locator('#settlementGasEditPanel [data-field="rentalType"]')).toHaveJSProperty('value', 'private');
    await page.locator('body > #settlementGasEditModal cds-modal-footer-button[data-modal-close]').evaluate(node => node.click());
    await expect(page.locator('body > #settlementGasEditModal')).toHaveCount(0);
    await expect(page.locator('#settlementCarEditModal')).toHaveJSProperty('open', true);
    await hostClick(page, '#settlementCarEditModal [data-action="add-settlement-extra"]');
    await setHostValue(page, '#settlementCarEditModal [data-extra-field="name"]', '高速代');
    await setHostValue(page, '#settlementCarEditModal [data-extra-field="amount"]', '1234');
    await expect(page.locator('#settlementCarEditModal [data-extra-field][invalid]')).toHaveCount(0);
    await hostClick(page, '#settlementCarEditModal [data-action="save-settlement-car-edit"]');
    await expect(page.locator('#settlementCarEditModal')).not.toHaveAttribute('open', '');
    await hostClick(page, '[data-action="open-settlement-car-edit"]');
    expect(await page.locator('#settlementCarEditModal [data-extra-field="amount"]').last().evaluate(node => node.value)).toBe('1234');
    const dimensions = await page.locator('#settlementCarEditModal .seisan-extra-row').last().evaluate(row => {
      const amount = row.querySelector('[data-extra-field="amount"]').getBoundingClientRect();
      const type = row.querySelector('[data-extra-field="type"]').getBoundingClientRect();
      return { amount: amount.width, type: type.width, row: row.getBoundingClientRect().width };
    });
    expect(dimensions.amount).toBeGreaterThanOrEqual(88);
    expect(dimensions.type).toBeGreaterThanOrEqual(44);
    expect(dimensions.amount).toBeLessThan(dimensions.row);
    expect(dimensions.type).toBeLessThan(dimensions.row);
    await hostClick(page, '#settlementCarEditModal [data-action="open-settlement-gas-settings"]');
    await hostClick(page, '#settlementGasEditPanel [data-action="open-route-helper-shortcut"]');
    await expect(page.locator('#routeDistanceModal')).toHaveAttribute('open', '');
    const appendRouteStop = page.locator('#routeStopList .route-stop-row--append [data-action="open-route-place-search"]');
    await expect(appendRouteStop).toBeAttached();
    await appendRouteStop.click();
    await expect(page.locator('#routePlaceSearchSurface')).not.toHaveAttribute('hidden', '');
    await hostClick(page, '#routePlaceSearchBackBtn');
    await expect(page.locator('#routePlaceSearchSurface')).toHaveAttribute('hidden', '');
    await hostClick(page, '#routeDistanceModal cds-modal-close-button');
    await expect(page.locator('#settlementCarEditModal')).toHaveJSProperty('open', true);
    await expect(page.locator('#seisan-share-preview')).toHaveCount(0);
    await expect(page.locator('[data-action="copy-settlement-text"]')).toHaveCount(0);
    await expectNoDocumentOverflow(page);
    expect(errors).toEqual([]);
  });
});
