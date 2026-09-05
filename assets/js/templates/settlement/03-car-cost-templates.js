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
      const guidance = message.includes('企画者を選ぶ');
      return `<cds-inline-notification kind="${guidance ? 'info' : 'error'}" low-contrast hide-close-button>
        <span slot="title">${guidance ? '設定を確認してください' : '入力内容を確認してください'}</span>
        <span slot="subtitle">${text}</span>
      </cds-inline-notification>`;
    }).join('');
  }

  function carIssueNotification(carName, issues, helpers = {}) {
    const message = (issues.messages || []).find(item => String(item || '').startsWith(`${carName}車の`));
    if (!message) return '';
    const raw = String(message);
    const gasMatch = raw.match(/^.+?車のガソリン代を計算するため、(.+?)を入力してください。$/);
    const timesMatch = raw.match(/^.+?車のタイムズ移動料金を計算するため、(.+?)を入力してください。$/);
    const title = gasMatch || timesMatch ? 'ガソリン代を計算できません' : '車の費用を確認できません';
    const subtitle = gasMatch || timesMatch
      ? `${carName}車：${(gasMatch || timesMatch)[1]}を入力してください。`
      : `${carName}車：${raw.replace(`${carName}車の`, '')}`;
    const actionLabel = `${carName}車を編集`;
    // Carbon Boolean attributes are enabled by presence; a string "false" still enables focus.
    // Settlement renderer disables notification focus centrally after mounting it.
    return `<cds-actionable-notification class="seisan-car-issue" inline kind="error" low-contrast hide-close-button>
      <span slot="title">${esc(title, helpers)}</span>
      <span slot="subtitle">${esc(subtitle, helpers)}</span>
      <cds-actionable-notification-button slot="action" kind="ghost" type="button" data-action="open-settlement-car-edit" data-driver-name="${encodeURIComponent(carName)}">${esc(actionLabel, helpers)}</cds-actionable-notification-button>
    </cds-actionable-notification>`;
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
    const driverNames = Array.isArray(calc.driverNames) ? calc.driverNames.filter(Boolean) : [];
    const vehicleLabel = `${String(car.name || '').trim()}車${calc.usesTimesRental ? '（レンタカー）' : ''}`;
    const driversText = driverNames.length ? driverNames.join('、') : '未設定';
    const multipleDriverNote = driverNames.length > 1 ? '（車単位で一括支払い）' : '';
    return `<article class="seisan-car-summary-row ${UI_CLASS.surfaceCard}${rowClass}" data-driver-name="${esc(car.name, helpers)}">
      ${carIssueNotification(car.name, issues, helpers)}
      <div class="seisan-car-summary-main">
        <div class="seisan-car-summary-identity">
          <strong class="seisan-car-summary-name">${esc(vehicleLabel, helpers)}</strong>
          <span class="seisan-car-driver-names">運転手：${esc(driversText, helpers)}${multipleDriverNote}</span>
          <div class="seisan-car-payment-amount"><span>この車への支払額</span><strong>${money(calc.adjustedTotalPay ?? calc.totalPay ?? 0, helpers)}</strong></div>
        </div>
        <div class="seisan-car-summary-controls">
          <div class="seisan-car-payment-check" data-carbon-checkbox-row>
            <cds-checkbox ${paid ? 'checked' : ''} data-settlement-driver-paid-name="${encodeURIComponent(car.name)}" label-text="${paid ? '支払済み' : '未払い'}" aria-label="${esc(vehicleLabel, helpers)}を${paid ? '支払い済みから未払いに戻す' : '支払い済みにする'}"></cds-checkbox>
          </div>
          <cds-button class="seisan-btn seisan-edit-btn" kind="ghost" size="lg" type="button" data-action="open-settlement-car-edit" data-driver-name="${encodeURIComponent(car.name)}"><span>費用を編集</span></cds-button>
        </div>
      </div>
      <cds-accordion class="seisan-car-accordion">
        <cds-accordion-item><span slot="title" class="seisan-payment-detail-title"><span>内訳を表示</span><span class="seisan-payment-detail-meta">割勘 ${money(costDetails.splitTotal, helpers)}・部費 ${money(costDetails.clubTotal, helpers)}</span></span><div class="seisan-payment-breakdown"><div><strong>割勘</strong><cds-structured-list condensed class="seisan-cost-structured-list" aria-label="割勘費用の内訳"><cds-structured-list-body>${costDetails.split}</cds-structured-list-body></cds-structured-list></div><div><strong>部費</strong><cds-structured-list condensed class="seisan-cost-structured-list" aria-label="部費の内訳"><cds-structured-list-body>${costDetails.club}</cds-structured-list-body></cds-structured-list></div></div></cds-accordion-item>
      </cds-accordion>
    </article>`;
  }

  function gasSettingsModal({ car, cState, issues, movementLabel, helpers = {} }) {
    const fieldErrorClass = helpers.fieldErrorClass || (() => '');
    const invalidAttr = (key, message) => fieldErrorClass(issues, car.name, key)
      ? ` invalid invalid-text="${message}" aria-invalid="true"`
      : '';
    const rentalType = cState.rentalType === 'times' ? 'times' : 'private';
    const isTimes = rentalType === 'times';
    const distance = Number(cState.dist) || 0;
    const fuelEconomy = Number(cState.eco) || 0;
    const fuelPrice = Number(cState.price) || 0;
    const calculatedAmount = isTimes
      ? (typeof window.getTimesDistanceFee === 'function' ? window.getTimesDistanceFee(cState.dist) : 0)
      : (distance > 0 && fuelEconomy > 0 && fuelPrice > 0 ? Math.round((distance / fuelEconomy) * fuelPrice) : 0);
    const calculationLabel = isTimes ? '計算した移動料金' : '計算したガソリン代';
    const calculationFormula = isTimes
      ? (distance > 0 ? `移動距離 ${distance.toLocaleString('ja-JP')}km` : '移動距離を入力してください')
      : (distance > 0 && fuelEconomy > 0 && fuelPrice > 0
        ? `${distance.toLocaleString('ja-JP')}km ÷ ${fuelEconomy.toLocaleString('ja-JP')}km/L × ${fuelPrice.toLocaleString('ja-JP')}円/L`
        : '移動距離・燃費・ガソリン単価を入力してください');
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
            <div class="seisan-distance-field"><label><span class="seisan-mini-label">移動距離（km）</span><cds-text-input type="text" size="md" inputmode="numeric" pattern="[0-9]*" maxlength="4" data-field="dist" class="${UI_CLASS.input} ${fieldErrorClass(issues, car.name, 'dist')}" value="${esc(cState.dist || '', helpers)}" placeholder="例：186" label="移動距離（km）" hide-label${invalidAttr('dist', '移動距離を入力してください')}></cds-text-input></label><cds-button class="seisan-distance-shortcut" kind="tertiary" size="lg" type="button" data-action="open-route-helper-shortcut"><span data-carbon-icon="roadmap" slot="icon" aria-hidden="true"></span><span>ルートから距離を計算</span></cds-button></div>
            <label class="seisan-fuel-field" data-private-fuel ${isTimes ? 'hidden' : ''}><span class="seisan-mini-label">燃費（km/L）</span><cds-text-input type="text" size="md" inputmode="numeric" pattern="[0-9]*" maxlength="4" data-field="eco" class="${UI_CLASS.input} ${fieldErrorClass(issues, car.name, 'eco')}" value="${esc(cState.eco || '', helpers)}" placeholder="例：18" label="燃費（km/L）" hide-label${invalidAttr('eco', '燃費を入力してください')}></cds-text-input></label>
            <label class="seisan-fuel-field" data-private-fuel ${isTimes ? 'hidden' : ''}><span class="seisan-mini-label">ガソリン単価（円/L）</span><cds-text-input type="text" size="md" inputmode="numeric" pattern="[0-9]*" maxlength="4" data-field="price" class="${UI_CLASS.input} ${fieldErrorClass(issues, car.name, 'price')}" value="${esc(cState.price || '', helpers)}" placeholder="例：158" label="ガソリン単価（円/L）" hide-label${invalidAttr('price', 'ガソリン単価を入力してください')}></cds-text-input></label>
          </div>
          <div class="seisan-gas-calculation-preview" data-gas-calculation-preview aria-live="polite"><span data-gas-calculation-label>${calculationLabel}</span><strong data-gas-calculation-amount>${money(calculatedAmount, helpers)}</strong><small data-gas-calculation-formula>${calculationFormula}</small></div>
        </div>
      </cds-modal-body>
      <cds-modal-footer class="app-modal-footer app-modal-footer--single"><cds-modal-footer-button data-modal-close kind="primary" type="button">ガソリン代を適用</cds-modal-footer-button></cds-modal-footer>
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
      <div class="seisan-cost-edit-list" role="table" aria-label="費用一覧">
        <div class="seisan-cost-edit-header" role="row"><span role="columnheader">名目</span><span role="columnheader">金額</span><span role="columnheader">負担区分</span><span role="columnheader">操作</span></div>
        <div class="seisan-extra-row seisan-cost-edit-row seisan-gas-cost-row" role="row" data-extra-index="${Math.max(0, movementSourceIndex)}" data-extra-id="${esc(movementSource.id || '')}" data-movement-extra="${usesTimesRental ? 'distance' : 'gas'}"${movementTimesAttr}>
          <div class="seisan-extra-field seisan-extra-field--name" role="cell"><span class="seisan-cost-field-label">名目</span><cds-text-input size="md" density="condensed" data-extra-field="name" value="${movementLabel}" label="名目" hide-label readonly aria-readonly="true"></cds-text-input></div>
          <div class="seisan-extra-field seisan-extra-field--amount seisan-calculated-amount-field" role="cell" data-extra-amount-field>
            <span class="seisan-cost-field-label">金額</span><div class="seisan-amount-control"><cds-text-input class="seisan-calculated-amount-input" type="text" size="md" density="condensed" inputmode="numeric" data-extra-field="amount" value="${esc(movementAmount, helpers)}" label="金額" hide-label readonly aria-readonly="true" aria-label="${movementLabel}は設定から自動計算されます"></cds-text-input><span class="seisan-amount-unit" aria-hidden="true">円</span></div><cds-tag class="seisan-auto-status" type="cool-gray" size="sm">自動計算</cds-tag>
          </div>
          <div class="seisan-extra-field seisan-extra-field--type ${movementClub ? 'club' : 'split'} ${movementClub ? 'club' : 'split'}" role="cell">
            <span class="seisan-cost-field-label">負担区分</span><cds-radio-button-group class="seisan-extra-type ${UI_CLASS.input} ${movementClub ? 'club' : 'split'}" data-extra-field="type" data-extra-negative="false" name="settlement-movement-type-${encodeURIComponent(car.name)}" value="${movementClub ? 'club' : 'split'}" orientation="horizontal" legend-text="" aria-label="${esc(movementLabel, helpers)}の負担区分"><cds-radio-button value="split" label-text="割勘"></cds-radio-button><cds-radio-button value="club" label-text="部費"></cds-radio-button></cds-radio-button-group>
          </div>
          <div class="seisan-extra-field seisan-extra-field--action" role="cell"><cds-button class="seisan-gas-settings-trigger" kind="ghost" size="md" type="button" data-action="open-settlement-gas-settings" data-driver-name="${encodeURIComponent(car.name)}" aria-haspopup="dialog" aria-controls="settlementGasEditModal"><span data-carbon-icon="settings--adjust" slot="icon" aria-hidden="true"></span>計算条件を変更</cds-button></div>
        </div>
        <div class="seisan-extra-list" role="rowgroup">${visibleExtras.map(({ ex, index }) => extraRow({ carName: car.name, ex, index, issues, helpers })).join('')}</div>
      </div>
      <div class="seisan-add-row"><cds-button class="seisan-btn" kind="tertiary" size="lg" type="button" data-action="add-settlement-extra" data-driver-name="${encodeURIComponent(car.name)}"><span data-carbon-icon="add" slot="icon" aria-hidden="true"></span><span>費用を追加</span></cds-button></div>
      ${visibleCandidates.length ? `<cds-accordion class="seisan-extra-candidates" alignment="end" aria-label="登録済みの費用から追加"><cds-accordion-item><span slot="title" class="seisan-extra-candidates-title"><span data-carbon-icon="idea" aria-hidden="true"></span>登録済みの費用から追加（${visibleCandidates.length}件）</span><div class="seisan-extra-candidate-list">${visibleCandidates.map(candidate => `<cds-button class="seisan-extra-candidate-chip" kind="ghost" size="md" type="button" data-action="add-settlement-extra-candidate" data-driver-name="${encodeURIComponent(car.name)}" data-extra-candidate="${encodeURIComponent(candidate.name)}" data-extra-amount="${encodeURIComponent(candidate.amount)}" data-extra-type="${candidate.type}"><span data-carbon-icon="add" slot="icon" aria-hidden="true"></span><span>${extraCandidateLabel(candidate, helpers)}</span></cds-button>`).join('')}</div></cds-accordion-item></cds-accordion>` : ''}
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
