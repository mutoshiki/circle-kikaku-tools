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
      static instances = new WeakMap();
      constructor(el) {
        this.el = el;
        ModalFallback.instances.set(el, this);
      }
      static getInstance(el) { return ModalFallback.instances.get(el) || null; }
      static getOrCreateInstance(el) { return this.getInstance(el) || new ModalFallback(el); }
      show() { showModal(this.el); }
      hide() { hideModal(this.el); }
    }
    window.bootstrap = window.bootstrap || {};
    window.bootstrap.Modal = window.bootstrap.Modal || ModalFallback;
    document.addEventListener('click', event => {
      const dropdownToggle = event.target.closest?.('[data-bs-toggle="dropdown"]');
      if (dropdownToggle) {
        event.preventDefault();
        event.stopImmediatePropagation();
        const wrap = dropdownToggle.closest('.dropdown');
        const menu = wrap?.querySelector('.dropdown-menu');
        if (menu) {
          menu.classList.toggle('show');
          Object.assign(menu.style, {
            position: 'fixed',
            top: '56px',
            right: '8px',
            left: 'auto',
            maxHeight: 'calc(100vh - 64px)',
            overflowY: 'auto'
          });
        }
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

async function openHeaderMenu(page) {
  await page.evaluate(() => {
    const menu = document.querySelector('.header-more .dropdown-menu');
    menu.classList.add('show');
    Object.assign(menu.style, {
      position: 'fixed',
      top: '56px',
      right: '8px',
      left: 'auto',
      maxHeight: 'calc(100vh - 64px)',
      overflowY: 'auto'
    });
  });
}

async function closeHeaderMenu(page) {
  await page.evaluate(() => {
    const menu = document.querySelector('.header-more .dropdown-menu');
    menu?.classList.remove('show');
  });
}

async function loadSampleData(page) {
  await openHeaderMenu(page);
  await page.locator('#sampleDataBtn').click();
  await closeHeaderMenu(page);
  await expect(page.locator('#debugModal')).toBeVisible();
  await page.locator('#executeDebugBtn').click();
  await page.evaluate(() => {
    const modal = document.querySelector('#debugModal');
    if (modal?.classList.contains('show')) {
      modal.classList.remove('show');
      modal.style.display = 'none';
      modal.setAttribute('aria-hidden', 'true');
      modal.removeAttribute('aria-modal');
      document.querySelectorAll('.modal-backdrop').forEach(node => node.remove());
      document.body.classList.remove('modal-open');
    }
  });
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

  await page.locator('#tab-sheet').click();
  await expect(page.locator('#sheet-view-area')).toBeVisible();
  await expect(page.locator('#sheet-title-bar')).toBeVisible();

  await page.locator('#tab-seisan').click();
  await expect(page.locator('#seisan-view-area')).toBeVisible();
});

test('critical modals stay clickable and above the backdrop', async ({ page }) => {
  await gotoApp(page);
  await loadSampleData(page);

  await openHeaderMenu(page);
  await page.locator('#globalGuideBtn').click();
  await closeHeaderMenu(page);
  await closeModal(page, '#globalGuideModal');

  await openHeaderMenu(page);
  await page.locator('#appearanceSettingsBtn').click();
  await closeHeaderMenu(page);
  await expect(page.locator('#appearanceModal .modal-footer [data-bs-dismiss="modal"]')).toBeVisible();
  await page.locator('#appearanceModal .modal-footer [data-bs-dismiss="modal"]').click();
  await expect(page.locator('#appearanceModal')).toBeHidden();

  await page.locator('#tab-list').click();
  await page.locator('#batchOpenBtn').click();
  await closeModal(page, '#batchImportModal');

  await page.locator('#tab-seisan').click();
  await page.locator('#seisan-car-list [data-action="open-settlement-car-edit"]').first().click();
  await page.locator('#settlementCarEditModal [data-action="open-route-helper-shortcut"]').click();
  await closeModal(page, '#routeDistanceModal');
});

test('settlement typing keeps focus and value until commit', async ({ page }) => {
  await gotoApp(page);
  await loadSampleData(page);
  await page.locator('#tab-seisan').click();

  const firstEdit = page.locator('#seisan-car-list [data-action="open-settlement-car-edit"]').first();
  await expect(firstEdit).toBeVisible();
  await firstEdit.click();

  const firstDistance = page.locator('#settlementCarEditModal [data-field="dist"]').first();
  await expect(firstDistance).toBeVisible();
  await firstDistance.fill('123');
  await expect(firstDistance).toHaveValue('123');
  await expect(firstDistance).toBeFocused();

  await page.waitForTimeout(520);
  await expect(firstDistance).toHaveValue('123');
});

test('drag a member between seat slots', async ({ page }) => {
  await gotoApp(page);
  await loadSampleData(page);

  await page.locator('#tab-list').click();

  const source = page.locator('.seat-slot .member-card').first();
  const occupiedSlots = page.locator('.seat-slot:has(.member-card)');
  expect(await occupiedSlots.count()).toBeGreaterThan(1);
  const target = occupiedSlots.nth(1);

  await expect(source).toBeVisible();
  await expect(target).toBeVisible();
  const sourceText = (await source.innerText()).trim();
  const memberCount = await page.locator('.seat-slot .member-card').count();

  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();

  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(120);
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 16 });
  await page.mouse.up();

  await expect(page.locator('.seat-slot .member-card')).toHaveCount(memberCount);
  await expect(target.locator('.member-card')).toContainText(sourceText);
});
