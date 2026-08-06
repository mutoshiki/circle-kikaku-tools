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

  function stopLetter(index = 0) {
    let number = Math.max(0, Number(index) || 0) + 1;
    let label = '';
    while (number > 0) {
      number -= 1;
      label = String.fromCharCode(65 + (number % 26)) + label;
      number = Math.floor(number / 26);
    }
    return label;
  }

  function routeStopRow(item = {}, index = 0, total = 2, helpers = {}) {
    const rawRole = String(item.role || 'waypoint');
    const role = ['origin', 'destination', 'waypoint', 'append'].includes(rawRole) ? rawRole : 'waypoint';
    const isAppend = role === 'append';
    const id = String(item.id || role || `waypoint-${index}`);
    const value = item.place?.name || '';
    const placeholder = role === 'origin'
      ? '出発地を追加'
      : role === 'destination'
        ? '目的地を追加'
        : '経由地を追加';
    const accessibleIndex = Math.max(1, index + 1);
    const marker = role === 'origin'
      ? '<span class="route-stop-marker route-stop-marker--origin" aria-hidden="true">O</span>'
      : `<span class="route-stop-marker" aria-hidden="true">${esc(stopLetter(Math.max(0, index - 1)), helpers)}</span>`;
    const waypointAttr = role === 'waypoint' ? ` data-route-waypoint-id="${esc(id, helpers)}"` : '';
    const drag = isAppend
      ? '<span class="route-stop-drag route-stop-drag--placeholder" aria-hidden="true"><span data-carbon-icon="drag--vertical"></span></span>'
      : `<cds-button class="route-stop-drag" kind="ghost" size="lg" type="button" aria-label="地点${accessibleIndex}を並び替え"><span data-carbon-icon="drag--vertical" slot="icon" aria-hidden="true"></span><span class="visually-hidden">地点${accessibleIndex}を並び替え</span></cds-button>`;
    const remove = isAppend
      ? '<span class="route-stop-action-spacer" aria-hidden="true"></span>'
      : `<cds-button class="route-stop-delete" kind="ghost" size="lg" type="button" data-action="remove-route-stop" data-route-role="${role}"${waypointAttr} aria-label="この地点を削除"><span data-carbon-icon="trash-can" slot="icon" aria-hidden="true"></span><span class="visually-hidden">この地点を削除</span></cds-button>`;
    const roleLabel = role === 'origin' ? '出発地' : role === 'destination' ? '目的地' : isAppend ? '地点を追加' : `経由地 ${stopLetter(Math.max(0, index - 1))}`;
    return `<div class="route-stop-row route-stop-row--${role}" data-route-stop-id="${esc(id, helpers)}" data-route-role="${role}"${waypointAttr}${isAppend ? ' data-route-add-slot="true"' : ''}>
      ${marker}
      <div class="route-stop-field">
        <span class="route-stop-role-label">${esc(roleLabel, helpers)}</span>
        <span class="route-stop-input-shell">
          <span class="route-stop-search-icon" aria-hidden="true"><span data-carbon-icon="search"></span></span>
          <cds-text-input class="route-stop-input" type="text" size="lg" label="${placeholder}" hide-label placeholder="${placeholder}" value="${esc(value, helpers)}" readonly data-action="open-route-place-search" data-route-role="${role}"${waypointAttr} aria-label="${roleLabel}、${placeholder}"></cds-text-input>
        </span>
      </div>
      ${drag}
      ${remove}
    </div>`;
  }

  function routeWaypointRow(item = {}, index = 0, helpers = {}) {
    return routeStopRow({ ...item, role: 'waypoint' }, index + 1, index + 3, helpers);
  }

  function routeHistoryItem(item = {}, index = 0, helpers = {}) {
    const title = item.title || item.place?.name || item.name || '';
    const subtitle = item.subtitle || item.place?.address || item.address || '';
    const icon = item.kind === 'prediction' ? 'location' : 'recently-viewed';
    return `<cds-button class="route-place-history-item" kind="ghost" size="lg" type="button" data-route-history-index="${index}">
      <span class="route-place-history-layout">
        <span class="route-place-history-icon" aria-hidden="true"><span data-carbon-icon="${icon}"></span></span>
        <span class="route-place-history-text"><strong>${esc(title, helpers)}</strong>${subtitle ? `<span>${esc(subtitle, helpers)}</span>` : ''}</span>
      </span>
    </cds-button>`;
  }

  function routeCandidateCard(route = {}, index = 0, selected = false, roundTrip = false, helpers = {}, options = {}) {
    const distance = Number(route.distanceMeters) || 0;
    const duration = Number(route.durationSeconds) || 0;
    const displayDistance = roundTrip ? distance * 2 : distance;
    const displayDuration = duration * (roundTrip ? 2 : 1);
    const routeIndex = Number.isInteger(options.routeIndex) ? options.routeIndex : index;
    const attrs = [`data-action="select-google-route"`, `data-route-index="${routeIndex}"`];
    if (Number.isInteger(options.segmentIndex)) attrs.push(`data-route-segment-index="${options.segmentIndex}"`);
    const prefixLabel = options.prefixLabel ? `${options.prefixLabel} ` : '';
    const sideLabel = options.distancePrefix || (roundTrip ? '往復' : '片道');
    return `<cds-button class="route-candidate-card" kind="ghost" size="lg" type="button" role="radio" aria-checked="${selected ? 'true' : 'false'}" tabindex="${selected ? '0' : '-1'}" ${attrs.join(' ')}>
      <span class="route-candidate-layout"><span class="route-candidate-main">
        <span class="route-candidate-label-row"><span class="route-candidate-check" aria-hidden="true"></span><span class="route-candidate-label">${esc(prefixLabel + (route.label || `ルート ${routeIndex + 1}`), helpers)}</span></span>
        <span class="route-candidate-metrics"><span>${formatDistance(displayDistance)}</span><span>${formatDuration(displayDuration)}</span></span>
      </span>
      <span class="route-candidate-distance">${sideLabel} ${formatDistance(displayDistance)}</span></span>
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
    routeStopRow,
    routeWaypointRow,
    routeHistoryItem,
    routeCandidateCard,
    routeLegSummary,
    formatRouteDistance: formatDistance,
    formatRouteDuration: formatDuration,
    formatRouteStopLetter: stopLetter
  });
})();
