// Route helper templates used by the settlement distance tool.
(function () {
  'use strict';

  const parts = window.SanpoApp?.settlementTemplateParts || {};
  const { esc } = parts;

    function routeStopRow(value = '', index = 0, helpers = {}) {
    return `<div class="route-stop-row">
        <cds-icon-button class="route-stop-drag-handle" kind="ghost" size="lg" type="button" aria-label="場所${index + 1}を並び替え"><span data-carbon-icon="drag--vertical" slot="icon" aria-hidden="true"></span></cds-icon-button>
        <cds-text-input size="lg" class="route-stop-input" value="${esc(value || '', helpers)}" placeholder="場所名を入力（例：飯綱高原）" label="場所${index + 1}" hide-label></cds-text-input>
        <cds-icon-button class="seisan-icon-btn route-stop-delete-btn" kind="danger--ghost" size="lg" type="button" data-action="remove-route-stop" aria-label="場所${index + 1}を削除"><span data-carbon-icon="trash-can" slot="icon" aria-hidden="true"></span></cds-icon-button>
    </div>`;
  }

    function routeCandidateButton(value = '', helpers = {}) {
    const text = String(value || '').trim();
    if (!text) return '';
    return `<cds-button class="route-candidate-chip" kind="ghost" size="lg" type="button" data-action="add-route-candidate-to-personal" data-route-candidate="${encodeURIComponent(text)}"><span data-carbon-icon="add" slot="icon" aria-hidden="true"></span><span>${esc(text, helpers)}</span></cds-button>`;
  }

  
  Object.assign(parts, {
    routeStopRow,
    routeCandidateButton
  });
})();
