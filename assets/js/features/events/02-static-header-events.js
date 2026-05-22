// Header and always-visible command buttons.
(function (global) {
    'use strict';

    const events = global.SanpoEvents || {};
    const bind = events.bind;
    const OVERVIEW_STORAGE_KEY = 'sanpoOverviewDraft:v1';
    let applyingOverviewSnapshot = false;

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

    function normalizeOverviewSnapshot(value = {}) {
        const source = value && typeof value === 'object' ? value : {};
        return {
            memo: String(source.memo || ''),
            timetableItems: getTimetableItems(source)
                .map(item => ({
                    time: String(item.time || '').slice(0, 5),
                    title: String(item.title || '').trim()
                }))
                .filter(item => item.time || item.title)
        };
    }

    function saveOverviewDraft(options = {}) {
        const memo = byId('overviewMemoInput')?.value || '';
        const timetableItems = [...document.querySelectorAll('.overview-timetable-row')].map(row => ({
            time: row.querySelector('[data-field="time"]')?.value || '',
            title: row.querySelector('[data-field="title"]')?.value || ''
        })).filter(item => item.time || item.title);
        const snapshot = { memo, timetableItems };
        try {
            global.localStorage.setItem(getOverviewStorageKey(), JSON.stringify(snapshot));
        } catch {
            // Local memo/timetable are convenience fields; failing silently keeps core flows usable.
        }
        if (applyingOverviewSnapshot) return;
        if (!options.skipRender && byId('sheet-view-area')?.classList.contains('active')) global.renderSheetView?.();
        clearTimeout(global.__overviewSaveTimer);
        global.__overviewSaveTimer = setTimeout(() => global.save?.(), 400);
    }

    function getTimetableItems(draft) {
        if (Array.isArray(draft.timetableItems)) return draft.timetableItems;
        if (typeof draft.timetable === 'string' && draft.timetable.trim()) {
            return draft.timetable.split('\n').map(line => {
                const match = line.trim().match(/^([0-2]?\d:[0-5]\d)\s*(.*)$/);
                return match ? { time: match[1], title: match[2] || '' } : { time: '', title: line.trim() };
            });
        }
        return [{ time: '', title: '' }];
    }

    function buildTimetableText(items = getTimetableItems(loadOverviewDraft())) {
        return items
            .filter(item => item.time || item.title)
            .map(item => [item.time, item.title].filter(Boolean).join(' '))
            .join('\n');
    }

    function escapeAttr(value) {
        return String(value).replace(/[&<>"']/g, char => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        })[char]);
    }

    function createTimetableRow(item = { time: '', title: '' }) {
        const row = document.createElement('div');
        row.className = 'overview-timetable-row';
        row.innerHTML = `
                <input type="time" data-field="time" value="${escapeAttr(item.time || '')}" aria-label="時刻">
                <input type="text" data-field="title" value="${escapeAttr(item.title || '')}" placeholder="内容" aria-label="内容">
                <button type="button" class="overview-row-delete" data-action="delete-timetable-row" aria-label="行を削除">
                  <i class="fas fa-xmark" aria-hidden="true"></i>
                </button>
            `;
        return row;
    }

    function renderTimetableRows(items = getTimetableItems(loadOverviewDraft())) {
        const root = byId('overviewTimetableRows');
        if (!root) return;
        root.innerHTML = '';
        const rows = items.length ? items : [{ time: '', title: '' }];
        rows.forEach(item => root.appendChild(createTimetableRow(item)));
    }

    function addTimetableRow() {
        const root = byId('overviewTimetableRows');
        if (!root) return;
        root.appendChild(createTimetableRow());
        root.lastElementChild?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        saveOverviewDraft();
    }

    function getOverviewSnapshot() {
        return normalizeOverviewSnapshot(loadOverviewDraft());
    }

    function applyOverviewSnapshot(snapshot = {}, options = {}) {
        applyingOverviewSnapshot = true;
        try {
            const normalized = normalizeOverviewSnapshot(snapshot);
            global.localStorage.setItem(getOverviewStorageKey(), JSON.stringify(normalized));
            const memo = byId('overviewMemoInput');
            if (memo) memo.value = normalized.memo || '';
            renderTimetableRows(normalized.timetableItems.length ? normalized.timetableItems : [{ time: '', title: '' }]);
            if (!options.skipRender && byId('sheet-view-area')?.classList.contains('active')) global.renderSheetView?.();
        } catch {
            // Keep the main allocation flow usable even if overview data is malformed.
        } finally {
            applyingOverviewSnapshot = false;
        }
    }

    function setOverviewDrawerOpen(open) {
        const drawer = byId('overviewDrawer');
        const scrim = byId('overviewDrawerScrim');
        const trigger = byId('overviewMenuBtn');
        if (!drawer || !scrim || !trigger) return;
        drawer.classList.toggle('is-open', open);
        drawer.setAttribute('aria-hidden', open ? 'false' : 'true');
        trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
        scrim.hidden = !open;
        document.body.classList.toggle('overview-drawer-open', open);
    }

    function setupOverviewMenuFields() {
        const draft = normalizeOverviewSnapshot(global.SanpoApp?.state?.getSnapshot?.()?.overview || loadOverviewDraft());
        const memo = byId('overviewMemoInput');
        if (memo) memo.value = draft.memo || '';
        renderTimetableRows(getTimetableItems(draft));
        bind('overviewMenuBtn', () => setOverviewDrawerOpen(true));
        bind('overviewDrawerCloseBtn', () => setOverviewDrawerOpen(false));
        bind('overviewDrawerScrim', () => setOverviewDrawerOpen(false));
        bind('overviewTimetableAddBtn', () => addTimetableRow());
        bind('overviewTimetableCopyBtn', () => copyTextWithFallback(buildTimetableText(), '予定をコピーしました'));
        memo?.addEventListener('input', saveOverviewDraft);
        byId('overviewTimetableRows')?.addEventListener('input', saveOverviewDraft);
        byId('overviewTimetableRows')?.addEventListener('click', event => {
            const button = event.target.closest?.('[data-action="delete-timetable-row"]');
            if (!button) return;
            const row = button.closest('.overview-timetable-row');
            row?.remove();
            if (!document.querySelector('.overview-timetable-row')) renderTimetableRows([{ time: '', title: '' }]);
            saveOverviewDraft();
        });
        if (document.body.dataset.overviewEscapeBound !== 'true') {
            document.body.dataset.overviewEscapeBound = 'true';
            document.addEventListener('keydown', event => {
                if (event.key === 'Escape') setOverviewDrawerOpen(false);
            });
        }
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

    global.SanpoOverview = Object.freeze({
        getSnapshot: getOverviewSnapshot,
        applySnapshot: applyOverviewSnapshot,
        buildTimetableText,
        getTimetableItems: () => getTimetableItems(loadOverviewDraft())
    });

    global.SanpoEvents = Object.freeze({
        ...events,
        setupStaticHeaderEvents
    });
})(window);
