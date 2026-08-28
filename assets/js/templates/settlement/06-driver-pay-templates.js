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
    const driverCars = result.cars.filter(car => Array.isArray(car.driverNames) && car.driverNames.length);
    if (!driverCars.length) return `<div class="seisan-empty">運転手タグを付けると表示されます。</div>`;
    return driverCars.map(car => {
      const done = !!state.driverPaid?.[car.name];
      const driverLabel = car.driverNames.length === 1 && car.driverNames[0] === car.name
        ? `${car.driverNames[0]}車`
        : `${car.driverNames.join('・')}（${car.name}車）`;
      const extras = orderDriverRewardFirstForDisplay(Array.isArray(car.extras) ? car.extras : []);
      const costDetails = formatCostDetailRows([
        formatGasInline(car, helpers),
        ...extras.map(ex => formatExtraInline(ex, helpers)),
        formatDriverCollectionOffsetInline(car, helpers),
        formatDriverRoundInline(car, helpers)
      ]);
      return `<div class="seisan-driver-pay-row ${done ? 'done' : ''}" data-carbon-checkbox-row>
            <span class="seisan-driver-name">${esc(driverLabel, helpers)}</span>
            <span class="seisan-driver-amount"><span class="seisan-amount-sign" aria-hidden="true">＝</span>${money(car.adjustedTotalPay ?? car.totalPay, helpers)}</span>
            <cds-checkbox ${done ? 'checked' : ''} data-settlement-driver-paid-name="${encodeURIComponent(car.name)}" label-text="支払い済み" aria-label="${esc(driverLabel, helpers)}を支払い済みにする"></cds-checkbox>
            <cds-accordion class="seisan-driver-accordion">
              <cds-accordion-item title="内訳を表示">
                <div class="seisan-driver-detail seisan-driver-detail-list" aria-label="支払い内訳">${costDetails}</div>
              </cds-accordion-item>
            </cds-accordion>
        </div>`;
    }).join('');
  }

  
  Object.assign(parts, { driverPay });
})();
