// Route helper templates used by the settlement distance tool.
(function () {
  'use strict';

  const parts = window.SanpoApp?.settlementTemplateParts || {};
  const { esc } = parts;

  function routePrivateOriginView() {
    return `<div class="route-private-view">
            <div class="route-private-saved"><i class="fas fa-lock" aria-hidden="true"></i>自宅を保存済み</div>
            <button class="seisan-btn" type="button" data-action="edit-route-private-origin">変更</button>
            <button class="seisan-btn" type="button" data-action="clear-route-private-origin">消す</button>
        </div>`;
  }

    function routePrivateOriginEdit(saved, helpers = {}) {
    return `<div class="route-private-edit">
        <input id="routePrivateOriginInput" class="route-private-input" type="text" value="${esc(saved, helpers)}" placeholder="例：自宅、下宿、集合場所" autocomplete="off">
        <button class="seisan-btn primary" type="button" data-action="save-route-private-origin">保存</button>
        <button class="seisan-btn" type="button" data-action="cancel-route-private-origin">やめる</button>
    </div>`;
  }

    function routeStopRow(value = '', index = 0, helpers = {}) {
    return `<div class="route-stop-row">
        <span class="route-stop-num" title="ドラッグで順番変更" aria-label="${index + 1}番目。ドラッグで順番変更"><i class="fas fa-grip-vertical" aria-hidden="true"></i><b>${index + 1}</b></span>
        <input type="text" class="route-stop-input" value="${esc(value || '', helpers)}" placeholder="例：飯綱高原、温泉、駐車場">
        <button class="seisan-icon-btn route-stop-delete-btn" type="button" data-action="remove-route-stop" title="削除"><i class="fas fa-times" aria-hidden="true"></i></button>
    </div>`;
  }

    function routeCandidateButton(value = '', helpers = {}) {
    const text = String(value || '').trim();
    if (!text) return '';
    return `<button class="route-candidate-chip" type="button" data-action="add-route-candidate-to-personal" data-route-candidate="${encodeURIComponent(text)}"><i class="fas fa-plus" aria-hidden="true"></i><span>${esc(text, helpers)}</span></button>`;
  }

  
  Object.assign(parts, {
    routePrivateOriginView,
    routePrivateOriginEdit,
    routeStopRow,
    routeCandidateButton
  });
})();
