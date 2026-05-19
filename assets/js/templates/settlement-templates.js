// Settlement HTML templates.
// Rendering logic calls these pure string builders so generated markup stays out of feature logic.
(function () {
  'use strict';

  function esc(value, helpers) {
    return (helpers?.escapeHtml || window.escapeHtml || (v => String(v ?? '')))(value);
  }

  function money(value, helpers) {
    return (helpers?.yen || (v => '¥' + Math.round(v || 0).toLocaleString()))(value);
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

  function extraRow({ carName, ex, index, issues, helpers = {} }) {
    const type = ex.type === 'club' ? 'club' : 'split';
    const extraFieldErrorClass = helpers.extraFieldErrorClass || (() => '');
    return `<div class="seisan-extra-row" data-extra-index="${index}">
        <input type="text" data-extra-field="name" class="${extraFieldErrorClass(issues, carName, index, 'name')}" value="${esc(ex.name || '', helpers)}" placeholder="例：駐車場代">
        <input type="number" inputmode="numeric" data-extra-field="amount" class="${extraFieldErrorClass(issues, carName, index, 'amount')}" value="${esc(ex.amount || '', helpers)}" placeholder="金額">
        <select data-extra-field="type" class="seisan-extra-type ${type}">
            <option value="split" ${type === 'split' ? 'selected' : ''}>割勘</option>
            <option value="club" ${type === 'club' ? 'selected' : ''}>部費</option>
        </select>
        <button class="seisan-icon-btn" type="button" data-action="remove-settlement-extra" title="削除"><i class="fas fa-times" aria-hidden="true"></i></button>
    </div>`;
  }

  function summary(result, helpers = {}) {
    const accountingLabel = result.accounting >= 0 ? '部費から' : '部費へ戻す';
    const accountingSign = result.accounting >= 0 ? '＋' : '−';
    return `
        <div class="seisan-summary-card collect" data-summary-kind="collect">
          <div class="seisan-summary-label"><i class="fas fa-users" aria-hidden="true"></i>${formatCostBadge('split')}</div>
          <div class="seisan-summary-value">${money(result.expectedCollected, helpers)}</div>
          <div class="seisan-summary-sub">1人 ${money(result.perPerson, helpers)} × ${result.payerCount}名</div>
        </div>
        <div class="seisan-flow-arrow seisan-flow-arrow--plus" aria-hidden="true">${accountingSign}</div>
        <div class="seisan-summary-card accounting" data-summary-kind="club">
          <div class="seisan-summary-label"><i class="fas fa-wallet" aria-hidden="true"></i>${formatCostBadge('club')}</div>
          <div class="seisan-summary-value">${money(Math.abs(result.accounting), helpers)}</div>
          <div class="seisan-summary-sub">${accountingLabel}</div>
        </div>
        <div class="seisan-flow-arrow seisan-flow-arrow--equals" aria-hidden="true">＝</div>
        <div class="seisan-summary-card pay" data-summary-kind="pay">
          <div class="seisan-summary-label"><i class="fas fa-car-side" aria-hidden="true"></i>${formatPaymentBadge()}</div>
          <div class="seisan-summary-value">${money(result.driverTotal, helpers)}</div>
          <div class="seisan-summary-sub">車出し対象 ${result.cars.length}名</div>
        </div>`;
  }

  function settingSummary({ state, result, helpers = {} }) {
    const organizer = state.organizerName || '未選択';
    const freeLabel = state.organizerFree ? 'あり' : 'なし';
    return `<div class="seisan-summary-pills seisan-summary-pills--single" aria-label="現在の精算設定">
        <span><small>端数</small>${esc(state.rounding || '100', helpers)}円</span>
        <span><small>協力代</small>${money(result.reward || 0, helpers)}</span>
        <span class="${state.organizerName ? '' : 'is-attention'}"><small>企画者</small>${esc(organizer, helpers)}</span>
        <span><small>対象外設定</small>${esc(freeLabel, helpers)}</span>
    </div>`;
  }

  function formatCostBadge(type = 'split') {
    const normalized = type === 'club' ? 'club' : 'split';
    return `<em class="seisan-cost-policy-tag seisan-cost-type-badge ${normalized}" data-cost-type="${normalized}">${normalized === 'club' ? '部費' : '割勘'}</em>`;
  }

  function formatPaymentBadge() {
    return '<em class="seisan-payment-tag" data-cost-type="pay">支払い</em>';
  }

  function formatExtraChips(extras, helpers = {}) {
    if (!extras.length) return '<span class="seisan-extra-empty">追加なし</span>'; 
    return extras.map(ex => {
      const type = ex.type === 'club' ? 'club' : 'split';
      return `<span class="seisan-extra-chip ${type}"><strong>${esc(ex.name || '費用', helpers)}</strong><b>${money(ex.amountValue || ex.amount || 0, helpers)}</b>${formatCostBadge(type)}</span>`;
    }).join('');
  }

  function formatExtraLines(extras, helpers = {}) {
    if (!extras.length) return '<div class="seisan-extra-line is-empty"><span>追加なし</span></div>'; 
    return extras.map(ex => {
      const type = ex.type === 'club' ? 'club' : 'split';
      return `<div class="seisan-extra-line ${type}"><span>${esc(ex.name || '費用', helpers)}</span><strong>${money(ex.amountValue || ex.amount || 0, helpers)}</strong>${formatCostBadge(type)}</div>`;
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
    return `<span class="seisan-extra-inline seisan-extra-inline--gas split"><span>ガソリン代</span><strong>${money(calc.gas || 0, helpers)}</strong>${formatCostBadge('split')}</span>`;
  }

  function formatDriverCollectionOffsetInline(calc, helpers = {}) {
    if (!calc.collectionOffset) return '';
    return { op: '−', html: `<span class="seisan-extra-inline seisan-extra-inline--offset club"><span>集金</span><strong>${money(calc.collectionOffset, helpers)}</strong>${formatCostBadge('club')}</span>` };
  }

  function formatExtraSlash(extras, helpers = {}) {
    if (!extras.length) return '';
    return joinFormulaParts(extras.map(ex => {
      const type = ex.type === 'club' ? 'club' : 'split';
      return `<span class="seisan-extra-inline ${type}"><span>${esc(ex.name || '費用', helpers)}</span><strong>${money(ex.amountValue || ex.amount || 0, helpers)}</strong>${formatCostBadge(type)}</span>`;
    }));
  }

  function carSummary({ car, calc, issues, helpers = {} }) {
    const rowClass = issues.rows.has(car.name) ? ' has-error' : '';
    const extras = Array.isArray(calc.extras) ? calc.extras : [];
    const costDetails = joinFormulaParts([formatGasInline(calc, helpers), formatExtraSlash(extras, helpers), formatDriverCollectionOffsetInline(calc, helpers)]);
    return `<article class="seisan-car-summary-row${rowClass}" data-driver-name="${esc(car.name, helpers)}">
        <div class="seisan-car-summary-headline">
          <strong class="seisan-car-summary-name"><span>${esc(car.name, helpers)}</span><em>車</em></strong>
          <div class="seisan-car-summary-payment" aria-label="車主への支払い金額">
            ${formatPaymentBadge()}
            <strong class="seisan-car-summary-total">${money(calc.adjustedTotalPay ?? calc.totalPay ?? 0, helpers)}</strong>
          </div>
          <button class="seisan-btn seisan-edit-btn" type="button" data-action="open-settlement-car-edit" data-driver-name="${encodeURIComponent(car.name)}"><i class="fas fa-pen" aria-hidden="true"></i><span>編集</span></button>
        </div>
        <div class="seisan-cost-preview-list" aria-label="費用内訳">
          <div class="seisan-cost-preview-item seisan-cost-preview-item--gas seisan-cost-preview-item--extras seisan-cost-preview-item--inline-all">
            <span class="seisan-cost-preview-detail-text seisan-extra-inline-list">${costDetails}</span>
          </div>
        </div>
    </article>`;
  }

  function carRow({ car, cState, calc, extras, issues, helpers = {} }) {
    const fieldErrorClass = helpers.fieldErrorClass || (() => '');
    const rowClass = issues.rows.has(car.name) ? ' has-error' : '';
    const offsetText = calc.collectionOffset ? ` / 集金 -${money(calc.collectionOffset, helpers)}` : '';
    const details = `ガソリン代 ${money(calc.gas || 0, helpers)} / 諸経費 ${money((calc.splitExtras || 0) + (calc.clubExtras || 0), helpers)}${offsetText}`;
    return `<div class="seisan-car-row${rowClass}" data-driver-name="${esc(car.name, helpers)}">
        <div class="seisan-car-title"><strong>${esc(car.name, helpers)} 車</strong><span class="seisan-car-total">支払い ${money(calc.adjustedTotalPay ?? calc.totalPay, helpers)}</span></div>
        <div class="seisan-small">${details}</div>
        <div class="seisan-car-inputs">
          <label><span class="seisan-mini-label">移動距離（km）</span><input type="number" inputmode="decimal" data-field="dist" class="${fieldErrorClass(issues, car.name, 'dist')}" value="${esc(cState.dist || '', helpers)}"></label>
          <label><span class="seisan-mini-label">燃費（km/L）</span><input type="number" inputmode="decimal" data-field="eco" class="${fieldErrorClass(issues, car.name, 'eco')}" value="${esc(cState.eco || '', helpers)}"></label>
          <label><span class="seisan-mini-label">ガソリン単価（円/L）</span><input type="number" inputmode="decimal" data-field="price" class="${fieldErrorClass(issues, car.name, 'price')}" value="${esc(cState.price || '', helpers)}"></label>
        </div>
        <div class="seisan-subhead"><strong>諸経費</strong></div>
        <div class="seisan-extra-list">
          ${extras.map((ex, i) => extraRow({ carName: car.name, ex, index: i, issues, helpers })).join('')}
        </div>
        <div class="seisan-add-row">
          <button class="seisan-btn" type="button" data-action="add-settlement-extra" data-driver-name="${encodeURIComponent(car.name)}"><i class="fas fa-plus me-1" aria-hidden="true"></i>諸経費を追加</button>
        </div>
    </div>`;
  }

  function cars({ data, state, result, issues, helpers = {} }) {
    if (!data.cars.length) return `<div class="seisan-empty">先に車出しを登録してください。</div>`;
    return data.cars.map(car => {
      const cState = helpers.getCarState(car, state);
      state.cars[car.name] = cState;
      const calc = result.cars.find(c => c.name === car.name) || { totalPay: 0, gas: 0, extras: [] };
      return carSummary({ car, calc, issues, helpers });
    }).join('');
  }

  function collection({ participants, state, result, helpers = {} }) {
    if (!participants.length) return `<div class="seisan-empty">名簿を登録すると表示されます。</div>`;
    return participants.map(p => {
      const excluded = !!result.excludedNames?.has?.(p.name);
      const paid = !!state.paid?.[p.name];
      const note = excluded
        ? (p.role === 'driver' ? '支払から差引' : (p.name === result.excludedName ? '対象外(企画者)' : '対象外'))
        : (p.role === 'waiting' ? '待機' : '');
      return `<label class="seisan-check-item ${paid ? 'paid' : ''} ${excluded ? 'excluded' : ''}">
            <input type="checkbox" ${paid ? 'checked' : ''} ${excluded ? 'disabled' : ''} data-settlement-paid-name="${encodeURIComponent(p.name)}">
            <span class="seisan-check-name">${esc(p.name, helpers)}</span>
            ${note ? `<span class="seisan-check-note">${note}</span>` : ''}
        </label>`;
    }).join('');
  }

  function driverPay({ result, state, helpers = {} }) {
    if (!result.cars.length) return `<div class="seisan-empty">車出しを登録すると表示されます。</div>`;
    return result.cars.map(car => {
      const done = !!state.driverPaid?.[car.name];
      const exParts = car.extras.length ? car.extras.map(ex => `${esc(ex.name || '費用', helpers)} ${money(ex.amountValue, helpers)}`) : ['追加なし'];
      if (car.collectionOffset) exParts.push({ op: '−', html: `集金 ${money(car.collectionOffset, helpers)}` });
      const exText = joinFormulaParts(exParts);
      return `<label class="seisan-driver-pay-row ${done ? 'done' : ''}">
            <span class="seisan-driver-name">${esc(car.name, helpers)}</span>
            <span class="seisan-driver-amount">${money(car.adjustedTotalPay ?? car.totalPay, helpers)}</span>
            <input type="checkbox" ${done ? 'checked' : ''} data-settlement-driver-paid-name="${encodeURIComponent(car.name)}">
            <span class="seisan-driver-detail">ガソリン代 ${money(car.gas, helpers)} / ${exText}</span>
        </label>`;
    }).join('');
  }

  function breakdown(result, helpers = {}) {
    return `
        <div class="seisan-break-row"><span>割勘対象</span><span>${money(result.totalSplit, helpers)}</span></div>
        <div class="seisan-break-row"><span>集金予定</span><span>${money(result.expectedCollected, helpers)}</span></div>
        <div class="seisan-break-row"><span>端数余り</span><span>${money(result.surplus, helpers)}</span></div>
        <div class="seisan-break-row"><span>部費から</span><span>${money(result.totalClub, helpers)}</span></div>
        <div class="seisan-break-row"><span>うち車出し協力代</span><span>${money(result.totalReward, helpers)}</span></div>
        <div class="seisan-break-row"><span>集金</span><span>-${money(result.totalDriverCollectionOffset, helpers)}</span></div>
        <div class="seisan-break-row"><span>支払い丸め</span><span>${money(result.totalDriverRound, helpers)}</span></div>`;
  }

  function emptyState() {
    return `<div class="empty-card">
            <i class="fas fa-paste" aria-hidden="true"></i>
            <strong>まずは参加者登録から</strong>
            <span>企画の参加者と車出しを登録すると、ここに精算画面が表示されます。</span>
            <button class="seisan-btn primary" type="button" data-action="open-batch">参加者登録を開く</button>
        </div>`;
  }

  function routePrivateOriginView() {
    return `<div class="route-private-view">
            <div class="route-private-saved"><i class="fas fa-lock" aria-hidden="true"></i>出発地：保存済み（編集で確認・変更）</div>
            <button class="seisan-btn" type="button" data-action="edit-route-private-origin">編集</button>
            <button class="seisan-btn" type="button" data-action="clear-route-private-origin">削除</button>
        </div>`;
  }

  function routePrivateOriginEdit(saved, helpers = {}) {
    return `<div class="route-private-edit">
        <input id="routePrivateOriginInput" class="route-private-input" type="text" value="${esc(saved, helpers)}" placeholder="例：イエローハイツ岡里 / 自宅" autocomplete="off">
        <button class="seisan-btn primary" type="button" data-action="save-route-private-origin">保存</button>
        <button class="seisan-btn" type="button" data-action="cancel-route-private-origin">戻る</button>
    </div>`;
  }

  function routeStopRow(value = '', index = 0, helpers = {}) {
    return `<div class="route-stop-row">
        <span class="route-stop-num" title="ドラッグで並び替え">${index + 1}</span>
        <input type="text" class="route-stop-input" value="${esc(value || '', helpers)}" placeholder="例：妙高山 集合場所">
        <button class="seisan-icon-btn route-stop-delete-btn" type="button" data-action="remove-route-stop" title="削除"><i class="fas fa-times" aria-hidden="true"></i></button>
    </div>`;
  }

  window.SanpoApp?.registerTemplates?.('settlement', {
    renderIssues,
    extraRow,
    summary,
    settingSummary,
    carSummary,
    carRow,
    cars,
    collection,
    driverPay,
    breakdown,
    emptyState,
    routePrivateOriginView,
    routePrivateOriginEdit,
    routeStopRow
  });
})();
