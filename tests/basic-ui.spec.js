// Basic UI smoke tests for Playwright.
// Run after `npm i -D @playwright/test` and `npx playwright install`.
// Then: `npx playwright test tests/basic-ui.spec.js`

const { test, expect } = require('@playwright/test');

test('main controls open and basic views render', async ({ page }) => {
  await page.goto('./index.html');

  await expect(page.locator('#tab-list')).toBeVisible();
  await expect(page.locator('#tab-sheet')).toBeVisible();
  await expect(page.locator('#tab-seisan')).toBeVisible();

  await page.locator('.header-more .dropdown-toggle').click();
  await expect(page.locator('#sampleDataBtn')).toBeVisible();

  await page.locator('#sampleDataBtn').click();
  await expect(page.locator('#debugModal')).toBeVisible();
  await page.locator('#executeDebugBtn').click();

  await page.locator('#tab-list').click();
  await expect(page.locator('.car-box').first()).toBeVisible();
  await expect(page.locator('#waiting-list')).toBeVisible();

  await page.locator('#tab-sheet').click();
  await expect(page.locator('#sheet-view-area')).toBeVisible();
  await expect(page.locator('#sheet-title-bar')).toBeVisible();

  await page.locator('#tab-seisan').click();
  await expect(page.locator('#seisan-view-area')).toBeVisible();
});

test('drag a waiting member into the first seat', async ({ page }) => {
  await page.goto('./index.html');

  await page.locator('.header-more .dropdown-toggle').click();
  await page.locator('#sampleDataBtn').click();
  await page.locator('#executeDebugBtn').click();

  await page.locator('#tab-list').click();

  const source = page.locator('#waiting-list .member-card').first();
  const target = page.locator('.seat-slot').first();

  await expect(source).toBeVisible();
  await expect(target).toBeVisible();

  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();

  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(120);
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 16 });
  await page.mouse.up();

  await expect(page.locator('.seat-slot .member-card')).toHaveCount(1);
});
