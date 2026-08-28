// Settlement extra-cost input templates.
(function () {
  'use strict';

  const parts = window.SanpoApp?.settlementTemplateParts || {};
  const { UI_CLASS, esc } = parts;

  function normalizeExtraName(value = '') {
    return String(value || '').replace(/\s+/g, '').replace(/[（）()]/g, '');
  }

  function getTimesFeeKind(ex = {}) {
    if (ex.timesFeeKind === 'time' || normalizeExtraName(ex.name) === 'タイムズ時間料金') return 'time';
    if (ex.timesFeeKind === 'distance' || normalizeExtraName(ex.name) === 'タイムズ移動料金') return 'distance';
    return '';
  }

  function isDriverRewardExtra(ex = {}) {
    const name = normalizeExtraName(ex.name);
    return ['車出し協力代', '車出し協力代1台', '運転協力代', '運転協力代1台', '協力代'].includes(name);
  }

  function extraRow({ carName, ex, index, issues, helpers = {} }) {
    const timesFeeKind = getTimesFeeKind(ex);
    const isReward = isDriverRewardExtra(ex);
    const type = typeof window.normalizeSettlementExtraType === 'function'
      ? window.normalizeSettlementExtraType(ex.type)
      : (['club', 'club-minus', 'split-minus'].includes(ex.type) ? ex.type : 'split');
    const baseType = type.startsWith('club') ? 'club' : 'split';
    const isNegative = type.endsWith('-minus');
    const extraFieldErrorClass = helpers.extraFieldErrorClass || (() => '');
    const validationActive = !!issues?.rows?.has?.(carName);
    const pendingFieldInvalid = key => validationActive && ex.pending === true && !String(ex[key] ?? '').trim();
    const fieldInvalid = key => !!extraFieldErrorClass(issues, carName, index, key) || pendingFieldInvalid(key);
    const invalidAttr = (key, message) => fieldInvalid(key)
      ? ` invalid invalid-text="${message}" aria-invalid="true"`
      : '';
    const inputClass = key => fieldInvalid(key) ? ' seisan-input-error' : '';
    const rowClass = [
      'seisan-extra-row',
      'seisan-cost-edit-row',
      timesFeeKind === 'time' ? 'seisan-extra-row--times-time' : '',
      timesFeeKind === 'distance' ? 'seisan-extra-row--times-distance' : '',
      isReward ? 'seisan-extra-row--reward' : ''
    ].filter(Boolean).join(' ');
    const timesAttr = timesFeeKind ? ` data-times-extra="${timesFeeKind}"` : '';
    const pendingAttr = ex.pending === true ? ' data-extra-pending="true"' : '';
    const fixedName = !!timesFeeKind || isReward;
    const nameLockedAttr = fixedName ? ' readonly aria-readonly="true"' : '';
    const amountLockedAttr = isReward ? ' readonly aria-readonly="true"' : '';
    const costName = esc(ex.name || '諸経費', helpers);
    const deleteControl = timesFeeKind
      ? ''
      : isReward
        ? `<cds-icon-button class="seisan-icon-btn" kind="danger--ghost" size="lg" type="button" disabled aria-label="${costName}は削除できません"><span data-carbon-icon="trash-can" slot="icon" aria-hidden="true"></span></cds-icon-button>`
        : `<cds-icon-button class="seisan-icon-btn" kind="danger--ghost" size="lg" type="button" data-action="remove-settlement-extra" aria-label="${costName}を削除"><span data-carbon-icon="trash-can" slot="icon" aria-hidden="true"></span></cds-icon-button>`;
    const typeLocked = isReward;

    return `<div class="${rowClass}" role="row" data-extra-index="${index}" data-extra-id="${esc(ex.id || '')}"${timesAttr}${pendingAttr}>
        <div class="seisan-extra-field seisan-extra-field--name" role="cell">
          <cds-text-input size="md" density="condensed" data-extra-field="name" class="${inputClass('name')}" value="${esc(ex.name || '', helpers)}" placeholder="例：駐車場代" label="名目" hide-label${invalidAttr('name', '名目を入力してください')}${nameLockedAttr}></cds-text-input>
        </div>
        <div class="seisan-extra-field seisan-extra-field--amount" role="cell" data-extra-amount-field>
          <span class="seisan-mobile-currency" aria-hidden="true">¥</span><cds-text-input type="text" size="md" density="condensed" inputmode="numeric" pattern="[0-9]*" maxlength="4" data-extra-field="amount" class="${inputClass('amount')}" value="${esc(ex.amount || '', helpers)}" placeholder="金額" label="金額" hide-label${invalidAttr('amount', '金額を入力してください')}${amountLockedAttr}></cds-text-input>
        </div>
        <div class="seisan-extra-field seisan-extra-field--type ${baseType} ${type}" role="cell">
          <cds-radio-button-group class="seisan-extra-type ${UI_CLASS.input} ${baseType} ${type}" data-extra-field="type" data-extra-negative="${isNegative ? 'true' : 'false'}" name="settlement-extra-type-${encodeURIComponent(carName)}-${index}" value="${baseType}" orientation="horizontal" legend-text="" aria-label="${typeLocked ? `${costName}の負担区分は変更できません` : `${costName}の負担区分`}" ${typeLocked ? 'disabled' : ''}><cds-radio-button value="split" label-text="割勘" ${typeLocked ? 'disabled' : ''}></cds-radio-button><cds-radio-button value="club" label-text="部費" ${typeLocked ? 'disabled' : ''}></cds-radio-button></cds-radio-button-group>
        </div>
        <div class="seisan-extra-field seisan-extra-field--action" role="cell">${deleteControl}</div>
    </div>`;
  }

  Object.assign(parts, { extraRow });
})();
