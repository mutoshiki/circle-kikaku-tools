import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = file => fs.readFileSync(file, 'utf8');
const state = read('assets/js/features/settlement/01-state.js');
const route = read('assets/js/features/settlement/04-route-helper.js');
const templates = read('assets/js/templates/settlement/08-route-helper-templates.js');
const carTemplates = read('assets/js/templates/settlement/03-car-cost-templates.js');
const extraTemplates = read('assets/js/templates/settlement/04-extra-input-templates.js');
const settlementRender = read('assets/js/features/settlement/03-render.js');
const modal = read('index.html');
const loader = read('assets/js/core/google-maps-loader.js');
const config = read('maps-config.js');

for (const field of ['origin','waypoints','destination','routes','selectedRouteIndex','avoidTolls','avoidHighways','avoidFerries','targetCarId','roundTrip','calculatedAt']) {
  assert.match(state, new RegExp(`\\b${field}\\b`), `route planner state must persist ${field}`);
}
assert.match(state, /avoidTolls:\s*true/, 'tolls are avoided by default');
assert.match(state, /avoidHighways:\s*true/, 'highways are avoided by default');

assert.match(state, /routePlaceCatalog:\s*\[\]/, 'room state owns a shared route place catalog');
assert.match(state, /delete\s+snapshot\.routePlanner/, 'route construction is excluded from the shared settlement snapshot');
assert.match(route, /LOCAL_PLANNER_KEY_PREFIX/, 'route construction uses device-local storage');
assert.match(route, /localPlannerStorageKey[\s\S]*roomId/, 'device-local route state is scoped by room');
assert.match(route, /sharedPlaceCatalog/, 'default place candidates come from the room catalog');
assert.doesNotMatch(route, /routePlannerPlaceHistory/, 'global cross-room place history is not used');
assert.match(route, /gestureHandling:\s*['"]none['"][\s\S]*draggable:\s*false[\s\S]*touches\.length\s*>=\s*2/, 'one finger cannot move the map and two fingers explicitly enable map gestures');
assert.match(route, /routeOrder[\s\S]*selectedIndex[\s\S]*zIndex:\s*selected\s*\?\s*30/, 'the selected route is redrawn above alternatives');
assert.doesNotMatch(route, /createRouteMapLabel|route-map-route-label/, 'map route balloons are removed');
assert.match(route, /function\s+formatMapStopLetter[\s\S]*String\.fromCharCode\(65/, 'map waypoint markers generate A, B, C and later letters deterministically');
assert.match(route, /isDestination\s*\?\s*buildPinMarkerSvg\(\)\s*:\s*buildCircleMarkerSvg\(markerText\)/, 'only the final destination uses a red pin');
assert.match(route, /waitForPlannerCloseCompletion/, 'rapid route-modal reopening waits for the prior close lifecycle');
assert.match(modal, /入力した場所はルーム内で候補として共有されます/, 'the route privacy notice is visible at the top');
assert.match(carTemplates, /type="number"[\s\S]*data-field="dist"/, 'distance uses a numeric input');
assert.match(carTemplates, /type="number"[\s\S]*data-field="eco"/, 'fuel economy uses a numeric input');
assert.match(carTemplates, /type="number"[\s\S]*data-field="price"/, 'fuel price uses a numeric input');
assert.match(extraTemplates, /columnLabel\(['"]名目['"]\)/, 'extra-cost name is labeled 名目');
assert.match(settlementRender, /allowInvalid[\s\S]*settlementCarEditClosePrepared/, 'the route shortcut may transition away while validation warnings remain');
assert.match(loader, /data\.sanpoGoogleMaps|dataset\.sanpoGoogleMaps/, 'loader owns one Google script');
assert.match(config, /SANPO_GOOGLE_MAPS_CONFIG/, 'config follows the window config pattern');
assert.match(loader, /gm_authFailure/, 'loader surfaces authentication failures');
assert.match(loader, /script\.remove\(\)/, 'failed Google scripts can be retried cleanly');

assert.match(route, /AutocompleteSuggestion\.fetchAutocompleteSuggestions/, 'Places Autocomplete Data API supplies predictions');
assert.match(route, /new\s+runtime\.places\.AutocompleteSessionToken/, 'search uses an autocomplete session token');
assert.match(route, /\.toPlace\(\)/, 'a selected prediction is converted to a Place');
assert.match(route, /fetchFields\(\{\s*fields:\s*\[['"]id['"],\s*['"]displayName['"],\s*['"]formattedAddress['"],\s*['"]location['"]/, 'selected places retain required fields');
assert.match(route, /locationBias:\s*JAPAN_SEARCH_BIAS/, 'search is softly biased to Japan');
assert.match(route, /language:\s*['"]ja['"]/, 'search prefers Japanese');
assert.match(route, /region:\s*['"]jp['"]/, 'search formatting prefers Japan');
assert.doesNotMatch(route, /PlaceAutocompleteElement|gmp-place-autocomplete|gmp-select/, 'Google-owned autocomplete UI must not replace Carbon fields');
assert.doesNotMatch(route, /includedRegionCodes/, 'Japan preference must not hard-restrict results');
assert.match(modal + templates, /<cds-text-input/, 'all route place fields use Carbon Text Input');
assert.match(modal + templates, /<cds-(?:icon-)?button/, 'route actions use Carbon buttons');

assert.match(route, /MAX_WAYPOINTS\s*=\s*25/, 'waypoint count respects the Routes limit');
assert.match(route, /stops-keyboard-reordered/, 'stops support keyboard reordering');
assert.match(route, /Route\.computeRoutes/, 'Routes API is used');
assert.match(route, /wholeRouteRequest[\s\S]*intermediates:[\s\S]*computeAlternativeRoutes:\s*true/, 'one whole-route request includes all waypoints and asks for normal alternative routes');
assert.match(route, /rawRoutes\.slice\(0, 3\)/, 'whole-route candidates are capped at three');
assert.match(route, /avoidTolls[\s\S]*avoidHighways[\s\S]*avoidFerries/, 'route modifiers are sent');
assert.doesNotMatch(route, /\bunits\s*:/, 'the incompatible UnitSystem field is omitted');
assert.match(route, /requestSequence/, 'stale route responses are rejected');
assert.match(route, /scheduleRouteRequest/, 'modifier changes are coalesced');
assert.match(route, /targetCarId\s*!==\s*getTargetCarId/, 'distance apply verifies the source car');
assert.match(route, /renderSettlementView\(\{\s*force:\s*true\s*\}\)/, 'distance apply recalculates settlement');
assert.match(route, /refreshMapAfterOpen/, 'reopening resizes and redraws the existing map');
assert.match(route, /Polyline[\s\S]*addListener\(['"]click['"]/, 'map routes are directly selectable');
assert.match(route, /popstate/, 'browser back closes the planner');
assert.doesNotMatch(route, /DirectionsService|DistanceMatrixService|AutocompleteService/, 'legacy APIs are absent');
assert.match(route, /retryRoutePlanner/, 'Google failures expose retry');
assert.doesNotMatch(modal, /id="addRouteWaypointBtn"/, 'the permanent empty stop row replaces the add button');
assert.match(modal, /<cds-accordion[\s\S]*<cds-accordion-item[^>]*title="ルート設定"/, 'route settings use the official Carbon Accordion');
assert.doesNotMatch(modal, /地図プレビュー|地点を選択すると自動で取得します/, 'redundant planner copy is removed');
assert.match(templates, /route-stop-row--\$\{role\}/, 'all route points share the same stop-row anatomy');
assert.match(templates, /data-route-add-slot/, 'one permanent empty append slot is rendered');
for (const id of ['routeStopList','routePlaceSearchInput','routePlaceHistoryList','routePlannerRetryBtn','routeMap','routeCandidateList','applyRouteDistanceBtn']) {
  assert.match(modal, new RegExp(`id="${id}"`));
}
console.log('Google route planner contract: PASS');
