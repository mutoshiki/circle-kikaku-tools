import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = file => fs.readFileSync(file, 'utf8');
const state = read('assets/js/features/settlement/01-state.js');
const route = read('assets/js/features/settlement/04-route-helper.js');
const templates = read('assets/js/templates/settlement/08-route-helper-templates.js');
const modal = read('index.html');
const loader = read('assets/js/core/google-maps-loader.js');
const config = read('maps-config.js');

for (const field of ['origin','waypoints','destination','routes','selectedRouteIndex','avoidTolls','avoidHighways','avoidFerries','targetCarId','roundTrip','calculatedAt']) {
  assert.match(state, new RegExp(`\\b${field}\\b`), `route planner state must persist ${field}`);
}
assert.match(state, /avoidTolls:\s*true/, 'tolls are avoided by default');
assert.match(state, /avoidHighways:\s*true/, 'highways are avoided by default');
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
assert.match(route, /computeAlternativeRoutes/, 'alternative routes are requested');
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
for (const id of ['routeStopList','routePlaceSearchInput','routePlaceHistoryList','routePlannerRetryBtn','routeMap','routeCandidateList','applyRouteDistanceBtn']) {
  assert.match(modal, new RegExp(`id="${id}"`));
}
console.log('Google route planner contract: PASS');
