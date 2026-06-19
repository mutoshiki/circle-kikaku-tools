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
        const menu = dropdownToggle.closest('.dropdown')?.querySelector('.dropdown-menu');
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

async function loadSampleData(page) {
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
  await page.locator('#sampleDataBtn').click();
  await page.evaluate(() => {
    document.querySelector('.header-more .dropdown-menu')?.classList.remove('show');
  });
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

async function openSettlementCarModal(page) {
  await page.locator('#tab-seisan').click();
  const edit = page.locator('#seisan-car-list [data-action="open-settlement-car-edit"]').first();
  await expect(edit).toBeVisible();
  await edit.click();
  await expect(page.locator('#settlementCarEditModal')).toBeVisible();
}

for (const scenario of [
  { width: 380, theme: 'light' },
  { width: 390, theme: 'dark' },
  { width: 768, theme: 'light' },
  { width: 769, theme: 'dark' },
  { width: 1280, theme: 'light' }
]) {
  test(`settlement modal visual contract ${scenario.width}px ${scenario.theme}`, async ({ page }) => {
    const consoleProblems = [];
    page.on('console', message => {
      if (['error', 'warning'].includes(message.type())) {
        consoleProblems.push(`${message.text()} @ ${message.location().url || 'inline'}`);
      }
    });
    page.on('pageerror', error => consoleProblems.push(error.message));
    await page.route('https://identitytoolkit.googleapis.com/v1/accounts:signUp**', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          idToken: 'visual-test-token',
          refreshToken: 'visual-test-refresh-token',
          expiresIn: '3600',
          localId: 'visual-test-user'
        })
      });
    });
    await page.route('https://identitytoolkit.googleapis.com/v1/accounts:lookup**', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          users: [{
            localId: 'visual-test-user',
            lastLoginAt: '0',
            createdAt: '0'
          }]
        })
      });
    });
    await page.route('https://securetoken.googleapis.com/v1/token**', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'visual-test-token',
          expires_in: '3600',
          token_type: 'Bearer',
          refresh_token: 'visual-test-refresh-token',
          id_token: 'visual-test-token',
          user_id: 'visual-test-user',
          project_id: 'circle-kikaku-tools'
        })
      });
    });

    await page.setViewportSize({ width: scenario.width, height: scenario.width < 700 ? 844 : 720 });
    await installOfflineBootstrapFallback(page);
    await page.goto('./index.html?visual-regression=1');
    await loadSampleData(page);

    if (scenario.theme === 'dark') {
      await page.evaluate(() => {
        document.documentElement.dataset.theme = 'dark';
        document.body.dataset.theme = 'dark';
      });
    }

    await openSettlementCarModal(page);
    await expect(page.locator('#settlementCarEditModal .modal-dialog')).toHaveScreenshot(
      `settlement-modal-${scenario.width}-${scenario.theme}.png`,
      {
        animations: 'disabled',
        caret: 'hide',
        maxDiffPixelRatio: 0.02,
        threshold: 0.25
      }
    );

    const overflow = await page.evaluate(() => ({
      document: document.documentElement.scrollWidth > window.innerWidth,
      modal: (() => {
        const modal = document.querySelector('#settlementCarEditModal .modal-dialog');
        return modal.scrollWidth > modal.clientWidth;
      })(),
      extraRow: (() => {
        const row = document.querySelector('#settlementCarEditModal .seisan-extra-row');
        return row.scrollWidth > row.clientWidth;
      })()
    }));

    expect(overflow).toEqual({ document: false, modal: false, extraRow: false });
    expect(consoleProblems).toEqual([]);
  });
}
