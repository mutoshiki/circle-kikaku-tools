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
    const type = typeof window.normalizeSettlementExtraType === 'function' ? window.normalizeSettlementExtraType(ex.type) : (['club', 'club-minus', 'split-minus'].includes(ex.type) ? ex.type : 'split');
    const baseType = type.startsWith('club') ? 'club' : 'split';
    const extraFieldErrorClass = helpers.extraFieldErrorClass || (() => '');
    const invalidAttr = (key, message) => extraFieldErrorClass(issues, carName, index, key) ? ` invalid invalid-text="${message}" aria-invalid="true"` : '';
    const rowClass = [
      'seisan-extra-row',
      timesFeeKind === 'time' ? 'seisan-extra-row--times-time' : '',
      timesFeeKind === 'distance' ? 'seisan-extra-row--times-distance' : '',
      isReward ? 'seisan-extra-row--reward' : '',
      index === 0 ? 'seisan-extra-row--labeled' : ''
    ].filter(Boolean).join(' ');
    const timesAttr = timesFeeKind ? ` data-times-extra="${timesFeeKind}"` : '';
    const pendingAttr = ex.pending === true ? ' data-extra-pending="true"' : '';
    const lockedAttr = isReward ? ' readonly aria-readonly="true"' : '';
    const deleteControl = timesFeeKind || isReward
      ? '<span class="seisan-icon-btn seisan-extra-delete-placeholder" aria-hidden="true"></span>'
      : '<cds-icon-button class="seisan-icon-btn" kind="danger--ghost" size="lg" type="button" data-action="remove-settlement-extra" aria-label="削除"><span data-carbon-icon="trash-can" slot="icon" aria-hidden="true"></span></cds-icon-button>';
    const showColumnLabels = index === 0;
    const columnLabel = text => showColumnLabels ? `<span class="seisan-extra-field-label">${text}</span>` : '';

    return `<div class="${rowClass}" data-extra-index="${index}"${timesAttr}${pendingAttr}>
        <div class="seisan-extra-field seisan-extra-field--name">
          ${columnLabel('名目')}
          <cds-text-input size="lg" data-extra-field="name" class="${extraFieldErrorClass(issues, carName, index, 'name')}" value="${esc(ex.name || '', helpers)}" placeholder="例：駐車場代" label="名目" hide-label${invalidAttr('name', '名目を入力してください')}${lockedAttr}></cds-text-input>
        </div>
        <label class="seisan-extra-field seisan-extra-field--amount" data-extra-amount-field>
          ${columnLabel('金額')}
          <cds-text-input type="text" size="lg" density="condensed" inputmode="numeric" pattern="[0-9]*" maxlength="4" data-extra-field="amount" class="${extraFieldErrorClass(issues, carName, index, 'amount')}" value="${esc(ex.amount || '', helpers)}" placeholder="金額" label="金額" hide-label${invalidAttr('amount', '金額を入力してください')}${lockedAttr}></cds-text-input>
        </label>
        <div class="seisan-extra-field seisan-extra-field--type ${baseType} ${type}">
          ${columnLabel('負担')}
          <cds-select size="lg" density="condensed" data-extra-field="type" class="seisan-extra-type ${UI_CLASS.input} ${baseType} ${type}" label-text="費用分類" hide-label>
              <cds-select-item value="split" ${type === 'split' ? 'selected' : ''}>割勘</cds-select-item>
              <cds-select-item value="club" ${type === 'club' ? 'selected' : ''}>部費</cds-select-item>
              <cds-select-item value="split-minus" ${type === 'split-minus' ? 'selected' : ''}>割勘 −</cds-select-item>
              <cds-select-item value="club-minus" ${type === 'club-minus' ? 'selected' : ''}>部費 −</cds-select-item>
          </cds-select>
        </div>
        ${deleteControl}
    </div>`;
  }

  Object.assign(parts, { extraRow });
})();
