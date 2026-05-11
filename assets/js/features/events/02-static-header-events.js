// Header and always-visible command buttons.
(function (global) {
    'use strict';

    const events = global.SanpoEvents || {};
    const bind = events.bind;

    function setupStaticHeaderEvents() {
        bind('globalGuideBtn', () => global.modals?.globalGuide?.show());
        bind('appearanceSettingsBtn', () => openAppearanceModal());
        bind('historyBtn', () => { if (canUseUnlockedMenuAction()) global.showHistory?.(); });
        bind('sampleDataBtn', () => { if (canUseUnlockedMenuAction()) global.openDebugModal?.(); });
        bind('resetDataBtn', () => { if (canUseUnlockedMenuAction()) global.resetData(); });
        bind('editLockBtn', () => toggleEditProtection());
        bind('shareLinkBtn', () => copyUrl());
        bind('fillEmptySeatsBtn', () => autoAssign('fill'));
        bind('shuffleAssignBtn', () => autoAssign('shuffle'));
        bind('tray-handle', () => toggleTray());
    }

    global.SanpoEvents = Object.freeze({
        ...events,
        setupStaticHeaderEvents
    });
})(window);
