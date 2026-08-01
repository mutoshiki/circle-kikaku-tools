// Route helper templates used by the settlement distance tool.
(function () {
  'use strict';

  const parts = window.SanpoApp?.settlementTemplateParts || {};
  const { esc } = parts;

    function routeStopRow(value = '', index = 0, helpers = {}) {
    return `<div class="route-stop-row">
        <button class="seisan-icon-btn route-stop-delete-btn" type="button" data-action="remove-route-stop" title="削除"><span data-carbon-icon="close" aria-hidden="true"></span></button>
        <input type="text" class="route-stop-input" value="${esc(value || '', helpers)}" placeholder="例：飯綱高原、温泉、駐車場">
        <span class="route-stop-num" title="並び替え" aria-label="この場所を並び替え"><span data-carbon-icon="drag--vertical" aria-hidden="true"></span></span>
    </div>`;
  }

    function routeCandidateButton(value = '', helpers = {}) {
    const text = String(value || '').trim();
    if (!text) return '';
    return `<button class="route-candidate-chip" type="button" data-action="add-route-candidate-to-personal" data-route-candidate="${encodeURIComponent(text)}"><span data-carbon-icon="add" aria-hidden="true"></span><span>${esc(text, helpers)}</span></button>`;
  }

  
  Object.assign(parts, {
    routeStopRow,
    routeCandidateButton
  });
})();
