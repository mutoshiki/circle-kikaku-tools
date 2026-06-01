// Settlement driver payment checklist templates.
(function () {
  'use strict';

  const parts = window.SanpoApp?.settlementTemplateParts || {};
  const {
    esc,
    money,
    formatGasInline,
    formatExtraInline,
    formatDriverCollectionOffsetInline,
    formatDriverRoundInline,
    formatCostDetailRows,
    orderDriverRewardFirstForDisplay
  } = parts;

  function driverPay({ result, state, helpers = {} }) {
    if (!result.cars.length) return `<div class="seisan-empty">車出しを登録すると表示されます。</div>`;
    return result.cars.map(car => {
      const done = !!state.driverPaid?.[car.name];
      const extras = orderDriverRewardFirstForDisplay(Array.isArray(car.extras) ? car.extras : []);
      const costDetails = formatCostDetailRows([
        formatGasInline(car, helpers),
        ...extras.map(ex => formatExtraInline(ex, helpers)),
        formatDriverCollectionOffsetInline(car, helpers),
        formatDriverRoundInline(car, helpers)
      ]);
      return `<label class="seisan-driver-pay-row ${done ? 'done' : ''}">
            <span class="seisan-driver-name">${esc(car.name, helpers)}</span>
            <span class="seisan-driver-amount">${money(car.adjustedTotalPay ?? car.totalPay, helpers)}</span>
            <input type="checkbox" ${done ? 'checked' : ''} data-settlement-driver-paid-name="${encodeURIComponent(car.name)}">
            <div class="seisan-driver-detail seisan-driver-detail-list" aria-label="支払い内訳">${costDetails}</div>
        </label>`;
    }).join('');
  }

  
  Object.assign(parts, { driverPay });
})();
