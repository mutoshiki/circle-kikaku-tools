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
    formatCostBadge,
    orderDriverRewardFirstForDisplay
  } = parts;

  function extraCandidateLabel(candidate, helpers = {}) {
    const type = typeof window.normalizeSettlementExtraType === 'function'
      ? window.normalizeSettlementExtraType(candidate.type)
      : candidate.type;
    const typeLabel = ({
      split: '割勘',
      club: '部費',
      'split-minus': '割勘 −',
      'club-minus': '部費 −'
    })[type] || '割勘';
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

  function structuredCostRow({ label, amount = 0, type = '', sign = '', rowType = 'detail' }, helpers = {}) {
    const numericAmount = Number(amount) || 0;
    const operator = sign || '';
    const formattedAmount = operator ? money(Math.abs(numericAmount), helpers) : money(numericAmount, helpers);
    const amountContent = rowType === 'section'
      ? ''
      : `<span class="seisan-amount-sign${operator ? '' : ' is-blank'}" aria-hidden="true">${operator || '＋'}</span>${formattedAmount}`;
    const emphasized = ['subtotal', 'total'].includes(rowType);
    return `<cds-structured-list-row condensed class="seisan-cost-structured-row seisan-cost-structured-row--${rowType}">
      <cds-structured-list-cell class="seisan-cost-name">${esc(label, helpers)}</cds-structured-list-cell>
      <cds-structured-list-cell class="seisan-cost-amount">${emphasized ? `<strong>${amountContent}</strong>` : amountContent}</cds-structured-list-cell>
    </cds-structured-list-row>`;
  }

  function structuredCostRows(calc, extras, helpers = {}) {
    const splitRows = [];
    const clubRows = [];
    const adjustmentSign = value => Number(value || 0) === 0 ? '' : (Number(value) < 0 ? '−' : '＋');
    if (!calc.usesTimesRental) {
      splitRows.push({ label: 'ガソリン代', amount: calc.gas || 0, type: 'split' });
    }
    extras.forEach(extra => {
      const rawAmount = Number(extra.amountValue ?? extra.amount ?? 0);
      const isMinus = rawAmount < 0 || String(extra.type || '').endsWith('-minus');
      const targetRows = String(extra.type || '').startsWith('club') ? clubRows : splitRows;
      targetRows.push({
        label: extra.name || '費用',
        amount: rawAmount,
        type: extra.type,
        sign: targetRows.length === 0 && !isMinus ? '' : (isMinus ? '−' : '＋')
      });
    });
    splitRows.push({ label: '端数調整', amount: calc.splitRound || 0, type: 'split', sign: adjustmentSign(calc.splitRound) });
    if (calc.collectionOffset) {
      splitRows.push({ label: '集金控除', amount: calc.collectionOffset, type: 'split', sign: '−' });
    }
    clubRows.push({ label: '端数調整', amount: calc.clubRound || 0, type: 'club', sign: adjustmentSign(calc.clubRound) });

    return {
      split: splitRows.map(row => structuredCostRow(row, helpers)).join(''),
      club: clubRows.map(row => structuredCostRow(row, helpers)).join(''),
      splitTotal: calc.adjustedSplitPay ?? calc.splitPay ?? 0,
      clubTotal: calc.adjustedClubPay ?? calc.clubPay ?? 0,
      total: structuredCostRow({ label: '合計', amount: calc.adjustedTotalPay ?? calc.totalPay ?? 0, rowType: 'total' }, helpers)
    };
  }

  function carSummary({ car, calc, issues, paid = false, helpers = {} }) {
    const rowClass = issues.rows.has(car.name) ? ' has-error' : '';
    const extras = orderDriverRewardFirstForDisplay(Array.isArray(calc.extras) ? calc.extras : []);
    const costDetails = structuredCostRows(calc, extras, helpers);
    return `<article class="seisan-car-summary-row ${UI_CLASS.surfaceCard}${rowClass}" data-driver-name="${esc(car.name, helpers)}">
        <div class="seisan-car-summary-headline">
          <strong class="seisan-car-summary-name">${esc(car.name, helpers)}車${calc.usesTimesRental ? '（レンタカー）' : ''}</strong>
          <cds-toggle class="seisan-car-payment-toggle" size="sm" ${paid ? 'toggled' : ''} data-settlement-driver-paid-name="${encodeURIComponent(car.name)}" label-text="" label-a="支払済み" label-b="未払い" aria-label="${esc(car.name, helpers)}車への支払い状態"></cds-toggle>
          <cds-button class="seisan-btn seisan-edit-btn" kind="ghost" size="md" type="button" data-action="open-settlement-car-edit" data-driver-name="${encodeURIComponent(car.name)}"><span data-carbon-icon="edit" slot="icon" aria-hidden="true"></span><span>編集</span></cds-button>
        </div>
        <cds-accordion class="seisan-car-accordion">
          <cds-accordion-item>
            <span slot="title" class="seisan-accordion-total"><span>割勘合計</span><strong>${money(costDetails.splitTotal, helpers)}</strong></span>
            <cds-structured-list condensed class="seisan-cost-structured-list" aria-label="費用内訳">
              <cds-structured-list-body>${costDetails.split}</cds-structured-list-body>
            </cds-structured-list>
          </cds-accordion-item>
          <cds-accordion-item>
            <span slot="title" class="seisan-accordion-total"><span>部費合計</span><strong>${money(costDetails.clubTotal, helpers)}</strong></span>
            <cds-structured-list condensed class="seisan-cost-structured-list" aria-label="部費の内訳">
              <cds-structured-list-body>${costDetails.club}</cds-structured-list-body>
            </cds-structured-list>
          </cds-accordion-item>
        </cds-accordion>
        <cds-structured-list condensed class="seisan-cost-structured-list seisan-cost-structured-list--total" aria-label="車ごとの支払い合計">
          <cds-structured-list-body>${costDetails.total}</cds-structured-list-body>
        </cds-structured-list>
    </article>`;
  }

  function gasSettingsPopover({ car, cState, issues, movementLabel, helpers = {} }) {
    const fieldErrorClass = helpers.fieldErrorClass || (() => '');
    const invalidAttr = (key, message) => fieldErrorClass(issues, car.name, key)
      ? ` invalid invalid-text="${message}" aria-invalid="true"`
      : '';
    const rentalType = cState.rentalType === 'times' ? 'times' : 'private';
    const privateFuelFields = rentalType === 'private'
      ? `<label class="seisan-fuel-field"><span class="seisan-mini-label">燃費（km/L）</span><cds-text-input type="number" size="md" inputmode="decimal" min="0" step="any" data-field="eco" class="${UI_CLASS.input} ${fieldErrorClass(issues, car.name, 'eco')}" value="${esc(cState.eco || '', helpers)}" placeholder="例：18" label="燃費（km/L）" hide-label${invalidAttr('eco', '0より大きい燃費を入力してください')}></cds-text-input></label>
          <label class="seisan-fuel-field"><span class="seisan-mini-label">ガソリン単価（円/L）</span><cds-text-input type="number" size="md" inputmode="decimal" min="0" step="any" data-field="price" class="${UI_CLASS.input} ${fieldErrorClass(issues, car.name, 'price')}" value="${esc(cState.price || '', helpers)}" placeholder="例：158" label="ガソリン単価（円/L）" hide-label${invalidAttr('price', '0より大きいガソリン単価を入力してください')}></cds-text-input></label>`
      : '';
    const helper = rentalType === 'times'
      ? '<p class="seisan-gas-settings-helper">移動距離からタイムズ移動料金を自動計算します。タイムズ時間料金は費用一覧で入力します。</p>'
      : '';
    return `<cds-popover class="seisan-gas-settings-popover" align="bottom" drop-shadow>
      <cds-icon-button class="seisan-gas-settings-trigger" kind="ghost" size="lg" type="button" data-action="open-settlement-gas-settings" data-driver-name="${encodeURIComponent(car.name)}" aria-expanded="false" aria-haspopup="dialog" aria-label="${movementLabel}の設定を開く"><span data-carbon-icon="settings--adjust" slot="icon" aria-hidden="true"></span></cds-icon-button>
      <cds-popover-content>
        <section id="settlementGasEditPanel" class="seisan-gas-settings-surface" role="dialog" aria-label="${movementLabel}の設定">
          <div class="seisan-gas-settings-panel-head">
            <h4>${movementLabel}の設定</h4>
            <cds-icon-button kind="ghost" size="lg" type="button" data-action="close-settlement-gas-settings" aria-label="設定を閉じる"><span data-carbon-icon="close" slot="icon" aria-hidden="true"></span></cds-icon-button>
          </div>
          <div class="seisan-gas-settings-fields">
            <cds-radio-button-group class="seisan-rental-type-group" data-field="rentalType" name="rental-type-${encodeURIComponent(car.name)}" value="${rentalType}" orientation="horizontal" legend-text="車両種別">
              <cds-radio-button value="private" label-text="自家用車"></cds-radio-button>
              <cds-radio-button value="times" label-text="レンタカー"></cds-radio-button>
            </cds-radio-button-group>
            ${helper}
            <div class="seisan-gas-field-row${rentalType === 'times' ? ' is-times' : ''}" role="group" aria-label="移動料金の計算条件">
              <label class="seisan-distance-field"><span class="seisan-mini-label">移動距離（km）</span><cds-text-input type="number" size="md" inputmode="decimal" min="0" step="any" data-field="dist" class="${UI_CLASS.input} ${fieldErrorClass(issues, car.name, 'dist')}" value="${esc(cState.dist || '', helpers)}" placeholder="例：186" label="移動距離（km）" hide-label${invalidAttr('dist', '0より大きい移動距離を入力してください')}></cds-text-input></label>
              ${privateFuelFields}
            </div>
            <cds-button class="seisan-distance-shortcut" kind="tertiary" size="lg" type="button" data-action="open-route-helper-shortcut"><span data-carbon-icon="roadmap" slot="icon" aria-hidden="true"></span><span>距離計算ツール</span></cds-button>
          </div>
        </section>
      </cds-popover-content>
    </cds-popover>`;
  }

  function carRow({ car, cState, calc, extras, extraCandidates = [], issues, helpers = {} }) {
    const usesTimesRental = cState.rentalType === 'times' || calc.usesTimesRental;
    const rowClass = `${issues.rows.has(car.name) ? ' has-error' : ''}${usesTimesRental ? ' is-times-rental' : ''}`;
    const standaloneIndex = Number.isInteger(car.standaloneIndex) ? car.standaloneIndex : null;
    const standaloneData = standaloneIndex == null ? '' : ` data-standalone-driver-index="${standaloneIndex}"`;
    const standaloneNameField = standaloneIndex == null ? '' : `<label class="seisan-standalone-driver-name-field"><span class="seisan-mini-label">車出し名</span><cds-text-input size="md" density="condensed" data-field="standaloneDriverName" value="${esc(car.name, helpers)}" placeholder="車出し${standaloneIndex + 1}" autocomplete="off" label="車出し名" hide-label></cds-text-input></label>`;
    const movementLabel = usesTimesRental ? 'タイムズ移動料金' : 'ガソリン代';
    const visibleExtras = extras.filter(ex => {
      const normalizedName = String(ex?.name || '').replace(/\s+/g, '');
      const isTimesDistance = normalizedName === 'タイムズ移動料金'
        || (typeof window.isTimesDistanceFeeExtra === 'function' && window.isTimesDistanceFeeExtra(ex));
      const isTimesTime = normalizedName === 'タイムズ時間料金';
      return usesTimesRental ? !isTimesDistance : !(isTimesDistance || isTimesTime);
    });
    return `<div class="seisan-car-row ${UI_CLASS.surfaceCard}${rowClass}" data-driver-name="${esc(car.name, helpers)}"${standaloneData}>
        ${standaloneNameField}
        <div class="seisan-cost-edit-list" role="group" aria-label="費用一覧">
          <div class="seisan-cost-edit-header" aria-hidden="true">
            <span>名目</span><span>金額</span><span>部費</span><span>操作</span>
          </div>
          <div class="seisan-cost-edit-row seisan-gas-cost-row">
            <div class="seisan-extra-field seisan-extra-field--name">
              <cds-text-input size="md" density="condensed" value="${movementLabel}" label="名目" hide-label readonly aria-readonly="true"></cds-text-input>
            </div>
            <div class="seisan-extra-field seisan-extra-field--amount seisan-calculated-amount-field" data-extra-amount-field>
              ${gasSettingsPopover({ car, cState, issues, movementLabel, helpers })}
            </div>
            <div class="seisan-fixed-cell" aria-label="部費にはしない">—</div>
            <div class="seisan-fixed-cell" aria-hidden="true">—</div>
          </div>
          <div class="seisan-extra-list">
            ${visibleExtras.map((ex, i) => extraRow({ carName: car.name, ex, index: i, issues, helpers })).join('')}
          </div>
        </div>
        <div class="seisan-add-row">
          <cds-button class="seisan-btn" kind="tertiary" size="lg" type="button" data-action="add-settlement-extra" data-driver-name="${encodeURIComponent(car.name)}"><span data-carbon-icon="add" slot="icon" aria-hidden="true"></span><span>費用を追加</span></cds-button>
        </div>
        ${extraCandidates.length ? `<div class="seisan-extra-candidates">
          <div class="seisan-extra-candidates-title"><span data-carbon-icon="idea" aria-hidden="true"></span>候補</div>
          <div class="seisan-extra-candidate-list">
            ${extraCandidates.map(candidate => `<cds-button class="seisan-extra-candidate-chip" kind="tertiary" size="md" type="button" data-action="add-settlement-extra-candidate" data-driver-name="${encodeURIComponent(car.name)}" data-extra-candidate="${encodeURIComponent(candidate.name)}" data-extra-amount="${encodeURIComponent(candidate.amount)}" data-extra-type="${candidate.type}"><span data-carbon-icon="add" slot="icon" aria-hidden="true"></span><span>${extraCandidateLabel(candidate, helpers)}</span></cds-button>`).join('')}
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