import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = file => fs.readFileSync(file, 'utf8');
const state = read('assets/js/features/settlement/01-state.js');
const route = read('assets/js/features/settlement/04-route-helper.js');
const modal = read('index.html');
const loader = read('assets/js/core/google-maps-loader.js');
const config = read('maps-config.js');

for (const field of ['origin','waypoints','destination','routes','selectedRouteIndex','avoidTolls','avoidHighways','avoidFerries','targetCarId','roundTrip','calculatedAt']) {
  assert.match(state, new RegExp(`\\b${field}\\b`), `route planner state must persist ${field}`);
}
assert.match(loader, /data\.sanpoGoogleMaps|dataset\.sanpoGoogleMaps/, 'loader owns one Google script');
assert.match(config, /SANPO_GOOGLE_MAPS_CONFIG/, 'config follows the existing window config pattern');

assert.match(loader, /gm_authFailure/, 'loader must surface Google Maps authentication failures');
assert.match(loader, /script\.remove\(\)/, 'failed Google scripts must be removed so a retry can start cleanly');
assert.match(route, /locationBias\s*=\s*JAPAN_SEARCH_BIAS/, 'Places search must be biased to Japan');
assert.match(route, /JAPAN_SEARCH_BIAS\s*=\s*Object\.freeze\(\{\s*north:[\s\S]*south:[\s\S]*east:[\s\S]*west:/, 'Japan bias must use a valid rectangular viewport');
assert.doesNotMatch(route, /JAPAN_SEARCH_BIAS[\s\S]{0,160}radius\s*:\s*(?:[5-9]\d{4,}|\d{6,})/, 'Places circular bias must never exceed the 50 km API limit');
assert.doesNotMatch(route, /gmp-placeselect/, 'only the Places API New gmp-select event should be used');
assert.match(route, /MAX_WAYPOINTS\s*=\s*25/, 'waypoint count must respect the Routes API limit');
assert.match(route, /stops-keyboard-reordered/, 'waypoints must support keyboard reordering');
assert.match(route, /requestedRegion\s*=\s*['"]jp['"]/, 'Places result formatting must prefer Japan');
assert.match(route, /requestedLanguage\s*=\s*['"]ja['"]/, 'Places results must prefer Japanese');
assert.doesNotMatch(route, /includedRegionCodes\s*=/, 'Japan preference must not exclude places outside Japan');
assert.match(route, /fetchFields\(\{\s*fields:\s*\[['"]id['"],\s*['"]displayName['"],\s*['"]formattedAddress['"],\s*['"]location['"]/, 'selected places retain required fields');
assert.match(route, /Route\.computeRoutes/, 'Routes API must be used');
assert.match(route, /computeAlternativeRoutes/, 'alternative routes must be requested');
assert.match(route, /avoidTolls[\s\S]*avoidHighways[\s\S]*avoidFerries/, 'route modifiers must be sent');
assert.match(route, /requestSequence/, 'stale route results must be rejected');
assert.match(route, /scheduleRouteRequest/, 'modifier changes must be coalesced to avoid excess requests');
assert.match(route, /canRetryWithoutTolls/, 'only optional toll computation failures may retry');
assert.match(route, /targetCarId\s*!==\s*getTargetCarId/, 'distance application must verify the source car');
assert.match(route, /renderSettlementView\(\{\s*force:\s*true\s*\}\)/, 'distance application must recalculate settlement');
assert.match(route, /popstate/, 'browser back must close the route planner');
assert.doesNotMatch(route, /DirectionsService|DistanceMatrixService|AutocompleteService/, 'legacy APIs must not be used');
assert.match(route, /retryRoutePlanner/, 'Google errors must expose a clean retry path');
for (const id of ['routeStopList','routePlaceSearchAutocomplete','routePlaceHistoryList','routePlannerRetryBtn','routeMap','routeCandidateList','applyRouteDistanceBtn']) assert.match(modal, new RegExp(`id="${id}"`));
console.log('Google route planner contract: PASS');
