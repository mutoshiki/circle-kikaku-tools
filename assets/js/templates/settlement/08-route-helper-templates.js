// Google Maps route-helper templates.
(function () {
  'use strict';

  const parts = window.SanpoApp?.settlementTemplateParts || {};
  const { esc } = parts;

  function routeWaypointRow(place = null, index = 0, helpers = {}) {
    const name = place?.name || place?.address || '';
    return `<div class="route-waypoint-row" data-waypoint-index="${index}">
      <cds-button class="route-waypoint-drag" kind="ghost" size="lg" type="button" aria-label="経由地${index + 1}を並び替え"><span data-carbon-icon="drag--vertical" slot="icon" aria-hidden="true"></span></cds-button>
      <div class="route-location-field route-location-field--waypoint">
        <div class="route-location-marker is-waypoint" aria-hidden="true">${index + 1}</div>
        <div class="route-location-content">
          <div class="route-location-label" id="routeWaypointLabel${index}">経由地 ${index + 1}</div>
          <div class="route-place-host" id="routeWaypointAutocompleteHost${index}" data-waypoint-host="${index}"><cds-text-input-skeleton aria-hidden="true"></cds-text-input-skeleton></div>
          <div class="route-place-detail" data-waypoint-detail="${index}" ${name ? '' : 'hidden'}>${name ? esc(name, helpers) : ''}</div>
        </div>
      </div>
      <cds-button class="route-waypoint-delete" kind="danger--ghost" size="lg" type="button" data-route-waypoint-delete="${index}" aria-label="経由地${index + 1}を削除"><span data-carbon-icon="trash-can" slot="icon" aria-hidden="true"></span></cds-button>
    </div>`;
  }

  function routeResultTile(route, index, selected, helpers = {}) {
    const tollText = route.hasTolls
      ? (route.tollPrice ? `有料道路 ${formatToll(route.tollPrice)}` : '有料道路あり（料金不明）')
      : '有料道路なし';
    const highwayText = route.highwayDetection === 'unknown'
      ? '高速道路利用は判定できません'
      : (route.hasHighways ? '高速道路あり（道路名から推定）' : '高速道路なし（道路名から推定）');
    const restrictionText = route.restrictionsPartiallyIgnored
      ? '<span class="route-result-warning">一部の回避条件を適用できませんでした</span>'
      : '';
    const roads = route.mainRoads?.length ? route.mainRoads.join('・') : (route.description || '道路名情報なし');
    const routeLabel = esc(route.label, helpers);
    const recommended = route.isDefault === true || index === 0;
    const selectedAttr = selected ? ' selected data-selected="true" aria-checked="true"' : ' data-selected="false" aria-checked="false"';
    return `<cds-selectable-tile class="route-result-tile" name="route-candidate" value="${esc(route.id, helpers)}" role="radio" data-route-index="${index}" data-route-id="${esc(route.id, helpers)}" tabindex="${selected ? 0 : -1}" aria-posinset="${index + 1}" aria-setsize="${helpers.routeCount || 0}"${selectedAttr} aria-label="${routeLabel}を選択">
      <span class="route-result-tile-content">
        <span class="route-result-main">
          <span class="route-result-label-row">
            <strong>${routeLabel}</strong>
            ${recommended ? '<cds-tag type="blue" size="sm">推奨</cds-tag>' : ''}
          </span>
          <span class="route-result-metrics"><span>${formatDistance(route.distanceMeters)}</span><span>${formatDuration(route.durationSeconds)}</span></span>
        </span>
        <span class="route-result-advisories"><span>${escapeRouteText(tollText)}</span><span>${escapeRouteText(highwayText)}</span>${restrictionText}</span>
        <span class="route-result-roads" title="${esc(roads, helpers)}">${esc(roads, helpers)}</span>
      </span>
    </cds-selectable-tile>`;
  }

  function routeLegRow(leg) {
    return `<div class="route-leg-row"><span class="route-leg-names">${escapeRouteText(leg.startName)} → ${escapeRouteText(leg.endName)}</span><span>${formatDistance(leg.distanceMeters)}</span><span>${formatDuration(leg.durationSeconds)}</span></div>`;
  }

  function escapeRouteText(value) {
    return String(value || '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  }

  function formatDistance(meters) {
    const km = Math.max(0, Number(meters) || 0) / 1000;
    return km >= 100 ? `${km.toFixed(1)}km` : `${km.toFixed(km >= 10 ? 1 : 2)}km`;
  }

  function formatDuration(seconds) {
    const totalMinutes = Math.max(0, Math.round((Number(seconds) || 0) / 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return hours ? `${hours}時間${minutes ? `${minutes}分` : ''}` : `${minutes}分`;
  }

  function formatToll(money) {
    const units = Number(money?.units || 0);
    const nanos = Number(money?.nanos || 0);
    const amount = units + nanos / 1_000_000_000;
    const currency = String(money?.currencyCode || 'JPY');
    return currency === 'JPY' ? `約${Math.round(amount).toLocaleString()}円` : `${currency} ${amount.toFixed(2)}`;
  }

  Object.assign(parts, {
    routeWaypointRow,
    routeResultTile,
    routeLegRow,
    formatRouteDistance: formatDistance,
    formatRouteDuration: formatDuration,
    formatRouteToll: formatToll
  });
})();
