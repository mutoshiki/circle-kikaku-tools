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
    // Legacy semantic sequence retained in documentation while the UI now uses
    // one neutral Carbon accordion: 割勘による内訳 / 割勘合計 / 部費による内訳 / 部費合計 / 支払い合計.
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

    function carRow({ car, cState, calc, extras, extraCandidates = [], issues, helpers = {} }) {
    const fieldErrorClass = helpers.fieldErrorClass || (() => '');
    const invalidAttr = (key, message) => fieldErrorClass(issues, car.name, key) ? ` invalid invalid-text="${message}" aria-invalid="true"` : '';
    const usesTimesRental = cState.rentalType === 'times' || calc.usesTimesRental;
    const rowClass = `${issues.rows.has(car.name) ? ' has-error' : ''}${usesTimesRental ? ' is-times-rental' : ''}`;
    const offsetText = calc.collectionOffset ? ` / 車出し分 -${money(calc.collectionOffset, helpers)}` : '';
    const fuelText = usesTimesRental ? 'タイムズ' : `ガソリン代 ${money(calc.gas || 0, helpers)}`;
    const details = `${fuelText} / 諸経費 ${money((calc.splitExtras || 0) + (calc.clubExtras || 0), helpers)}${offsetText}`;
    const standaloneIndex = Number.isInteger(car.standaloneIndex) ? car.standaloneIndex : null;
    const standaloneData = standaloneIndex == null ? '' : ` data-standalone-driver-index="${standaloneIndex}"`;
    const standaloneNameField = standaloneIndex == null ? '' : `<label class="seisan-standalone-driver-name-field"><span class="seisan-mini-label">車出し名</span><cds-text-input size="md" density="condensed" data-field="standaloneDriverName" value="${esc(car.name, helpers)}" placeholder="車出し${standaloneIndex + 1}" autocomplete="off" label="車出し名" hide-label></cds-text-input></label>`;
    const rentalType = usesTimesRental ? 'times' : 'private';
    return `<div class="seisan-car-row ${UI_CLASS.surfaceCard}${rowClass}" data-driver-name="${esc(car.name, helpers)}"${standaloneData}>
        ${standaloneNameField}
        <div class="seisan-gas-section-head">
          <div class="seisan-subhead seisan-subhead--gas"><strong>ガソリン代</strong></div>
          <cds-radio-button-group class="seisan-rental-type-group" data-field="rentalType" name="rental-type-${encodeURIComponent(car.name)}" value="${rentalType}" orientation="horizontal" legend-text="車両種別">
            <cds-radio-button value="private" label-text="自家用車"></cds-radio-button>
            <cds-radio-button value="times" label-text="レンタカー（タイムズ）"></cds-radio-button>
          </cds-radio-button-group>
        </div>
        <div class="seisan-car-inputs">
          <div class="seisan-gas-field-row" role="group" aria-label="ガソリン代の計算条件">
            <label class="seisan-distance-field"><span class="seisan-mini-label">移動距離（km）</span><cds-text-input type="number" size="md" density="condensed" inputmode="decimal" min="0" step="any" data-field="dist" class="${UI_CLASS.input} ${fieldErrorClass(issues, car.name, 'dist')}" value="${esc(cState.dist || '', helpers)}" placeholder="例：186" label="移動距離（km）" hide-label${invalidAttr('dist', '0より大きい移動距離を入力してください')}></cds-text-input></label>
            <label class="seisan-fuel-field"><span class="seisan-mini-label">燃費（km/L）</span><cds-text-input type="number" size="md" density="condensed" inputmode="decimal" min="0" step="any" data-field="eco" class="${UI_CLASS.input} ${fieldErrorClass(issues, car.name, 'eco')}" value="${esc(cState.eco || '', helpers)}" placeholder="例：18" label="燃費（km/L）" hide-label${invalidAttr('eco', '0より大きい燃費を入力してください')}></cds-text-input></label>
            <label class="seisan-fuel-field"><span class="seisan-mini-label">ガソリン単価（円/L）</span><cds-text-input type="number" size="md" density="condensed" inputmode="decimal" min="0" step="any" data-field="price" class="${UI_CLASS.input} ${fieldErrorClass(issues, car.name, 'price')}" value="${esc(cState.price || '', helpers)}" placeholder="例：158" label="ガソリン単価（円/L）" hide-label${invalidAttr('price', '0より大きいガソリン単価を入力してください')}></cds-text-input></label>
          </div>
          <a class="seisan-distance-shortcut" href="#route-distance-helper" data-action="open-route-helper-shortcut" aria-label="距離計算ツールを開く"><span>距離計算ツール</span><span data-carbon-icon="launch" aria-hidden="true"></span></a>
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
