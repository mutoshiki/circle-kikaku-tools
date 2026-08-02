// Settlement car cost templates.
// These builders do not attach event handlers or mutate state; callers own all actions and state.
(function () {
  'use strict';

  const parts = window.SanpoApp?.settlementTemplateParts || {};
  const {
    UI_CLASS,
    esc,
    money,
    extraRow,
    formatGasInline,
    formatExtraInline,
    formatDriverCollectionOffsetInline,
    formatDriverRoundInline,
    formatCostDetailRows,
    formatPaymentTotalRow,
    orderDriverRewardFirstForDisplay
  } = parts;

  function extraCandidateLabel(candidate, helpers = {}) {
    const typeLabel = candidate.type === 'club' ? '部費' : '割勘';
    return `${esc(candidate.name, helpers)} / ${money(candidate.amount, helpers)} / ${typeLabel}`;
  }

  function renderIssues(issues, helpers = {}) {
    return (issues.messages || []).map(message => {
      const text = esc(message, helpers);
      const carName = String(message || '').match(/^(.+?)車の/)?.[1] || '';
      const action = carName
        ? `<cds-button class="seisan-alert-action" kind="ghost" size="lg" type="button" data-action="open-settlement-car-edit" data-driver-name="${encodeURIComponent(carName)}">該当車を編集</cds-button>`
        : '';
      const rowTone = message.includes('企画者を選ぶ') ? ' is-guidance' : ' is-error';
      return `<div class="seisan-alert-row${rowTone}"><span>${rowTone === ' is-error' ? '・' : ''}${text}</span>${action}</div>`;
    }).join('');
  }

    function carSummary({ car, calc, issues, paid = false, helpers = {} }) {
    const rowClass = issues.rows.has(car.name) ? ' has-error' : '';
    const extras = orderDriverRewardFirstForDisplay(Array.isArray(calc.extras) ? calc.extras : []);
    const costDetails = formatCostDetailRows([
      formatGasInline(calc, helpers),
      ...extras.map(ex => formatExtraInline(ex, helpers)),
      formatDriverCollectionOffsetInline(calc, helpers),
      formatDriverRoundInline(calc, helpers)
    ]);
    return `<article class="seisan-car-summary-row ${UI_CLASS.surfaceCard}${rowClass}" data-driver-name="${esc(car.name, helpers)}">
        <div class="seisan-car-summary-headline">
          <strong class="seisan-car-summary-name">${esc(car.name, helpers)}車${calc.usesTimesRental ? '（レンタカー）' : ''}</strong>
          <cds-button class="seisan-btn seisan-edit-btn" kind="tertiary" size="md" type="button" data-action="open-settlement-car-edit" data-driver-name="${encodeURIComponent(car.name)}"><span data-carbon-icon="edit" slot="icon" aria-hidden="true"></span><span>編集</span></cds-button>
          <label class="seisan-car-payment-check ${paid ? 'done' : ''}" data-carbon-checkbox-row>
            <span>${paid ? '支払済み' : '支払済みにする'}</span>
            <cds-checkbox ${paid ? 'checked' : ''} data-settlement-driver-paid-name="${encodeURIComponent(car.name)}" label-text="" aria-label="${esc(car.name, helpers)}車への支払いチェック"></cds-checkbox>
          </label>
        </div>
        <div class="seisan-cost-preview-list" aria-label="費用内訳">
          <div class="seisan-cost-preview-item seisan-cost-preview-item--gas seisan-cost-preview-item--extras seisan-cost-preview-item--inline-all ${UI_CLASS.surfaceInset}">
            <span class="seisan-cost-preview-detail-text seisan-extra-inline-list">${costDetails}</span>
            ${formatPaymentTotalRow(calc, helpers)}
          </div>
        </div>
    </article>`;
  }

    function carRow({ car, cState, calc, extras, extraCandidates = [], issues, helpers = {} }) {
    const fieldErrorClass = helpers.fieldErrorClass || (() => '');
    const usesTimesRental = cState.rentalType === 'times' || calc.usesTimesRental;
    const rowClass = `${issues.rows.has(car.name) ? ' has-error' : ''}${usesTimesRental ? ' is-times-rental' : ''}`;
    const offsetText = calc.collectionOffset ? ` / 車出し分 -${money(calc.collectionOffset, helpers)}` : '';
    const fuelText = usesTimesRental ? 'タイムズ' : `ガソリン代 ${money(calc.gas || 0, helpers)}`;
    const details = `${fuelText} / 諸経費 ${money((calc.splitExtras || 0) + (calc.clubExtras || 0), helpers)}${offsetText}`;
    const standaloneIndex = Number.isInteger(car.standaloneIndex) ? car.standaloneIndex : null;
    const standaloneData = standaloneIndex == null ? '' : ` data-standalone-driver-index="${standaloneIndex}"`;
    const standaloneNameField = standaloneIndex == null ? '' : `<label class="seisan-standalone-driver-name-field"><span class="seisan-mini-label">車出し名</span><cds-text-input size="lg" data-field="standaloneDriverName" value="${esc(car.name, helpers)}" placeholder="車出し${standaloneIndex + 1}" autocomplete="off" label="車出し名" hide-label></cds-text-input></label>`;
    const rentalType = usesTimesRental ? 'times' : 'private';
    return `<div class="seisan-car-row ${UI_CLASS.surfaceCard}${rowClass}" data-driver-name="${esc(car.name, helpers)}"${standaloneData}>
        <div class="seisan-subhead"><strong>ガソリン代</strong></div>
        ${standaloneNameField}
        <div class="seisan-car-inputs">
          <div class="seisan-times-toggle-field"><cds-toggle class="seisan-times-toggle" data-field="rentalType" value="times" ${rentalType === 'times' ? 'checked' : ''} label-text="レンタカー（タイムズ）" label-a="タイムズ" label-b="自家用車" aria-label="レンタカー（タイムズ）"></cds-toggle></div>
          <div class="seisan-gas-field-row" role="group" aria-label="ガソリン代の計算条件">
            <label class="seisan-distance-field"><span class="seisan-mini-label">移動距離（km）</span><cds-text-input type="text" size="lg" inputmode="decimal" data-field="dist" class="${UI_CLASS.input} ${fieldErrorClass(issues, car.name, 'dist')}" value="${esc(cState.dist || '', helpers)}" label="移動距離（km）" hide-label></cds-text-input></label>
            <label class="seisan-fuel-field"><span class="seisan-mini-label">燃費（km/L）</span><cds-text-input type="text" size="lg" inputmode="decimal" data-field="eco" class="${UI_CLASS.input} ${fieldErrorClass(issues, car.name, 'eco')}" value="${esc(cState.eco || '', helpers)}" label="燃費（km/L）" hide-label></cds-text-input></label>
            <label class="seisan-fuel-field"><span class="seisan-mini-label">ガソリン単価（円/L）</span><cds-text-input type="text" size="lg" inputmode="decimal" data-field="price" class="${UI_CLASS.input} ${fieldErrorClass(issues, car.name, 'price')}" value="${esc(cState.price || '', helpers)}" label="ガソリン単価（円/L）" hide-label></cds-text-input></label>
          </div>
          <cds-button class="seisan-btn seisan-distance-shortcut" kind="tertiary" size="lg" type="button" data-action="open-route-helper-shortcut" title="距離計算ツールを開く" aria-label="距離計算ツールを開く"><span data-carbon-icon="launch" slot="icon" aria-hidden="true"></span><span>距離計算ツール</span></cds-button>
        </div>
        <div class="seisan-subhead"><strong>諸経費</strong></div>
        <div class="seisan-extra-list">
          ${extras.map((ex, i) => extraRow({ carName: car.name, ex, index: i, issues, helpers })).join('')}
        </div>
        <div class="seisan-add-row">
          <cds-button class="seisan-btn" kind="tertiary" size="lg" type="button" data-action="add-settlement-extra" data-driver-name="${encodeURIComponent(car.name)}"><span data-carbon-icon="add" slot="icon" aria-hidden="true"></span><span>諸経費を追加</span></cds-button>
        </div>
        ${extraCandidates.length ? `<div class="seisan-extra-candidates">
          <div class="seisan-extra-candidates-title"><span data-carbon-icon="idea" aria-hidden="true"></span>候補</div>
          <div class="seisan-extra-candidate-list">
            ${extraCandidates.map(candidate => `<cds-button class="seisan-extra-candidate-chip" kind="ghost" size="lg" type="button" data-action="add-settlement-extra-candidate" data-driver-name="${encodeURIComponent(car.name)}" data-extra-candidate="${encodeURIComponent(candidate.name)}" data-extra-amount="${encodeURIComponent(candidate.amount)}" data-extra-type="${candidate.type}"><span data-carbon-icon="add" slot="icon" aria-hidden="true"></span><span>${extraCandidateLabel(candidate, helpers)}</span></cds-button>`).join('')}
          </div>
        </div>` : ''}
    </div>`;
  }

    function cars({ data, state = {}, result, issues, helpers = {} }) {
    if (!data.cars.length) return `<div class="seisan-empty">先に車出しを登録してください。</div>`;
    return data.cars.map(car => {
      const calc = result.cars.find(c => c.name === car.name) || { totalPay: 0, gas: 0, extras: [] };
      return carSummary({ car, calc, issues, paid: !!state.driverPaid?.[car.name], helpers });
    }).join('');
  }


  Object.assign(parts, { renderIssues, carSummary, carRow, cars });
})();
