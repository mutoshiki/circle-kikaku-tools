// Google route planner templates.
(function () {
  'use strict';

  const parts = window.SanpoApp?.settlementTemplateParts || {};
  const { esc } = parts;

  function formatDistance(meters = 0) {
    const km = Math.max(0, Number(meters) || 0) / 1000;
    return km >= 100 ? `${km.toFixed(1)}km` : `${km.toFixed(km >= 10 ? 1 : 2)}km`;
  }

  function formatDuration(seconds = 0) {
    const totalMinutes = Math.max(0, Math.round((Number(seconds) || 0) / 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (!hours) return `${minutes}分`;
    return minutes ? `${hours}時間${minutes}分` : `${hours}時間`;
  }

  function placeSummary(place = null, helpers = {}) {
    if (!place) return '';
    return `<strong>${esc(place.name || '', helpers)}</strong><span>${esc(place.address || '', helpers)}</span>`;
  }


  function formatStopLetter(index = 0) {
    const value = Math.max(0, Number(index) || 0);
    const first = String.fromCharCode(65 + (value % 26));
    const repeat = Math.floor(value / 26);
    return repeat > 0 ? `${first}${repeat}` : first;
  }

  function routeWaypointRow(item = {}, index = 0, helpers = {}) {
    const id = String(item.id || `waypoint-${index}`);
    const letter = formatStopLetter(index);
    return `<div class="route-waypoint-row" data-route-waypoint-id="${esc(id, helpers)}">
      <div class="route-waypoint-stop"><span class="route-waypoint-stop-letter">${esc(letter, helpers)}</span></div>
      <div class="route-waypoint-main">
        <div class="route-place-autocomplete" data-route-waypoint-autocomplete="${esc(id, helpers)}"></div>
      </div>
      <cds-button class="route-waypoint-handle" kind="ghost" size="lg" type="button" aria-label="経由地${index + 1}を並び替え"><span data-carbon-icon="drag--vertical" slot="icon" aria-hidden="true"></span><span class="visually-hidden">経由地${index + 1}を並び替え</span></cds-button>
      <cds-icon-button class="route-waypoint-delete" kind="ghost" size="lg" type="button" data-action="remove-route-waypoint" data-route-waypoint-id="${esc(id, helpers)}" aria-label="経由地${index + 1}を削除"><span data-carbon-icon="trash-can" slot="icon" aria-hidden="true"></span></cds-icon-button>
    </div>`;
  }

  function routeCandidateCard(route = {}, index = 0, selected = false, roundTrip = false, helpers = {}) {
    const distance = Number(route.distanceMeters) || 0;
    const duration = Number(route.durationSeconds) || 0;
    const displayDistance = roundTrip ? distance * 2 : distance;
    const flags = [];
    if (route.hasTolls) flags.push(route.tollPrice ? `有料道路・${route.tollPrice}` : '有料道路を使用');
    else flags.push('有料道路なし');
    flags.push(route.hasHighways ? '高速道路を使用' : '高速道路の利用なし');
    const roads = Array.isArray(route.mainRoads) && route.mainRoads.length ? route.mainRoads.join('・') : '主な道路名は取得できませんでした';
    return `<cds-button class="route-candidate-card" kind="ghost" size="lg" type="button" role="radio" aria-checked="${selected ? 'true' : 'false'}" tabindex="${selected ? '0' : '-1'}" data-action="select-google-route" data-route-index="${index}">
      <span class="route-candidate-layout"><span class="route-candidate-main">
        <span class="route-candidate-label-row"><span class="route-candidate-check" aria-hidden="true"></span><span class="route-candidate-label">${esc(route.label || `ルート ${index + 1}`, helpers)}</span></span>
        <span class="route-candidate-metrics"><span>${formatDistance(displayDistance)}</span><span>${formatDuration(duration * (roundTrip ? 2 : 1))}</span></span>
        <span class="route-candidate-roads">${esc(roads, helpers)}</span>
        <span class="route-candidate-flags">${flags.map(flag => `<span>${esc(flag, helpers)}</span>`).join('')}</span>
      </span>
      <span class="route-candidate-distance">片道 ${formatDistance(distance)}</span></span>
    </cds-button>`;
  }

  function routeLegSummary(route = {}, places = [], roundTrip = false, helpers = {}) {
    if (!route || !Array.isArray(route.legs) || !route.legs.length) return '';
    const rows = route.legs.map((leg, index) => {
      const from = leg.fromName || places[index]?.name || `地点${index + 1}`;
      const to = leg.toName || places[index + 1]?.name || `地点${index + 2}`;
      return `<div class="route-leg-row"><strong>${esc(from, helpers)} → ${esc(to, helpers)}</strong><span>${formatDistance(leg.distanceMeters)}・${formatDuration(leg.durationSeconds)}</span></div>`;
    }).join('');
    const totalDistance = (Number(route.distanceMeters) || 0) * (roundTrip ? 2 : 1);
    const totalDuration = (Number(route.durationSeconds) || 0) * (roundTrip ? 2 : 1);
    return `<div class="route-total-summary"><strong>${roundTrip ? '往復合計' : '合計'}</strong><span>${formatDistance(totalDistance)}・${formatDuration(totalDuration)}</span></div>${rows}`;
  }

  Object.assign(parts, {
    routePlaceSummary: placeSummary,
    routeWaypointRow,
    routeCandidateCard,
    routeLegSummary,
    formatRouteDistance: formatDistance,
    formatRouteDuration: formatDuration,
    formatRouteStopLetter: formatStopLetter
  });
})();
