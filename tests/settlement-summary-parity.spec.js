const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

const ROOT = path.resolve(__dirname, '..');
const INDEX = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const localCss = [...INDEX.matchAll(/<link href="\.\/(assets\/css\/[^"?]+)(?:\?[^"]*)?" rel="stylesheet">/g)]
  .map(match => fs.readFileSync(path.join(ROOT, match[1]), 'utf8'))
  .join('\n');

function componentHtml(theme) {
  const themeAttr = theme === 'dark' ? ' data-theme="dark"' : '';
  return `<!doctype html><html lang="ja"${themeAttr}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
    ${localCss}
    html, body { margin: 0; min-width: 0; }
    body { background: var(--bg-body); }
    .seisan-summary-label > i { display: inline-block; width: 12px; font-style: normal; text-align: center; }
  </style></head><body><div id="seisan-view-area" class="active"><div class="seisan-wrap">
    <section class="seisan-card seisan-toolbar-card">
      <div class="seisan-head"><div class="seisan-title">全体の費用</div></div>
      <div id="seisan-summary" class="seisan-top-flow">
        <div class="seisan-summary-card collect ui-surface-card" data-summary-kind="collect">
          <div class="seisan-summary-label"><i aria-hidden="true">●</i>参加者集金</div>
          <div class="seisan-summary-value ui-amount">¥4,500</div>
          <div class="seisan-summary-sub">各 ¥500 × 9名</div>
        </div>
        <div class="seisan-flow-arrow seisan-flow-arrow--plus" aria-hidden="true">−</div>
        <div class="seisan-summary-card accounting ui-surface-card" data-summary-kind="club">
          <div class="seisan-summary-label"><i aria-hidden="true">●</i>部費戻入</div>
          <div class="seisan-summary-value ui-amount">¥600</div>
          <div class="seisan-summary-sub">集金超過分</div>
        </div>
        <div class="seisan-flow-arrow seisan-flow-arrow--equals" aria-hidden="true">＝</div>
        <div class="seisan-summary-card pay ui-surface-card" data-summary-kind="pay">
          <div class="seisan-summary-label"><i aria-hidden="true">●</i>支払総額</div>
          <div class="seisan-summary-value ui-amount">¥3,900</div>
          <div class="seisan-summary-sub">ドライバー3名分</div>
        </div>
      </div>
    </section>
  </div></div></body></html>`;
}

for (const theme of ['light', 'dark']) {
for (const width of [360, 390, 430]) {
  test(`overall cost cards stay aligned at ${width}px in ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.setContent(componentHtml(theme), { waitUntil: 'domcontentloaded' });

    const cards = page.locator('#seisan-summary .seisan-summary-card');
    await expect(cards).toHaveCount(3);
    const boxes = await cards.evaluateAll(nodes => nodes.map(node => {
      const rect = node.getBoundingClientRect();
      return { y: rect.y, width: rect.width, height: rect.height };
    }));

    expect(Math.max(...boxes.map(box => box.y)) - Math.min(...boxes.map(box => box.y))).toBeLessThanOrEqual(1);
    expect(Math.max(...boxes.map(box => box.width)) - Math.min(...boxes.map(box => box.width))).toBeLessThanOrEqual(1);
    expect(Math.max(...boxes.map(box => box.height)) - Math.min(...boxes.map(box => box.height))).toBeLessThanOrEqual(1);

    const paymentLabel = page.locator('[data-summary-kind="pay"] .seisan-summary-label');
    const labelMetrics = await paymentLabel.evaluate(node => ({
      clientHeight: node.clientHeight,
      scrollHeight: node.scrollHeight,
      whiteSpace: getComputedStyle(node).whiteSpace
    }));
    expect(labelMetrics.scrollHeight).toBeLessThanOrEqual(labelMetrics.clientHeight + 1);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
}
}
