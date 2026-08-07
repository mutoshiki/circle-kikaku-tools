import { test, expect } from '@playwright/test';

async function seed(page) {
  await page.goto('/');
  await page.waitForFunction(() => customElements.get('cds-menu') && customElements.get('cds-overflow-menu'));
  await page.evaluate(() => window.executeDebugMode?.());
  await page.waitForTimeout(250);
  await page.evaluate(() => window.switchView('list'));
}

async function touchTap(page, locator, pointerId) {
  await locator.evaluate((element, id) => {
    const rect = element.getBoundingClientRect();
    const clientX = rect.left + Math.min(rect.width / 2, 24);
    const clientY = rect.top + Math.min(rect.height / 2, 24);
    element.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true,
      composed: true,
      cancelable: true,
      pointerId: id,
      pointerType: 'touch',
      isPrimary: true,
      clientX,
      clientY,
      button: 0,
      buttons: 1
    }));
    element.dispatchEvent(new PointerEvent('pointerup', {
      bubbles: true,
      composed: true,
      cancelable: true,
      pointerId: id,
      pointerType: 'touch',
      isPrimary: true,
      clientX,
      clientY,
      button: 0,
      buttons: 0
    }));
  }, pointerId);
  await page.waitForTimeout(180);
}

test.describe('Mobile person menu regression', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('touch can open a submenu, select a value and see the scroll cue', async ({ page }) => {
    await seed(page);
    const trigger = page.locator('cds-overflow-menu.person-overflow-menu').first();
    await trigger.scrollIntoViewIfNeeded();
    await touchTap(page, trigger, 101);
    await expect(trigger).toHaveJSProperty('open', true);

    await page.waitForTimeout(250);
    await trigger.evaluate(element => {
      const surface = element.querySelector(':scope > cds-menu.person-pop-menu')?.shadowRoot?.querySelector('.cds--menu');
      if (!surface) throw new Error('Person menu surface was not found');
      surface.style.height = '160px';
      surface.style.maxHeight = '160px';
      surface.style.overflowY = 'auto';
      window.dispatchEvent(new Event('resize'));
    });
    await expect(page.locator('.person-menu-scroll-hint')).toBeVisible();
    await expect(page.locator('.person-menu-scroll-hint')).toContainText('下に項目があります');

    const gradeItem = trigger.locator('cds-menu-item[label="学年"]');
    await touchTap(page, gradeItem, 102);
    expect(await gradeItem.evaluate(item => item.open === true || item.hasAttribute('open'))).toBeTruthy();

    const secondGrade = gradeItem.locator('cds-menu-item[data-choice-value="2"]');
    await touchTap(page, secondGrade, 103);
    await expect(page.locator('.member-card,.driver-seat').first()).toContainText('2年');
  });
});
