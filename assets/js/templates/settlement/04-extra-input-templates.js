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
    const type = ex.type === 'club' ? 'club' : 'split';
    const extraFieldErrorClass = helpers.extraFieldErrorClass || (() => '');
    const rowClass = [
      'seisan-extra-row',
      timesFeeKind === 'time' ? 'seisan-extra-row--times-time' : '',
      timesFeeKind === 'distance' ? 'seisan-extra-row--times-distance' : '',
      isReward ? 'seisan-extra-row--reward' : ''
    ].filter(Boolean).join(' ');
    const timesAttr = timesFeeKind ? ` data-times-extra="${timesFeeKind}"` : '';
    const lockedAttr = isReward ? ' readonly aria-readonly="true"' : '';
    const disabledAttr = isReward ? ' disabled aria-disabled="true"' : '';
    const deleteControl = timesFeeKind || isReward
      ? '<button class="seisan-icon-btn seisan-extra-delete-placeholder" type="button" tabindex="-1" aria-hidden="true"><i class="fas fa-trash-can" aria-hidden="true"></i></button>'
      : '<button class="seisan-icon-btn" type="button" data-action="remove-settlement-extra" title="削除"><i class="fas fa-trash-can" aria-hidden="true"></i></button>';

    return `<div class="${rowClass}" data-extra-index="${index}"${timesAttr}>
        <input type="text" data-extra-field="name" class="${extraFieldErrorClass(issues, carName, index, 'name')}" value="${esc(ex.name || '', helpers)}" placeholder="例：駐車場代"${lockedAttr}>
        <input type="number" inputmode="numeric" data-extra-field="amount" class="${extraFieldErrorClass(issues, carName, index, 'amount')}" value="${esc(ex.amount || '', helpers)}" placeholder="金額"${lockedAttr}>
        <select data-extra-field="type" class="seisan-extra-type ${UI_CLASS.input} ${type}"${disabledAttr}>
            <option value="split" ${type === 'split' ? 'selected' : ''}>割勘</option>
            <option value="club" ${type === 'club' ? 'selected' : ''}>部費</option>
        </select>
        ${deleteControl}
    </div>`;
  }

  Object.assign(parts, { extraRow });
})();
