// App event bootstrap.
// Individual event owners live in assets/js/features/events/ to keep this file from becoming a catch-all.
(function (global) {
    'use strict';

    function setupAppEventListeners() {
        const events = global.SanpoEvents || {};
        events.bindCoreStartupEvents?.();
        global.setupAppearanceFooterSafety?.();
        events.setupStaticHeaderEvents?.();
        events.setupGeneratedHtmlEventDelegation?.();
        events.setupSettlementInputEvents?.();
        events.setupViewAndFeatureEvents?.();
    }

    global.SanpoEventBindings = Object.freeze({ setupAppEventListeners });

    document.addEventListener('DOMContentLoaded', setupAppEventListeners);
})(window);
