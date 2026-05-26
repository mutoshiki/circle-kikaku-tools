# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: basic-ui.spec.js >> critical modals stay clickable and above the backdrop
- Location: tests/basic-ui.spec.js:92:1

# Error details

```
Error: page.goto: net::ERR_BLOCKED_BY_ADMINISTRATOR at http://127.0.0.1:4173/index.html
Call log:
  - navigating to "http://127.0.0.1:4173/index.html", waiting until "load"

```

# Page snapshot

```yaml
- generic [ref=e6]:
  - heading "127.0.0.1 is blocked" [level=1] [ref=e7]:
    - generic [ref=e8]: 127.0.0.1 is blocked
  - paragraph [ref=e9]: Your organization doesn’t allow you to view this site
```

# Test source

```ts
  1   | // Critical UI smoke tests for Playwright.
  2   | // Run after `npm i -D @playwright/test` and `npx playwright install chromium`.
  3   | // Then: `npx playwright test tests/basic-ui.spec.js`
  4   | 
  5   | const { test, expect } = require('@playwright/test');
  6   | 
  7   | async function installOfflineBootstrapFallback(page) {
  8   |   await page.addInitScript(() => {
  9   |     function showModal(el) {
  10  |       if (!el) return;
  11  |       el.style.display = 'block';
  12  |       el.removeAttribute('aria-hidden');
  13  |       el.setAttribute('aria-modal', 'true');
  14  |       el.classList.add('show');
  15  |       document.body.classList.add('modal-open');
  16  |       if (!document.querySelector('.modal-backdrop')) {
  17  |         const backdrop = document.createElement('div');
  18  |         backdrop.className = 'modal-backdrop fade show';
  19  |         document.body.appendChild(backdrop);
  20  |       }
  21  |     }
  22  |     function hideModal(el) {
  23  |       if (!el) return;
  24  |       el.classList.remove('show');
  25  |       el.style.display = 'none';
  26  |       el.setAttribute('aria-hidden', 'true');
  27  |       el.removeAttribute('aria-modal');
  28  |       document.querySelectorAll('.modal-backdrop').forEach(node => node.remove());
  29  |       document.body.classList.remove('modal-open');
  30  |     }
  31  |     class ModalFallback {
  32  |       constructor(el) { this.el = el; }
  33  |       show() { showModal(this.el); }
  34  |       hide() { hideModal(this.el); }
  35  |     }
  36  |     window.bootstrap = window.bootstrap || {};
  37  |     window.bootstrap.Modal = window.bootstrap.Modal || ModalFallback;
  38  |     document.addEventListener('click', event => {
  39  |       const dropdownToggle = event.target.closest?.('[data-bs-toggle="dropdown"]');
  40  |       if (dropdownToggle) {
  41  |         const wrap = dropdownToggle.closest('.dropdown');
  42  |         const menu = wrap?.querySelector('.dropdown-menu');
  43  |         if (menu) menu.classList.toggle('show');
  44  |       }
  45  |       const dismiss = event.target.closest?.('[data-bs-dismiss="modal"]');
  46  |       if (dismiss) hideModal(dismiss.closest('.modal'));
  47  |     }, true);
  48  |   });
  49  | }
  50  | 
  51  | async function gotoApp(page) {
  52  |   await installOfflineBootstrapFallback(page);
> 53  |   await page.goto('./index.html');
      |              ^ Error: page.goto: net::ERR_BLOCKED_BY_ADMINISTRATOR at http://127.0.0.1:4173/index.html
  54  | }
  55  | 
  56  | async function loadSampleData(page) {
  57  |   await page.locator('.header-more .dropdown-toggle').click();
  58  |   await page.locator('#sampleDataBtn').click();
  59  |   await expect(page.locator('#debugModal')).toBeVisible();
  60  |   await page.locator('#executeDebugBtn').click();
  61  |   await expect(page.locator('#debugModal')).toBeHidden();
  62  | }
  63  | 
  64  | async function closeModal(page, modalId) {
  65  |   const modal = page.locator(modalId);
  66  |   await expect(modal).toBeVisible();
  67  |   await modal.locator('.btn-close, [data-bs-dismiss="modal"]').first().click();
  68  |   await expect(modal).toBeHidden();
  69  | }
  70  | 
  71  | test('main controls open and basic views render', async ({ page }) => {
  72  |   await gotoApp(page);
  73  | 
  74  |   await expect(page.locator('#tab-list')).toBeVisible();
  75  |   await expect(page.locator('#tab-sheet')).toBeVisible();
  76  |   await expect(page.locator('#tab-seisan')).toBeVisible();
  77  | 
  78  |   await loadSampleData(page);
  79  | 
  80  |   await page.locator('#tab-list').click();
  81  |   await expect(page.locator('.car-box').first()).toBeVisible();
  82  |   await expect(page.locator('#waiting-list')).toBeVisible();
  83  | 
  84  |   await page.locator('#tab-sheet').click();
  85  |   await expect(page.locator('#sheet-view-area')).toBeVisible();
  86  |   await expect(page.locator('#sheet-title-bar')).toBeVisible();
  87  | 
  88  |   await page.locator('#tab-seisan').click();
  89  |   await expect(page.locator('#seisan-view-area')).toBeVisible();
  90  | });
  91  | 
  92  | test('critical modals stay clickable and above the backdrop', async ({ page }) => {
  93  |   await gotoApp(page);
  94  | 
  95  |   await page.locator('.header-more .dropdown-toggle').click();
  96  |   await page.locator('#globalGuideBtn').click();
  97  |   await closeModal(page, '#globalGuideModal');
  98  | 
  99  |   await page.locator('.header-more .dropdown-toggle').click();
  100 |   await page.locator('#appearanceSettingsBtn').click();
  101 |   await expect(page.locator('#appearanceModal .modal-footer [data-bs-dismiss="modal"]')).toBeVisible();
  102 |   await page.locator('#appearanceModal .modal-footer [data-bs-dismiss="modal"]').click();
  103 |   await expect(page.locator('#appearanceModal')).toBeHidden();
  104 | 
  105 |   await page.locator('#tab-list').click();
  106 |   await page.locator('#batchOpenBtn').click();
  107 |   await closeModal(page, '#batchImportModal');
  108 | 
  109 |   await page.locator('#carGuideBtn').click();
  110 |   await closeModal(page, '#guideModal');
  111 | 
  112 |   await page.locator('#tab-seisan').click();
  113 |   await page.locator('#seisanGuideBtn').click();
  114 |   await closeModal(page, '#seisanGuideModal');
  115 | 
  116 |   await page.locator('#routeHelperBtn').click();
  117 |   await closeModal(page, '#routeDistanceModal');
  118 | });
  119 | 
  120 | test('settlement typing keeps focus and value until commit', async ({ page }) => {
  121 |   await gotoApp(page);
  122 |   await loadSampleData(page);
  123 |   await page.locator('#tab-seisan').click();
  124 | 
  125 |   const firstEdit = page.locator('#seisan-car-list [data-action="open-settlement-car-edit"]').first();
  126 |   await expect(firstEdit).toBeVisible();
  127 |   await firstEdit.click();
  128 | 
  129 |   const firstDistance = page.locator('#settlementCarEditModal [data-field="dist"]').first();
  130 |   await expect(firstDistance).toBeVisible();
  131 |   await firstDistance.fill('123');
  132 |   await expect(firstDistance).toHaveValue('123');
  133 |   await expect(firstDistance).toBeFocused();
  134 | 
  135 |   await page.waitForTimeout(520);
  136 |   await expect(firstDistance).toHaveValue('123');
  137 | });
  138 | 
  139 | test('drag a waiting member into the first seat', async ({ page }) => {
  140 |   await gotoApp(page);
  141 |   await loadSampleData(page);
  142 | 
  143 |   await page.locator('#tab-list').click();
  144 | 
  145 |   const source = page.locator('#waiting-list .member-card').first();
  146 |   const target = page.locator('.seat-slot').first();
  147 | 
  148 |   await expect(source).toBeVisible();
  149 |   await expect(target).toBeVisible();
  150 | 
  151 |   const sourceBox = await source.boundingBox();
  152 |   const targetBox = await target.boundingBox();
  153 | 
```