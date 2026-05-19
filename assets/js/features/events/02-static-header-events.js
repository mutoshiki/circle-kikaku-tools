// Header and always-visible command buttons.
(function (global) {
    'use strict';

    const events = global.SanpoEvents || {};
    const bind = events.bind;
    const OVERVIEW_STORAGE_KEY = 'sanpoOverviewDraft:v1';

    function getOverviewStorageKey() {
        const room = new URLSearchParams(global.location.search).get('room') || 'local';
        return `${OVERVIEW_STORAGE_KEY}:${room}`;
    }

    function loadOverviewDraft() {
        try {
            return JSON.parse(global.localStorage.getItem(getOverviewStorageKey()) || '{}') || {};
        } catch {
            return {};
        }
    }

    function saveOverviewDraft() {
        const memo = byId('overviewMemoInput')?.value || '';
        const timetable = byId('overviewTimetableInput')?.value || '';
        try {
            global.localStorage.setItem(getOverviewStorageKey(), JSON.stringify({ memo, timetable }));
        } catch {
            // Local memo/timetable are convenience fields; failing silently keeps core flows usable.
        }
    }

    function setupOverviewMenuFields() {
        const draft = loadOverviewDraft();
        const memo = byId('overviewMemoInput');
        const timetable = byId('overviewTimetableInput');
        if (memo) memo.value = draft.memo || '';
        if (timetable) timetable.value = draft.timetable || '';
        memo?.addEventListener('input', saveOverviewDraft);
        timetable?.addEventListener('input', saveOverviewDraft);
    }

    function setupStaticHeaderEvents() {
        setupOverviewMenuFields();
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
