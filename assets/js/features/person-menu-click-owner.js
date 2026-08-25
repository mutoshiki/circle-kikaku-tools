// Person Menu trigger-click owner.
// Carbon Overflow Menu has its own internal toggle lifecycle. The application
// therefore owns the trigger click before it reaches the component and opens the
// existing Person Menu deliberately, so Carbon cannot immediately close a menu
// that the viewport layer has just promoted.
(() => {
    'use strict';

    if (window.__personMenuClickOwnerInstalled) return;
    window.__personMenuClickOwnerInstalled = true;

    function overflowFromEvent(event) {
        return event.composedPath?.().find(node => node?.matches?.('cds-overflow-menu.person-overflow-menu'))
            || event.target?.closest?.('cds-overflow-menu.person-overflow-menu')
            || null;
    }

    function menuItemFromEvent(event) {
        return event.composedPath?.().find(node => node?.matches?.('cds-menu-item'))
            || event.target?.closest?.('cds-menu-item')
            || null;
    }

    function menuIsOpen(trigger) {
        if (!trigger) return false;
        return window.SanpoPersonMenuLayer?.isTopLayer?.(trigger) === true
            || trigger.open === true
            || trigger.hasAttribute('open')
            || trigger.dataset.personMenuTopLayer === 'true';
    }

    function closeMenu(trigger) {
        if (!trigger) return;
        trigger.open = false;
        trigger.removeAttribute('open');
        window.SanpoPersonMenuLayer?.demote?.(trigger);
        document.body.classList.remove('person-menu-open', 'person-menu-top-layer-open');
        window.SanpoFocusModality?.clearPointerFocus?.(trigger);
    }

    document.addEventListener('click', event => {
        const trigger = overflowFromEvent(event);
        if (!trigger || menuItemFromEvent(event)) return;

        // Stop before the event reaches Carbon's own trigger implementation.
        // Person Menu is the single owner of this click and Carbon remains the
        // menu/presentation component rather than a second lifecycle owner.
        event.preventDefault();
        event.stopImmediatePropagation();

        if (menuIsOpen(trigger)) closeMenu(trigger);
        else window.openCompactPersonMenu?.(trigger);
    }, true);
})();
