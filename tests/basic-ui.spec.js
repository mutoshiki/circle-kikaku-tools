// Critical UI smoke tests for Playwright.
// Run after `npm i -D @playwright/test` and `npx playwright install chromium`.
// Then: `npx playwright test tests/basic-ui.spec.js`

const { test, expect } = require('@playwright/test');

async function installOfflineBootstrapFallback(page) {
  await page.addInitScript(() => {
    function showModal(el) {
      if (!el) return;
      el.style.display = 'block';
      el.removeAttribute('aria-hidden');
      el.setAttribute('aria-modal', 'true');
      el.classList.add('show');
      document.body.classList.add('modal-open');
      if (!document.querySelector('.modal-backdrop')) {
        const backdrop = document.createElement('div');
        backdrop.className = 'modal-backdrop fade show';
        document.body.appendChild(backdrop);
      }
    }
    function hideModal(el) {
      if (!el) return;
      el.classList.remove('show');
      el.style.display = 'none';
      el.setAttribute('aria-hidden', 'true');
      el.removeAttribute('aria-modal');
      document.querySelectorAll('.modal-backdrop').forEach(node => node.remove());
      document.body.classList.remove('modal-open');
    }
    class ModalFallback {
      constructor(el) { this.el = el; }
      show() { showModal(this.el); }
      hide() { hideModal(this.el); }
    }
    window.bootstrap = window.bootstrap || {};
    window.bootstrap.Modal = window.bootstrap.Modal || ModalFallback;
    document.addEventListener('click', event => {
      const dropdownToggle = event.target.closest?.('[data-bs-toggle="dropdown"]');
      if (dropdownToggle) {
        const wrap = dropdownToggle.closest('.dropdown');
        const menu = wrap?.querySelector('.dropdown-menu');
        if (menu) menu.classList.toggle('show');
      }
      const dismiss = event.target.closest?.('[data-bs-dismiss="modal"]');
      if (dismiss) hideModal(dismiss.closest('.modal'));
    }, true);
  });
}

async function gotoApp(page) {
  await installOfflineBootstrapFallback(page);
  await page.goto('./index.html');
}

async function loadSampleData(page) {
  await page.locator('.header-more .dropdown-toggle').click();
  await page.locator('#sampleDataBtn').click();
  await expect(page.locator('#debugModal')).toBeVisible();
  await page.locator('#executeDebugBtn').click();
  await expect(page.locator('#debugModal')).toBeHidden();
}

async function closeModal(page, modalId) {
  const modal = page.locator(modalId);
  await expect(modal).toBeVisible();
  await modal.locator('.btn-close, [data-bs-dismiss="modal"]').first().click();
  await expect(modal).toBeHidden();
}

test('main controls open and basic views render', async ({ page }) => {
  await gotoApp(page);

  await expect(page.locator('#tab-list')).toBeVisible();
  await expect(page.locator('#tab-sheet')).toBeVisible();
  await expect(page.locator('#tab-seisan')).toBeVisible();

  await loadSampleData(page);

  await page.locator('#tab-list').click();
  await expect(page.locator('.car-box').first()).toBeVisible();
  await expect(page.locator('#waiting-list')).toBeVisible();

  await page.locator('#tab-sheet').click();
  await expect(page.locator('#sheet-view-area')).toBeVisible();
  await expect(page.locator('#sheet-title-bar')).toBeVisible();

  await page.locator('#tab-seisan').click();
  await expect(page.locator('#seisan-view-area')).toBeVisible();
});

test('critical modals stay clickable and above the backdrop', async ({ page }) => {
  await gotoApp(page);

  await page.locator('.header-more .dropdown-toggle').click();
  await page.locator('#globalGuideBtn').click();
  await closeModal(page, '#globalGuideModal');

  await page.locator('.header-more .dropdown-toggle').click();
  await page.locator('#appearanceSettingsBtn').click();
  await expect(page.locator('#appearanceModal .modal-footer [data-bs-dismiss="modal"]')).toBeVisible();
  await page.locator('#appearanceModal .modal-footer [data-bs-dismiss="modal"]').click();
  await expect(page.locator('#appearanceModal')).toBeHidden();

  await page.locator('#tab-list').click();
  await page.locator('#batchOpenBtn').click();
  await closeModal(page, '#batchImportModal');

  await page.locator('#carGuideBtn').click();
  await closeModal(page, '#guideModal');

  await page.locator('#tab-seisan').click();
  await page.locator('#seisanGuideBtn').click();
  await closeModal(page, '#seisanGuideModal');

  await page.locator('#routeHelperBtn').click();
  await closeModal(page, '#routeDistanceModal');
});

test('settlement typing keeps focus and value until commit', async ({ page }) => {
  await gotoApp(page);
  await loadSampleData(page);
  await page.locator('#tab-seisan').click();

  const firstDistance = page.locator('#seisan-car-list [data-field="dist"]').first();
  await expect(firstDistance).toBeVisible();
  await firstDistance.fill('123');
  await expect(firstDistance).toHaveValue('123');
  await expect(firstDistance).toBeFocused();

  await page.waitForTimeout(520);
  await expect(firstDistance).toHaveValue('123');
});

test('drag a waiting member into the first seat', async ({ page }) => {
  await gotoApp(page);
  await loadSampleData(page);

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
