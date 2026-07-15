// Settlement cost display helpers.
// Contains only pure string helpers for cost rows, tags, amount signs, and reward ordering.
(function () {
  'use strict';

  const parts = window.SanpoApp?.settlementTemplateParts || {};
  const { UI_CLASS, esc, money } = parts;

  function normalizeDisplayExtraType(type = 'split') {
    if (type === 'pay') return { type: 'pay', baseType: 'pay', negative: false };
    const normalized = ['split', 'club', 'split-minus', 'club-minus'].includes(type) ? type : 'split';
    return {
      type: normalized,
      baseType: normalized.startsWith('club') ? 'club' : 'split',
      negative: normalized.endsWith('-minus')
    };
  }

  function formatCostBadge(type = 'split', label = '') {
    const config = normalizeDisplayExtraType(type);
    const defaultLabel = config.baseType === 'club'
      ? (config.negative ? '部費−' : '部費')
      : config.baseType === 'pay'
        ? '支払い'
        : (config.negative ? '割勘−' : '割勘');
    const text = config.baseType === 'pay' && label === '支払' ? '支払' : (label || defaultLabel);
    const paymentClass = config.baseType === 'pay' ? ' seisan-payment-tag' : '';
    const negativeClass = config.negative ? ' is-negative' : '';
    return `<em class="seisan-cost-policy-tag seisan-cost-type-badge${paymentClass}${negativeClass} ${UI_CLASS.chip} ${config.baseType}" data-cost-type="${config.type}">${text}</em>`;
  }

  function formatPaymentBadge(label = '支払い') {
    return formatCostBadge('pay', label);
  }

    function formatExtraChips(extras, helpers = {}) {
    if (!extras.length) return '<span class="seisan-extra-empty">追加なし</span>'; 
    return extras.map(ex => {
      const config = normalizeDisplayExtraType(ex.type);
      const amount = Number(ex.amountValue ?? ex.amount ?? 0);
      return `<span class="seisan-extra-chip ${config.baseType}${config.negative ? ' is-negative' : ''}"><strong>${esc(ex.name || '費用', helpers)}</strong><b>${money(amount, helpers)}</b>${formatCostBadge(config.type)}</span>`;
    }).join('');
  }

    function formatExtraLines(extras, helpers = {}) {
    if (!extras.length) return '<div class="seisan-extra-line is-empty"><span>追加なし</span></div>'; 
    return extras.map(ex => {
      const config = normalizeDisplayExtraType(ex.type);
      const amount = Number(ex.amountValue ?? ex.amount ?? 0);
      return `<div class="seisan-extra-line ${config.baseType}${config.negative ? ' is-negative' : ''}"><span>${esc(ex.name || '費用', helpers)}</span><strong>${money(amount, helpers)}</strong>${formatCostBadge(config.type)}</div>`;
    }).join('');
  }

    function joinFormulaParts(parts) {
    return parts
      .filter(part => part && (typeof part === 'string' ? part.trim() : true))
      .map(part => typeof part === 'string' ? { html: part, op: '＋' } : part)
      .reduce((html, part, index) => {
      const partHtml = part.html || '';
      if (index === 0) return partHtml;
      const sign = part.op === '−' || String(partHtml).includes('seisan-extra-inline--offset') ? '−' : '＋';
      return `${html}<span class="seisan-extra-plus" aria-hidden="true">${sign}</span>${partHtml}`;
    }, '');
  }

    function formatGasInline(calc, helpers = {}) {
    if (calc?.usesTimesRental) return '';
    return `<span class="seisan-extra-inline seisan-cost-line seisan-extra-inline--gas split"><span>ガソリン代</span>${formatCostBadge('split')}<strong class="seisan-cost-line-amount seisan-car-summary-total ${UI_CLASS.amount}">${money(calc.gas || 0, helpers)}</strong></span>`;
  }

    function formatDriverCollectionOffsetInline(calc, helpers = {}) {
    if (!calc.collectionOffset) return '';
    return { op: '−', html: `<span class="seisan-extra-inline seisan-cost-line seisan-extra-inline--offset" data-cost-type="offset"><span>集金</span><em class="seisan-cost-type-badge seisan-cost-type-badge--spacer" aria-hidden="true">割勘</em><strong class="seisan-cost-line-amount seisan-car-summary-total ${UI_CLASS.amount}">${money(calc.collectionOffset, helpers)}</strong></span>` };
  }

    function formatDriverRoundInline(calc, helpers = {}) {
    if (!calc.driverRound) return '';
    return { op: '＋', html: `<span class="seisan-extra-inline seisan-cost-line seisan-extra-inline--rounding split" data-cost-type="rounding"><span>端数処理分</span>${formatCostBadge('split')}<strong class="seisan-cost-line-amount seisan-car-summary-total ${UI_CLASS.amount}">${money(calc.driverRound, helpers)}</strong></span>` };
  }

    function isRewardExtraForDisplay(ex = {}) {
    if (typeof window.isDriverRewardExtra === 'function') return window.isDriverRewardExtra(ex);
    const name = String(ex?.name || '').replace(/\s+/g, '').replace(/[（）()]/g, '');
    return name === '車出し協力代' || name === '車出し協力代1台' || name === '運転協力代' || name === '運転協力代1台' || name === '協力代';
  }

    function orderDriverRewardFirstForDisplay(extras = []) {
    const list = Array.isArray(extras) ? extras : [];
    return list.filter(isRewardExtraForDisplay).concat(list.filter(ex => !isRewardExtraForDisplay(ex)));
  }

    function formatExtraInline(ex, helpers = {}) {
    const config = normalizeDisplayExtraType(ex.type);
    const rawAmount = Number(ex.amountValue ?? ex.amount ?? 0);
    const isMinus = rawAmount < 0 || config.negative;
    const amount = Math.abs(rawAmount);
    const rewardClass = isRewardExtraForDisplay(ex) ? ' seisan-extra-inline--driver-reward' : '';
    const negativeClass = isMinus ? ' is-negative' : '';
    return {
      op: isMinus ? '−' : '＋',
      html: `<span class="seisan-extra-inline seisan-cost-line ${config.baseType}${negativeClass}${rewardClass}"><span>${esc(ex.name || '費用', helpers)}</span>${formatCostBadge(config.type)}<strong class="seisan-cost-line-amount seisan-car-summary-total ${UI_CLASS.amount}">${money(amount, helpers)}</strong></span>`
    };
  }

    function formatExtraSlash(extras, helpers = {}) {
    if (!extras.length) return '';
    return joinFormulaParts(orderDriverRewardFirstForDisplay(extras).map(ex => formatExtraInline(ex, helpers)));
  }

    function normalizeCostPart(part) {
    if (!part) return null;
    return typeof part === 'string' ? { op: '＋', html: part } : { op: part.op || '＋', html: part.html || '' };
  }

    function applyAmountSign(html, sign) {
    const signClass = sign ? 'seisan-amount-sign' : 'seisan-amount-sign is-blank';
    const signText = sign || '＋';
    return String(html || '').replace(/<strong([^>]*)>/, `<strong$1><span class="${signClass}" aria-hidden="true">${signText}</span>`);
  }

    function formatCostDetailRows(parts) {
    return parts
      .map(normalizeCostPart)
      .filter(part => part && String(part.html || '').trim())
      .map((part, index) => {
        const sign = part.op === '−' ? '−' : (index === 0 ? '' : '＋');
        const tone = part.op === '−' ? ' is-minus' : ' is-plus';
        const html = applyAmountSign(part.html, sign);
        return `<div class="seisan-cost-preview-line${tone}"><span class="seisan-cost-preview-line-body">${html}</span></div>`;
      })
      .join('');
  }


    function formatPaymentTotalRow(calc, helpers = {}) {
    const amount = calc.adjustedTotalPay ?? calc.totalPay ?? 0;
    return `<div class="seisan-car-summary-payment seisan-cost-total-row" aria-label="車主への支払い金額"><span class="seisan-cost-total-label">合計</span>${formatPaymentBadge('支払')}<strong class="seisan-car-summary-total ${UI_CLASS.amount}"><span class="seisan-amount-sign" aria-hidden="true">＝</span>${money(amount, helpers)}</strong></div>`;
  }

  
  Object.assign(parts, {
    formatCostBadge,
    formatPaymentBadge,
    formatExtraChips,
    formatExtraLines,
    joinFormulaParts,
    formatGasInline,
    formatDriverCollectionOffsetInline,
    formatDriverRoundInline,
    isRewardExtraForDisplay,
    orderDriverRewardFirstForDisplay,
    formatExtraInline,
    formatExtraSlash,
    normalizeCostPart,
    applyAmountSign,
    formatCostDetailRows,
    formatPaymentTotalRow
  });
})();
