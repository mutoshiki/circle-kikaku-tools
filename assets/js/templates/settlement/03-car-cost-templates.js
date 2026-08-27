// Settlement car cost templates.
// These builders do not attach event handlers or mutate state; callers own all actions and state.
(function () {
  'use strict';

  const parts = window.SanpoApp?.settlementTemplateParts || {};
  const { UI_CLASS, esc, money, extraRow, orderDriverRewardFirstForDisplay } = parts;

  function extraCandidateLabel(candidate, helpers = {}) {
    const type = typeof window.normalizeSettlementExtraType === 'function'
      ? window.normalizeSettlementExtraType(candidate.type)
      : candidate.type;
    const typeLabel = ({ split: '割勘', club: '部費', 'split-minus': '割勘 −', 'club-minus': '部費 −' })[type] || '割勘';
    return `${esc(candidate.name, helpers)} ${money(candidate.amount, helpers)}（${typeLabel}）を追加`;
  }

  function renderIssues(issues, helpers = {}) {
    return (issues.messages || []).map(message => {
      const text = esc(message, helpers);
      const carName = String(message || '').match(/^(.+?)車の/)?.[1] || '';
      const guidance = message.includes('企画者を選ぶ');
      const action = carName
        ? `<cds-button class="seisan-alert-action" kind="ghost" size="lg" type="button" data-action="open-settlement-car-edit" data-driver-name="${encodeURIComponent(carName)}">該当車を編集</cds-button>`
        : '';
      return `<div class="seisan-alert-item${guidance ? ' is-guidance' : ''}">
        <cds-inline-notification kind="${guidance ? 'info' : 'error'}" low-contrast hide-close-button>
          <span slot="title">${guidance ? '設定を確認してください' : '入力内容を確認してください'}</span>
          <span slot="subtitle">${text}</span>
        </cds-inline-notification>${action}
      </div>`;
    }).join('');
  }

  function structuredCostRow({ label, amount = 0, sign = '', rowType = 'detail' }, helpers = {}) {
    const numericAmount = Number(amount) || 0;
    const operator = sign === '−' ? '−' : '';
    const formattedAmount = operator ? money(Math.abs(numericAmount), helpers) : money(numericAmount, helpers);
    const amountContent = rowType === 'section'
      ? ''
      : `<span class="seisan-amount-sign${operator ? '' : ' is-blank'}" aria-hidden="true">${operator || '−'}</span>${formattedAmount}`;
    const emphasized = ['subtotal', 'total'].includes(rowType);
    return `<cds-structured-list-row condensed class="seisan-cost-structured-row seisan-cost-structured-row--${rowType}">
      <cds-structured-list-cell class="seisan-cost-name">${esc(label, helpers)}</cds-structured-list-cell>
      <cds-structured-list-cell class="seisan-cost-amount">${emphasized ? `<strong>${amountContent}</strong>` : amountContent}</cds-structured-list-cell>
    </cds-structured-list-row>`;
  }

  function structuredCostRows(calc, extras, helpers = {}) {
    const splitRows = [];
    const clubRows = [];
    const adjustmentSign = value => Number(value || 0) < 0 ? '−' : '';
    const movementRows = calc.movementBaseType === 'club' ? clubRows : splitRows;
    movementRows.push({
      label: calc.usesTimesRental ? 'タイムズ移動料金' : 'ガソリン代',
      amount: calc.movementAmount ?? (calc.usesTimesRental ? calc.timesDistanceFee : calc.gas) ?? 0
    });
    extras.forEach(extra => {
      const rawAmount = Number(extra.amountValue ?? extra.amount ?? 0);
      const isMinus = rawAmount < 0 || String(extra.type || '').endsWith('-minus');
      const targetRows = String(extra.type || '').startsWith('club') ? clubRows : splitRows;
      targetRows.push({
        label: extra.name || '費用',
        amount: rawAmount,
        sign: isMinus ? '−' : ''
      });
    });
    splitRows.push({ label: '端数調整', amount: calc.splitRound || 0, sign: adjustmentSign(calc.splitRound) });
    if (calc.collectionOffset) {
      const driverCount = Number(calc.offsetDriverCount || 0);
      const label = driverCount > 1 && calc.collectionOffsetPerDriver
        ? `集金控除（運転手${driverCount}人 × ${money(calc.collectionOffsetPerDriver, helpers)}）`
        : '集金控除';
      splitRows.push({ label, amount: calc.collectionOffset, sign: '−' });
    }
    clubRows.push({ label: '端数調整', amount: calc.clubRound || 0, sign: adjustmentSign(calc.clubRound) });
    return {
      split: splitRows.map(row => structuredCostRow(row, helpers)).join(''),
      club: clubRows.map(row => structuredCostRow(row, helpers)).join(''),
      splitTotal: calc.adjustedSplitPay ?? calc.splitPay ?? 0,
      clubTotal: calc.adjustedClubPay ?? calc.clubPay ?? 0,
      total: structuredCostRow({ label: '合計', amount: calc.adjustedTotalPay ?? calc.totalPay ?? 0, rowType: 'total' }, helpers)
    };
  }

  function driverDisplayLabel(car, calc) {
    const names = Array.isArray(calc?.driverNames)
      ? calc.driverNames.filter(name => String(name || '').trim()).map(name => String(name).trim())
      : [];
    if (names.length === 1 && names[0] === String(car?.name || '').trim()) return `${names[0]}車`;
    if (names.length) return `${names.join('・')}（${String(car?.name || '').trim()}車）`;
    return `運転手未設定（${String(car?.name || '').trim()}車）`;
  }

  function carSummary({ car, calc, issues, paid = false, helpers = {} }) {
    const rowClass = issues.rows.has(car.name) ? ' has-error' : '';
    const extras = orderDriverRewardFirstForDisplay(Array.isArray(calc.extras) ? calc.extras : []);
    const costDetails = structuredCostRows(calc, extras, helpers);
    const driverLabel = driverDisplayLabel(car, calc);
    return `<article class="seisan-car-summary-row ${UI_CLASS.surfaceCard}${rowClass}" data-driver-name="${esc(car.name, helpers)}">
      <div class="seisan-car-summary-headline">
        <strong class="seisan-car-summary-name">${esc(driverLabel, helpers)}${calc.usesTimesRental ? '（レンタカー）' : ''}</strong>
        <div class="seisan-car-summary-actions">
          <cds-toggle class="seisan-car-payment-toggle" size="sm" ${paid ? 'toggled' : ''} data-settlement-driver-paid-name="${encodeURIComponent(car.name)}" label-text="" label-a="支払い済み" label-b="未払い" aria-label="${esc(driverLabel, helpers)}への支払い状態"></cds-toggle>
          <cds-button class="seisan-btn seisan-edit-btn" kind="ghost" size="md" type="button" data-action="open-settlement-car-edit" data-driver-name="${encodeURIComponent(car.name)}"><span data-carbon-icon="edit" slot="icon" aria-hidden="true"></span><span>編集</span></cds-button>
        </div>
      </div>
      <cds-accordion class="seisan-car-accordion">
        <cds-accordion-item><span slot="title" class="seisan-accordion-total"><span>割勘合計</span><strong>${money(costDetails.splitTotal, helpers)}</strong></span><cds-structured-list condensed class="seisan-cost-structured-list" aria-label="費用内訳"><cds-structured-list-body>${costDetails.split}</cds-structured-list-body></cds-structured-list></cds-accordion-item>
        <cds-accordion-item><span slot="title" class="seisan-accordion-total"><span>部費合計</span><strong>${money(costDetails.clubTotal, helpers)}</strong></span><cds-structured-list condensed class="seisan-cost-structured-list" aria-label="部費の内訳"><cds-structured-list-body>${costDetails.club}</cds-structured-list-body></cds-structured-list></cds-accordion-item>
      </cds-accordion>
      <cds-structured-list condensed class="seisan-cost-structured-list seisan-cost-structured-list--total" aria-label="車ごとの支払い合計"><cds-structured-list-body>${costDetails.total}</cds-structured-list-body></cds-structured-list>
    </article>`;
  }

  function gasSettingsModal({ car, cState, issues, movementLabel, helpers = {} }) {
    const fieldErrorClass = helpers.fieldErrorClass || (() => '');
    const invalidAttr = (key, message) => fieldErrorClass(issues, car.name, key)
      ? ` invalid invalid-text="${message}" aria-invalid="true"`
      : '';
    const rentalType = cState.rentalType === 'times' ? 'times' : 'private';
    const isTimes = rentalType === 'times';
    return `<cds-modal aria-label="${movementLabel}を設定" aria-labelledby="settlementGasEditModalTitle" class="app-modal app-modal--scroll settlement-gas-edit-modal" id="settlementGasEditModal" size="sm" has-scrolling-content data-driver-name="${encodeURIComponent(car.name)}">
      <cds-modal-header>
        <cds-modal-heading data-modal-primary-focus class="app-modal-heading" id="settlementGasEditModalTitle" tabindex="-1">${movementLabel}を設定</cds-modal-heading>
        <cds-modal-close-button close-button-label="閉じる" data-modal-close></cds-modal-close-button>
      </cds-modal-header>
      <cds-modal-body class="app-modal-body seisan-gas-settings-body" no-fade>
        <div id="settlementGasEditPanel" class="seisan-gas-settings-fields">
          <cds-radio-button-group class="seisan-rental-type-group" data-field="rentalType" name="rental-type-${encodeURIComponent(car.name)}" value="${rentalType}" orientation="horizontal" legend-text="車両種別">
            <cds-radio-button value="private" label-text="自家用車"></cds-radio-button>
            <cds-radio-button value="times" label-text="タイムズ"></cds-radio-button>
          </cds-radio-button-group>
          <p class="seisan-gas-settings-helper" data-times-helper ${isTimes ? '' : 'hidden'}>移動距離から移動料金を自動で計算できます。</p>
          <div class="seisan-gas-field-row${isTimes ? ' is-times' : ''}" role="group" aria-label="移動料金の計算条件">
            <label class="seisan-distance-field"><span class="seisan-mini-label">移動距離（km）</span><cds-text-input type="text" size="md" inputmode="numeric" pattern="[0-9]*" maxlength="4" data-field="dist" class="${UI_CLASS.input} ${fieldErrorClass(issues, car.name, 'dist')}" value="${esc(cState.dist || '', helpers)}" placeholder="例：186" label="移動距離（km）" hide-label${invalidAttr('dist', '0より大きい移動距離を入力してください')}></cds-text-input></label>
            <label class="seisan-fuel-field" data-private-fuel ${isTimes ? 'hidden' : ''}><span class="seisan-mini-label">燃費（km/L）</span><cds-text-input type="text" size="md" inputmode="numeric" pattern="[0-9]*" maxlength="4" data-field="eco" class="${UI_CLASS.input} ${fieldErrorClass(issues, car.name, 'eco')}" value="${esc(cState.eco || '', helpers)}" placeholder="例：18" label="燃費（km/L）" hide-label${invalidAttr('eco', '0より大きい燃費を入力してください')}></cds-text-input></label>
            <label class="seisan-fuel-field" data-private-fuel ${isTimes ? 'hidden' : ''}><span class="seisan-mini-label">ガソリン単価（円/L）</span><cds-text-input type="text" size="md" inputmode="numeric" pattern="[0-9]*" maxlength="4" data-field="price" class="${UI_CLASS.input} ${fieldErrorClass(issues, car.name, 'price')}" value="${esc(cState.price || '', helpers)}" placeholder="例：158" label="ガソリン単価（円/L）" hide-label${invalidAttr('price', '0より大きいガソリン単価を入力してください')}></cds-text-input></label>
          </div>
          <cds-button class="seisan-distance-shortcut" kind="tertiary" size="lg" type="button" data-action="open-route-helper-shortcut"><span data-carbon-icon="roadmap" slot="icon" aria-hidden="true"></span><span>距離計算ツール</span></cds-button>
        </div>
      </cds-modal-body>
      <cds-modal-footer class="app-modal-footer app-modal-footer--single"><cds-modal-footer-button data-modal-close kind="primary" type="button">完了</cds-modal-footer-button></cds-modal-footer>
    </cds-modal>`;
  }

  function carRow({ car, cState, calc, extras, extraCandidates = [], issues, helpers = {} }) {
    const usesTimesRental = cState.rentalType === 'times' || calc.usesTimesRental;
    const rowClass = `${issues.rows.has(car.name) ? ' has-error' : ''}${usesTimesRental ? ' is-times-rental' : ''}`;
    const standaloneIndex = Number.isInteger(car.standaloneIndex) ? car.standaloneIndex : null;
    const standaloneData = standaloneIndex == null ? '' : ` data-standalone-driver-index="${standaloneIndex}"`;
    const standaloneNameField = standaloneIndex == null ? '' : `<label class="seisan-standalone-driver-name-field"><span class="seisan-mini-label">運転手名</span><cds-text-input size="md" density="condensed" data-field="standaloneDriverName" value="${esc(car.name, helpers)}" placeholder="運転手${standaloneIndex + 1}" autocomplete="off" label="運転手名" hide-label></cds-text-input></label>`;
    const movementLabel = usesTimesRental ? 'タイムズ移動料金' : 'ガソリン代';
    const normalizedName = value => String(value || '').replace(/\s+/g, '').replace(/[（）()]/g, '');
    const movementSourceIndex = cState.extras.findIndex(ex => usesTimesRental
      ? (ex.timesFeeKind === 'distance' || normalizedName(ex.name) === 'タイムズ移動料金')
      : normalizedName(ex.name) === 'ガソリン代');
    const movementSource = movementSourceIndex >= 0 ? cState.extras[movementSourceIndex] : {};
    const movementType = typeof window.normalizeSettlementExtraType === 'function'
      ? window.normalizeSettlementExtraType(calc.movementType || movementSource.type || 'split')
      : (String(calc.movementType || movementSource.type || 'split').startsWith('club') ? 'club' : 'split');
    const movementClub = String(movementType).startsWith('club');
    const movementAmount = String(calc.movementAmount ?? (usesTimesRental ? calc.timesDistanceFee : calc.gas) ?? 0);
    const visibleExtras = extras
      .map((ex, index) => ({ ex, index }))
      .filter(({ ex }) => {
        const name = normalizedName(ex?.name);
        const isGasMovement = name === 'ガソリン代';
        const isTimesDistance = name === 'タイムズ移動料金'
          || (typeof window.isTimesDistanceFeeExtra === 'function' && window.isTimesDistanceFeeExtra(ex));
        const isTimesTime = name === 'タイムズ時間料金';
        return usesTimesRental ? !isTimesDistance && !isGasMovement : !(isGasMovement || isTimesDistance || isTimesTime);
      });
    const visibleCandidates = extraCandidates.filter(candidate => normalizedName(candidate?.name) !== 'ガソリン代');
    const movementTimesAttr = usesTimesRental ? ' data-times-extra="distance"' : '';
    return `<div class="seisan-car-row ${UI_CLASS.surfaceCard}${rowClass}" data-driver-name="${esc(car.name, helpers)}"${standaloneData}>
      ${standaloneNameField}
      <div class="seisan-cost-edit-list" role="group" aria-label="費用一覧">
        <div class="seisan-cost-edit-header" aria-hidden="true"><span>名目</span><span>金額</span><span>部費</span><span>操作</span></div>
        <div class="seisan-extra-row seisan-cost-edit-row seisan-gas-cost-row" data-extra-index="${Math.max(0, movementSourceIndex)}" data-extra-id="${esc(movementSource.id || '')}" data-movement-extra="${usesTimesRental ? 'distance' : 'gas'}"${movementTimesAttr}>
          <div class="seisan-extra-field seisan-extra-field--name"><cds-text-input size="md" density="condensed" data-extra-field="name" value="${movementLabel}" label="名目" hide-label readonly aria-readonly="true"></cds-text-input></div>
          <div class="seisan-extra-field seisan-extra-field--amount seisan-calculated-amount-field" data-extra-amount-field>
            <cds-text-input class="seisan-calculated-amount-input" type="text" size="md" density="condensed" inputmode="numeric" data-extra-field="amount" value="${esc(movementAmount, helpers)}" label="金額" hide-label readonly aria-readonly="true" aria-label="${movementLabel}は設定から自動計算されます"></cds-text-input>
          </div>
          <div class="seisan-extra-field seisan-extra-field--type ${movementClub ? 'club' : 'split'} ${movementClub ? 'club' : 'split'}">
            <cds-toggle size="sm" hide-label data-extra-field="type" data-extra-negative="false" value="${movementClub ? 'club' : 'split'}" ${movementClub ? 'toggled' : ''} class="seisan-extra-type ${UI_CLASS.input} ${movementClub ? 'club' : 'split'}" label-text="" label-a="" label-b="" aria-label="${movementLabel}を部費で処理"></cds-toggle>
          </div>
          <div class="seisan-extra-field seisan-extra-field--action"><cds-icon-button class="seisan-icon-btn seisan-gas-settings-trigger" kind="ghost" size="lg" type="button" data-action="open-settlement-gas-settings" data-driver-name="${encodeURIComponent(car.name)}" aria-haspopup="dialog" aria-controls="settlementGasEditModal" aria-label="${movementLabel}の設定を開く"><span data-carbon-icon="settings--adjust" slot="icon" aria-hidden="true"></span></cds-icon-button></div>
        </div>
        <div class="seisan-extra-list">${visibleExtras.map(({ ex, index }) => extraRow({ carName: car.name, ex, index, issues, helpers })).join('')}</div>
      </div>
      <div class="seisan-add-row"><cds-button class="seisan-btn" kind="tertiary" size="lg" type="button" data-action="add-settlement-extra" data-driver-name="${encodeURIComponent(car.name)}"><span data-carbon-icon="add" slot="icon" aria-hidden="true"></span><span>費用を追加</span></cds-button></div>
      ${visibleCandidates.length ? `<div class="seisan-extra-candidates"><div class="seisan-extra-candidates-title"><span data-carbon-icon="idea" aria-hidden="true"></span>候補</div><div class="seisan-extra-candidate-list">${visibleCandidates.map(candidate => `<cds-button class="seisan-extra-candidate-chip" kind="tertiary" size="md" type="button" data-action="add-settlement-extra-candidate" data-driver-name="${encodeURIComponent(car.name)}" data-extra-candidate="${encodeURIComponent(candidate.name)}" data-extra-amount="${encodeURIComponent(candidate.amount)}" data-extra-type="${candidate.type}"><span data-carbon-icon="add" slot="icon" aria-hidden="true"></span><span>${extraCandidateLabel(candidate, helpers)}</span></cds-button>`).join('')}</div></div>` : ''}
      ${gasSettingsModal({ car, cState, issues, movementLabel, helpers })}
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
