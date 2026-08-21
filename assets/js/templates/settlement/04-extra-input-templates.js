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
    const invalidAttr = (key, message) => extraFieldErrorClass(issues, carName, index, key)
      ? ` invalid invalid-text="${message}" aria-invalid="true"`
      : '';
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
    const deleteControl = timesFeeKind || isReward
      ? '<span class="seisan-icon-btn seisan-extra-delete-placeholder" aria-hidden="true"></span>'
      : `<cds-icon-button class="seisan-icon-btn" kind="danger--ghost" size="lg" type="button" data-action="remove-settlement-extra" aria-label="${costName}を削除"><span data-carbon-icon="trash-can" slot="icon" aria-hidden="true"></span></cds-icon-button>`;

    return `<div class="${rowClass}" data-extra-index="${index}" data-extra-id="${esc(ex.id || '')}"${timesAttr}${pendingAttr}>
        <div class="seisan-extra-field seisan-extra-field--name">
          <cds-text-input size="md" density="condensed" data-extra-field="name" class="${extraFieldErrorClass(issues, carName, index, 'name')}" value="${esc(ex.name || '', helpers)}" placeholder="例：駐車場代" label="名目" hide-label${invalidAttr('name', '名目を入力してください')}${nameLockedAttr}></cds-text-input>
        </div>
        <div class="seisan-extra-field seisan-extra-field--amount" data-extra-amount-field>
          <cds-text-input type="text" size="md" density="condensed" inputmode="numeric" pattern="[0-9]*" maxlength="4" data-extra-field="amount" class="${extraFieldErrorClass(issues, carName, index, 'amount')}" value="${esc(ex.amount || '', helpers)}" placeholder="金額" label="金額" hide-label${invalidAttr('amount', '金額を入力してください')}${amountLockedAttr}></cds-text-input>
        </div>
        <div class="seisan-extra-field seisan-extra-field--type ${baseType} ${type}">
          <cds-toggle size="sm" data-extra-field="type" data-extra-negative="${isNegative ? 'true' : 'false'}" value="${type}" ${baseType === 'club' ? 'toggled' : ''} class="seisan-extra-type ${UI_CLASS.input} ${baseType} ${type}" label-text="" label-a="" label-b="" aria-label="${costName}を部費で処理"></cds-toggle>
        </div>
        <div class="seisan-extra-field seisan-extra-field--action">${deleteControl}</div>
    </div>`;
  }

  Object.assign(parts, { extraRow });
})();
