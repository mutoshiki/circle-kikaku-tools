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

  function extraRow({ carName, ex, index, issues, helpers = {} }) {
    const timesFeeKind = getTimesFeeKind(ex);
    const type = ex.type === 'club' ? 'club' : 'split';
    const extraFieldErrorClass = helpers.extraFieldErrorClass || (() => '');
    const rowClass = [
      'seisan-extra-row',
      timesFeeKind === 'time' ? 'seisan-extra-row--times-time' : '',
      timesFeeKind === 'distance' ? 'seisan-extra-row--times-distance' : ''
    ].filter(Boolean).join(' ');
    const timesAttr = timesFeeKind ? ` data-times-extra="${timesFeeKind}"` : '';
    const deleteControl = timesFeeKind
      ? '<button class="seisan-icon-btn seisan-extra-delete-placeholder" type="button" tabindex="-1" aria-hidden="true"><i class="fas fa-trash-can" aria-hidden="true"></i></button>'
      : '<button class="seisan-icon-btn" type="button" data-action="remove-settlement-extra" title="削除"><i class="fas fa-trash-can" aria-hidden="true"></i></button>';

    return `<div class="${rowClass}" data-extra-index="${index}"${timesAttr}>
        <input type="text" data-extra-field="name" class="${extraFieldErrorClass(issues, carName, index, 'name')}" value="${esc(ex.name || '', helpers)}" placeholder="例：駐車場代">
        <input type="number" inputmode="numeric" data-extra-field="amount" class="${extraFieldErrorClass(issues, carName, index, 'amount')}" value="${esc(ex.amount || '', helpers)}" placeholder="金額">
        <select data-extra-field="type" class="seisan-extra-type ${UI_CLASS.input} ${type}">
            <option value="split" ${type === 'split' ? 'selected' : ''}>割勘</option>
            <option value="club" ${type === 'club' ? 'selected' : ''}>部費</option>
        </select>
        ${deleteControl}
    </div>`;
  }

  Object.assign(parts, { extraRow });
})();
