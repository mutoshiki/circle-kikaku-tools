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
    const rowClass = [
      'seisan-extra-row',
      timesFeeKind === 'time' ? 'seisan-extra-row--times-time' : '',
      timesFeeKind === 'distance' ? 'seisan-extra-row--times-distance' : '',
      isReward ? 'seisan-extra-row--reward' : ''
    ].filter(Boolean).join(' ');
    const timesAttr = timesFeeKind ? ` data-times-extra="${timesFeeKind}"` : '';
    const lockedAttr = isReward ? ' readonly aria-readonly="true"' : '';
    const deleteControl = timesFeeKind || isReward
      ? '<cds-icon-button class="seisan-icon-btn seisan-extra-delete-placeholder" kind="ghost" size="lg" type="button" tabindex="-1" aria-hidden="true"><span data-carbon-icon="trash-can" slot="icon" aria-hidden="true"></span></cds-icon-button>'
      : '<cds-icon-button class="seisan-icon-btn" kind="danger--ghost" size="lg" type="button" data-action="remove-settlement-extra" aria-label="削除"><span data-carbon-icon="trash-can" slot="icon" aria-hidden="true"></span></cds-icon-button>';

    return `<div class="${rowClass}" data-extra-index="${index}"${timesAttr}>
        <cds-text-input size="lg" data-extra-field="name" class="${extraFieldErrorClass(issues, carName, index, 'name')}" value="${esc(ex.name || '', helpers)}" placeholder="例：駐車場代" label="費用名" hide-label${lockedAttr}></cds-text-input>
        <cds-number-input size="lg" inputmode="numeric" data-extra-field="amount" class="${extraFieldErrorClass(issues, carName, index, 'amount')}" value="${esc(ex.amount || '', helpers)}" placeholder="金額" label="金額" hide-label hide-steppers${lockedAttr}></cds-number-input>
        <cds-select size="lg" data-extra-field="type" class="seisan-extra-type ${UI_CLASS.input} ${baseType} ${type}" label-text="費用分類" hide-label>
            <cds-select-item value="split" ${type === 'split' ? 'selected' : ''}>割勘</cds-select-item>
            <cds-select-item value="club" ${type === 'club' ? 'selected' : ''}>部費</cds-select-item>
            <cds-select-item value="split-minus" ${type === 'split-minus' ? 'selected' : ''}>割勘（マイナス）</cds-select-item>
            <cds-select-item value="club-minus" ${type === 'club-minus' ? 'selected' : ''}>部費（マイナス）</cds-select-item>
        </cds-select>
        ${deleteControl}
    </div>`;
  }

  Object.assign(parts, { extraRow });
})();
