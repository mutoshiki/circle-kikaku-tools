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
        const timetableItems = [...document.querySelectorAll('.overview-timetable-row')].map(row => ({
            time: row.querySelector('[data-field="time"]')?.value || '',
            title: row.querySelector('[data-field="title"]')?.value || ''
        })).filter(item => item.time || item.title);
        try {
            global.localStorage.setItem(getOverviewStorageKey(), JSON.stringify({ memo, timetableItems }));
        } catch {
            // Local memo/timetable are convenience fields; failing silently keeps core flows usable.
        }
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

    function renderTimetableRows(items = getTimetableItems(loadOverviewDraft())) {
        const root = byId('overviewTimetableRows');
        if (!root) return;
        root.innerHTML = '';
        const rows = items.length ? items : [{ time: '', title: '' }];
        rows.forEach(item => {
            const row = document.createElement('div');
            row.className = 'overview-timetable-row';
            row.innerHTML = `
                <input type="time" data-field="time" value="${escapeAttr(item.time || '')}" aria-label="時刻">
                <input type="text" data-field="title" value="${escapeAttr(item.title || '')}" placeholder="予定" aria-label="予定">
                <button type="button" class="overview-row-delete" data-action="delete-timetable-row" aria-label="行を削除">
                  <i class="fas fa-xmark" aria-hidden="true"></i>
                </button>
            `;
            root.appendChild(row);
        });
    }

    function addTimetableRow() {
        const items = [...document.querySelectorAll('.overview-timetable-row')].map(row => ({
            time: row.querySelector('[data-field="time"]')?.value || '',
            title: row.querySelector('[data-field="title"]')?.value || ''
        }));
        items.push({ time: '', title: '' });
        renderTimetableRows(items);
        saveOverviewDraft();
        byId('overviewTimetableRows')?.lastElementChild?.querySelector('[data-field="time"]')?.focus();
    }

    function focusTimetableTitleAfterTime(input) {
        if (!input || input.dataset.field !== 'time' || !input.value) return;
        const title = input.closest('.overview-timetable-row')?.querySelector('[data-field="title"]');
        if (!title || document.activeElement === title) return;
        title.focus({ preventScroll: true });
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
        if (open) byId('overviewMemoInput')?.focus({ preventScroll: true });
    }

    function setupOverviewMenuFields() {
        const draft = loadOverviewDraft();
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
        byId('overviewTimetableRows')?.addEventListener('input', event => {
            const input = event.target.closest?.('[data-field="time"]');
            if (input?.value && input.value.length >= 5) focusTimetableTitleAfterTime(input);
        });
        byId('overviewTimetableRows')?.addEventListener('change', event => {
            focusTimetableTitleAfterTime(event.target.closest?.('[data-field="time"]'));
        });
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

    global.SanpoEvents = Object.freeze({
        ...events,
        setupStaticHeaderEvents
    });
})(window);
