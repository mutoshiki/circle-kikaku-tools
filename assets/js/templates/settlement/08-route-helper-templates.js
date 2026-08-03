// Google route planner templates. State and behavior remain in the route feature owner.
(function () {
  'use strict';

  const parts = window.SanpoApp?.settlementTemplateParts || {};
  const { esc } = parts;

  function routeMarker(index = 0, role = '') {
    if (role === 'origin') {
      return '<span class="route-origin-dot" aria-hidden="true"></span>';
    }
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const letterIndex = Math.max(0, (Number(index) || 0) - 1);
    return alphabet[Math.min(letterIndex, alphabet.length - 1)] || '?';
  }

  function routePlaceRow({ place = null, index = 0, role = 'waypoint', removable = true, draggable = true } = {}, helpers = {}) {
    const marker = routeMarker(index, role);
    const markerLabel = role === 'origin' ? '出発地' : String(marker);
    const roleLabel = role === 'origin' ? '出発地' : role === 'destination' ? '目的地' : '経由地';
    const placeholder = role === 'waypoint' ? '経由地を追加' : `${roleLabel}を追加`;
    const value = place?.name || '';
    const placeId = place?.placeId || '';
    return `<div class="route-sequence-row" data-route-sequence-row data-route-role="${role}" data-route-index="${index}" data-route-place-id="${esc(placeId, helpers)}">
      <div class="route-sequence-marker${role === 'origin' ? ' route-sequence-marker--origin' : ''}" aria-label="${markerLabel}">${marker}</div>
      <cds-button class="route-place-field-button${value ? ' is-filled' : ''}" kind="ghost" size="lg" type="button" data-route-edit-place aria-label="${roleLabel}${value ? `：${esc(value, helpers)}` : 'を追加'}">
        <span class="route-place-field-content"><svg class="route-place-field-search" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M18.15 17.44 13.7 13a6.5 6.5 0 1 0-.7.7l4.44 4.45ZM3 8.5A5.5 5.5 0 1 1 8.5 14 5.51 5.51 0 0 1 3 8.5Z"></path></svg><span class="route-place-field-label">${esc(value || placeholder, helpers)}</span></span>
      </cds-button>
      <cds-button class="route-sequence-drag" kind="ghost" size="lg" type="button" aria-label="${roleLabel}を並び替え" title="並び替え" data-route-drag${draggable ? '' : ' disabled'}><span data-carbon-icon="drag--vertical" slot="icon" aria-hidden="true"></span></cds-button>
      <cds-button class="route-sequence-delete" kind="ghost" size="lg" type="button" aria-label="${roleLabel}を削除" title="削除" data-route-clear-place${removable ? '' : ' disabled'}><span data-carbon-icon="trash-can" slot="icon" aria-hidden="true"></span></cds-button>
    </div>`;
  }

  function routeAddWaypointRow(index = 0) {
    const marker = routeMarker(index, 'add');
    return `<div class="route-sequence-row route-sequence-row--add" data-route-add-row>
      <div class="route-sequence-marker" aria-label="${marker}">${marker}</div>
      <cds-button class="route-place-field-button route-place-field-button--add" kind="ghost" size="lg" type="button" data-route-add-waypoint aria-label="経由地を追加">
        <span class="route-place-field-content"><svg class="route-place-field-search" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M18.15 17.44 13.7 13a6.5 6.5 0 1 0-.7.7l4.44 4.45ZM3 8.5A5.5 5.5 0 1 1 8.5 14 5.51 5.51 0 0 1 3 8.5Z"></path></svg><span class="route-place-field-label">経由地を追加</span></span>
      </cds-button>
    </div>`;
  }

  function routeHistoryItem(place = {}, helpers = {}) {
    if (!place?.placeId) return '';
    return `<cds-button class="route-history-item" kind="ghost" size="lg" type="button" data-route-history-place-id="${esc(place.placeId, helpers)}">
      <span class="route-history-item-content"><span data-carbon-icon="recently-viewed" aria-hidden="true"></span><span class="route-history-copy"><strong>${esc(place.name || '', helpers)}</strong>${place.address ? `<small>${esc(place.address, helpers)}</small>` : ''}</span></span>
    </cds-button>`;
  }

  function formatDistance(distanceMeters = 0) {
    const km = Math.max(0, Number(distanceMeters) || 0) / 1000;
    if (km >= 100) return `${km.toFixed(0)} km`;
    if (km >= 10) return `${km.toFixed(1)} km`;
    return `${km.toFixed(2)} km`;
  }

  function formatDuration(seconds = 0) {
    const totalMinutes = Math.max(0, Math.round((Number(seconds) || 0) / 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return hours ? `${hours}時間${minutes ? `${minutes}分` : ''}` : `${minutes}分`;
  }

  function routeCandidateCard(route = {}, index = 0, selected = false, helpers = {}) {
    const meta = [];
    if (route.hasTolls) meta.push('有料道路');
    if (route.hasHighways) meta.push('高速道路');
    if (route.tollPrice) meta.push(`料金 ${route.tollPrice}`);
    if (route.mainRoads?.length) meta.push(route.mainRoads.slice(0, 2).join('・'));
    return `<cds-button class="route-candidate-card${selected ? ' is-selected' : ''}" kind="${selected ? 'primary' : 'ghost'}" size="lg" type="button" role="radio" aria-checked="${selected ? 'true' : 'false'}" data-route-index="${index}">
      <span class="route-candidate-content"><span class="route-candidate-main"><strong>${esc(route.label || (index === 0 ? 'おすすめ' : `別ルート ${index}`), helpers)}</strong><span>${formatDistance(route.distanceMeters)}・${formatDuration(route.durationSeconds)}</span></span>${meta.length ? `<span class="route-candidate-meta">${esc(meta.join(' / '), helpers)}</span>` : ''}</span>
    </cds-button>`;
  }

  function routeLegSummary({ legs = [], totalDistanceMeters = 0, totalDurationSeconds = 0, roundTrip = false } = {}, helpers = {}) {
    const rows = (Array.isArray(legs) ? legs : []).map((leg, index) => `<div class="route-leg-row"><span>${esc(leg.fromName || `区間${index + 1}`, helpers)} → ${esc(leg.toName || `地点${index + 2}`, helpers)}</span><strong>${formatDistance(leg.distanceMeters)}・${formatDuration(leg.durationSeconds)}</strong></div>`).join('');
    const appliedDistance = roundTrip ? totalDistanceMeters * 2 : totalDistanceMeters;
    return `${rows}<div class="route-total-row"><span>合計</span><strong>${formatDistance(totalDistanceMeters)}・${formatDuration(totalDurationSeconds)}</strong></div>${roundTrip ? `<div class="route-total-row route-total-row--round"><span>往復距離</span><strong>${formatDistance(appliedDistance)}</strong></div>` : ''}`;
  }

  Object.assign(parts, {
    routePlaceRow,
    routeAddWaypointRow,
    routeHistoryItem,
    routeCandidateCard,
    routeLegSummary
  });
})();
