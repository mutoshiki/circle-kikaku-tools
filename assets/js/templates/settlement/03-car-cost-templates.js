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
        ? `<button class="seisan-alert-action" type="button" data-action="open-settlement-car-edit" data-driver-name="${encodeURIComponent(carName)}">該当車を編集</button>`
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
          <button class="seisan-btn seisan-edit-btn" type="button" data-action="open-settlement-car-edit" data-driver-name="${encodeURIComponent(car.name)}"><i class="fas fa-pen" aria-hidden="true"></i><span>編集</span></button>
          <label class="seisan-car-payment-check ${paid ? 'done' : ''}">
            <span>${paid ? '支払い済み' : '未支払い'}</span>
            <input type="checkbox" ${paid ? 'checked' : ''} data-settlement-driver-paid-name="${encodeURIComponent(car.name)}" aria-label="${esc(car.name, helpers)}車への支払いチェック">
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
    const standaloneNameField = standaloneIndex == null ? '' : `<label class="seisan-standalone-driver-name-field"><span class="seisan-mini-label">車出し名</span><input type="text" data-field="standaloneDriverName" value="${esc(car.name, helpers)}" placeholder="車出し${standaloneIndex + 1}" autocomplete="off"></label>`;
    const rentalType = usesTimesRental ? 'times' : 'private';
    return `<div class="seisan-car-row ${UI_CLASS.surfaceCard}${rowClass}" data-driver-name="${esc(car.name, helpers)}"${standaloneData}>
        <div class="seisan-subhead"><strong>ガソリン代</strong></div>
        ${standaloneNameField}
        <div class="seisan-car-inputs">
          <div class="seisan-times-toggle-field"><label class="seisan-times-toggle"><input type="checkbox" data-field="rentalType" value="times" ${rentalType === 'times' ? 'checked' : ''} aria-label="レンタカー（タイムズ）"><span class="seisan-times-toggle-ui" aria-hidden="true"></span><span class="seisan-times-toggle-text">レンタカー（タイムズ）</span></label></div>
          <div class="seisan-gas-field-row" role="group" aria-label="ガソリン代の計算条件">
            <label class="seisan-distance-field"><span class="seisan-mini-label">移動距離（km）</span><input type="number" inputmode="decimal" data-field="dist" class="${UI_CLASS.input} ${fieldErrorClass(issues, car.name, 'dist')}" value="${esc(cState.dist || '', helpers)}"></label>
            <label class="seisan-fuel-field"><span class="seisan-mini-label">燃費（km/L）</span><input type="number" inputmode="decimal" data-field="eco" class="${UI_CLASS.input} ${fieldErrorClass(issues, car.name, 'eco')}" value="${esc(cState.eco || '', helpers)}"></label>
            <label class="seisan-fuel-field"><span class="seisan-mini-label">ガソリン単価（円/L）</span><input type="number" inputmode="decimal" data-field="price" class="${UI_CLASS.input} ${fieldErrorClass(issues, car.name, 'price')}" value="${esc(cState.price || '', helpers)}"></label>
          </div>
          <button class="seisan-btn seisan-distance-shortcut" type="button" data-action="open-route-helper-shortcut" title="距離計算ツールを開く" aria-label="距離計算ツールを開く"><i class="fas fa-up-right-from-square" aria-hidden="true"></i><span>距離計算ツール</span></button>
        </div>
        <div class="seisan-subhead"><strong>諸経費</strong></div>
        <div class="seisan-extra-list">
          ${extras.map((ex, i) => extraRow({ carName: car.name, ex, index: i, issues, helpers })).join('')}
        </div>
        <div class="seisan-add-row">
          <button class="seisan-btn" type="button" data-action="add-settlement-extra" data-driver-name="${encodeURIComponent(car.name)}"><i class="fas fa-plus" aria-hidden="true"></i><span>諸経費を追加</span></button>
        </div>
        ${extraCandidates.length ? `<div class="seisan-extra-candidates">
          <div class="seisan-extra-candidates-title"><i class="fas fa-lightbulb" aria-hidden="true"></i>候補</div>
          <div class="seisan-extra-candidate-list">
            ${extraCandidates.map(candidate => `<button class="seisan-extra-candidate-chip" type="button" data-action="add-settlement-extra-candidate" data-driver-name="${encodeURIComponent(car.name)}" data-extra-candidate="${encodeURIComponent(candidate.name)}" data-extra-amount="${encodeURIComponent(candidate.amount)}" data-extra-type="${candidate.type}"><i class="fas fa-plus" aria-hidden="true"></i><span>${extraCandidateLabel(candidate, helpers)}</span></button>`).join('')}
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
