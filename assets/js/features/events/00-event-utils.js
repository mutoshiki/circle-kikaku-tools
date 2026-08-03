// Shared helpers for event binding modules.
// Keep helpers here so feature event files can stay small and avoid copy/paste guards.
(function (global) {
    'use strict';

    const events = global.SanpoEvents || {};

    function bind(id, handler, eventName = 'click') {
        const el = byId(id);
        if (!el || el.dataset.eventOwnerBound === 'true') return;
        el.dataset.eventOwnerBound = 'true';
        el.addEventListener(eventName, event => {
            if (eventName === 'click') event.preventDefault();
            handler(event);
        });
    }

    function bindOnce(target, ownerKey, setup) {
        if (!target || target.dataset?.[ownerKey] === 'true') return false;
        if (target.dataset) target.dataset[ownerKey] = 'true';
        setup(target);
        return true;
    }

    global.SanpoEvents = Object.freeze({
        ...events,
        bind,
        bindOnce
    });
})(window);
