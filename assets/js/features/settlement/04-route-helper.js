// Route helper compatibility facade. Implementation lives in route-helper/*.
(function (global) {
  'use strict';
  global.SanpoApp = global.SanpoApp || {};
  global.SanpoApp.features = global.SanpoApp.features || {};
  global.SanpoApp.features.routeHelper = {
    open: global.openRouteDistanceHelper,
    openFromCar: global.openRouteDistanceHelperFromShortcut,
    refresh: global.refreshRoutes,
    apply: global.applySelectedRouteDistance,
    getState: global.getRoutePlannerState
  };
})(window);
