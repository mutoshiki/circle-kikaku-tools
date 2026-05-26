// Settlement extra-cost input templates.
(function () {
  'use strict';

  const parts = window.SanpoApp?.settlementTemplateParts || {};
  const { UI_CLASS, esc } = parts;

  function extraRow({ carName, ex, index, issues, helpers = {} }) {
    const type = ex.type === 'club' ? 'club' : 'split';
    const extraFieldErrorClass = helpers.extraFieldErrorClass || (() => '');
    return `<div class="seisan-extra-row" data-extra-index="${index}">
        <input type="text" data-extra-field="name" class="${extraFieldErrorClass(issues, carName, index, 'name')}" value="${esc(ex.name || '', helpers)}" placeholder="例：駐車場代">
        <input type="number" inputmode="numeric" data-extra-field="amount" class="${extraFieldErrorClass(issues, carName, index, 'amount')}" value="${esc(ex.amount || '', helpers)}" placeholder="金額">
        <select data-extra-field="type" class="seisan-extra-type ${UI_CLASS.input} ${type}">
            <option value="split" ${type === 'split' ? 'selected' : ''}>割勘</option>
            <option value="club" ${type === 'club' ? 'selected' : ''}>部費</option>
        </select>
        <button class="seisan-icon-btn" type="button" data-action="remove-settlement-extra" title="削除"><i class="fas fa-times" aria-hidden="true"></i></button>
    </div>`;
  }

  
  Object.assign(parts, { extraRow });
})();
