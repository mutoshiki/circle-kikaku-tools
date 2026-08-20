// Header and always-visible command buttons.
(function (global) {
    'use strict';

    function createCarbonShellIconButton(id, label, iconName) {
        const button = document.createElement('cds-icon-button');
        button.id = id;
        button.className = 'app-shell-menu-button';
        button.kind = 'ghost';
        button.size = 'lg';
        button.type = 'button';
        button.setAttribute('aria-label', label);
        button.setAttribute('align', 'bottom-left');
        const icon = document.createElement('span');
        icon.slot = 'icon';
        icon.dataset.carbonIcon = iconName;
        icon.setAttribute('aria-hidden', 'true');
        button.appendChild(icon);
        return button;
    }

    function ensureCarbonShellHeader() {
        const main = document.querySelector('#app-header .app-header-main');
        const brand = main?.querySelector('.app-brand');
        const actions = main?.querySelector('.header-actions');
        if (!main || !brand || !actions) return;

        let overviewButton = byId('overviewMenuBtn');
        if (!overviewButton) {
            overviewButton = createCarbonShellIconButton('overviewMenuBtn', 'メモ・タイムテーブルを開く', 'menu');
            main.insertBefore(overviewButton, brand);
        }

        let title = brand.querySelector('.app-brand-title');
        if (!title) {
            title = document.createElement('span');
            title.className = 'app-brand-title';
            title.textContent = 'サークル企画ツール';
            brand.prepend(title);
        }

        const roomField = brand.querySelector('.app-room-field');
        roomField?.setAttribute('aria-hidden', 'true');
        const roomInput = byId('roomNameInput');
        if (roomInput) {
            roomInput.tabIndex = -1;
            roomInput.setAttribute('aria-hidden', 'true');
        }

        const headerMore = actions.querySelector('.header-more');
        const overflow = headerMore?.querySelector('cds-overflow-menu');
        const menu = overflow?.querySelector('cds-menu');
        const share = byId('shareLinkBtn');

        if (overflow) {
            overflow.classList.add('header-app-switcher');
            overflow.setAttribute('label', 'アプリメニュー');
            overflow.setAttribute('aria-label', 'アプリメニュー');
            overflow.setAttribute('align', 'bottom-end');
            overflow.querySelector('[slot="icon"]')?.remove();
            if (!overflow.querySelector('[data-carbon-icon="switcher"]')) {
                const glyph = document.createElement('span');
                glyph.className = 'app-switcher-icon';
                glyph.slot = 'icon';
                glyph.dataset.carbonIcon = 'switcher';
                glyph.setAttribute('aria-hidden', 'true');
                overflow.prepend(glyph);
            }
        }

        if (menu) {
            const guide = byId('userGuideBtn');
            const sample = byId('sampleDataBtn');
            const theme = byId('themeToggleBtn');
            const currentLock = byId('editLockBtn');
            let lockItem = currentLock?.tagName === 'CDS-MENU-ITEM' ? currentLock : null;
            if (!lockItem) {
                lockItem = document.createElement('cds-menu-item');
                lockItem.id = 'editLockBtn';
                lockItem.setAttribute('label', 'ロック');
                lockItem.innerHTML = '<span data-carbon-icon="unlocked" data-state-icon="editLock" data-icon-state="unlocked" slot="render-icon" aria-hidden="true"></span>';
                currentLock?.remove();
            }
            [guide, sample, theme, lockItem].filter(Boolean).forEach(item => menu.appendChild(item));
        }

        if (share && headerMore) actions.replaceChildren(share, headerMore);
        global.SanpoCarbon?.renderCarbonIcons?.(main);
    }

    function readCurrentShellView() {
        if (document.body.classList.contains('view-mode-sheet')) return 'sheet';
        if (document.body.classList.contains('view-mode-seisan')) return 'seisan';
        return 'list';
    }

    let syncingCarbonPrimaryNavigation = false;
    function syncCarbonPrimaryNavigationState() {
        if (syncingCarbonPrimaryNavigation) return;
        syncingCarbonPrimaryNavigation = true;
        try {
            const view = typeof currentView !== 'undefined' ? currentView : readCurrentShellView();
            const allocationType = document.body.dataset.activePlanTemplate === 'team' ? 'team' : 'car';
            const states = [
                ['tab-sheet', view === 'sheet'],
                ['tab-seisan', view === 'seisan'],
                ['tab-list', view === 'list' && allocationType === 'car'],
                ['tab-team', view === 'list' && allocationType === 'team']
            ];
            let selectedValue = 'car';
            states.forEach(([id, active]) => {
                const tab = byId(id);
                if (!tab) return;
                tab.classList.toggle('active', active);
                tab.toggleAttribute('selected', active);
                if (active) {
                    tab.setAttribute('aria-current', 'page');
                    selectedValue = tab.getAttribute('value') || selectedValue;
                } else {
                    tab.removeAttribute('aria-current');
                }
            });
            const tabBar = byId('view-toggle-bar');
            if (tabBar) {
                tabBar.setAttribute('value', selectedValue);
                if (customElements.get('cds-tabs')) tabBar.value = selectedValue;
            }

            const carTab = byId('tab-list');
            const teamTab = byId('tab-team');
            const allocationLocked = !!carTab?.classList.contains('is-scope-locked');
            const teamIndicator = teamTab?.querySelector('.view-tab-lock-indicator[data-lock-scope="allocation"]');
            if (teamIndicator) teamIndicator.hidden = !allocationLocked;
            teamTab?.classList.toggle('is-scope-locked', allocationLocked);
            if (teamTab) teamTab.setAttribute('aria-label', allocationLocked ? '班割（ロック中）' : '班割');
        } finally {
            syncingCarbonPrimaryNavigation = false;
        }
    }

    function setDestinationLabel(tab, text) {
        if (!tab) return;
        tab.querySelector('.view-tab-icon')?.remove();
        const label = tab.querySelector('.view-tab-label');
        if (!label) return;
        const lockIndicator = label.querySelector('.view-tab-lock-indicator');
        label.replaceChildren(document.createTextNode(text));
        if (lockIndicator) label.appendChild(lockIndicator);
    }

    function ensureCarbonPrimaryNavigation() {
        const bar = byId('view-toggle-bar');
        if (!bar || bar.dataset.carbonFourViewNav === 'true') return;
        const sheetTab = byId('tab-sheet');
        const settlementTab = byId('tab-seisan');
        const carTab = byId('tab-list');
        if (!sheetTab || !settlementTab || !carTab) return;

        const teamTab = carTab.cloneNode(true);
        teamTab.id = 'tab-team';
        teamTab.dataset.view = 'list';
        teamTab.dataset.allocationType = 'team';
        teamTab.setAttribute('value', 'team');
        teamTab.classList.remove('active');
        teamTab.removeAttribute('aria-current');
        teamTab.setAttribute('aria-label', '班割');
        carTab.dataset.allocationType = 'car';
        carTab.setAttribute('value', 'car');
        carTab.setAttribute('aria-label', '車割');

        setDestinationLabel(sheetTab, '共有画面');
        setDestinationLabel(settlementTab, '精算');
        setDestinationLabel(carTab, '車割');
        setDestinationLabel(teamTab, '班割');
        bar.replaceChildren(sheetTab, settlementTab, carTab, teamTab);
        bar.dataset.carbonFourViewNav = 'true';
        global.SanpoCarbon?.renderCarbonIcons?.(bar);
        syncCarbonPrimaryNavigationState();

        const observer = new MutationObserver(() => syncCarbonPrimaryNavigationState());
        observer.observe(document.body, { attributes: true, attributeFilter: ['class', 'data-active-plan-template'] });
        observer.observe(carTab, { attributes: true, attributeFilter: ['class'] });
        global.__carbonPrimaryNavigationObserver = observer;
    }

    global.syncCarbonPrimaryNavigationState = syncCarbonPrimaryNavigationState;

    function syncTimetableTextareaExpansion(host, forceActive = false) {
        if (!host?.matches?.('cds-textarea.overview-timetable-title-input')) return;
        const value = String(host.value || host.getAttribute('value') || '');
        const shouldExpand = forceActive || value.includes('\n') || value.length > 18;
        host.classList.toggle('is-expanded', shouldExpand);
        host.rows = shouldExpand ? 4 : 1;
        host.setAttribute('rows', shouldExpand ? '4' : '1');
    }

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
                <cds-text-input type="time" size="lg" data-field="time" value="${escapeAttr(item.time || '')}" label="時刻" hide-label></cds-text-input>
                <cds-textarea class="overview-timetable-title-input${item.title ? ' is-expanded' : ''}" rows="${String(item.title || '').length > 18 || String(item.title || '').includes('\n') ? 4 : 1}" size="lg" data-field="title" value="${escapeAttr(item.title || '')}" placeholder="内容" label="内容" hide-label></cds-textarea>
                <cds-icon-button type="button" class="overview-row-delete" kind="ghost" size="lg" data-action="delete-timetable-row" aria-label="行を削除">
                  <span data-carbon-icon="close" aria-hidden="true"></span>
                </cds-icon-button>
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
        memo?.addEventListener('input', event => {
            if (!event.isComposing) saveOverviewDraft();
        });
        byId('overviewTimetableRows')?.addEventListener('input', event => {
            if (event.target.matches?.('[data-field="title"]')) syncTimetableTextareaExpansion(event.target, true);
            if (!event.isComposing) saveOverviewDraft();
        });
        byId('overviewTimetableRows')?.addEventListener('focusin', event => {
            if (event.target.matches?.('[data-field="title"]')) syncTimetableTextareaExpansion(event.target, true);
        });
        byId('overviewTimetableRows')?.addEventListener('focusout', event => {
            if (event.target.matches?.('[data-field="title"]')) syncTimetableTextareaExpansion(event.target, false);
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
        ensureCarbonShellHeader();
        ensureCarbonPrimaryNavigation();
        setupOverviewMenuFields();
        const headerOverflow = document.querySelector('.header-more cds-overflow-menu');
        headerOverflow?.addEventListener('click', event => {
            if (event.composedPath().some(node => node?.tagName === 'CDS-MENU-ITEM')) {
                headerOverflow.open = false;
                global.SanpoFocusModality?.clearPointerFocus?.(headerOverflow);
            }
        });
        bind('userGuideBtn', () => global.modals?.userGuide?.show());
        bind('historyBtn', () => { if (canUseUnlockedMenuAction()) global.showHistory?.(); });
        bind('sampleDataBtn', () => { if (canUseUnlockedMenuAction()) global.openDebugModal?.(); });
        bind('resetDataBtn', () => { if (canUseUnlockedMenuAction()) global.resetData(); });
        bind('editLockBtn', () => toggleEditProtection());
        bind('shareLinkBtn', () => copyUrl());
        bind('fillEmptySeatsBtn', () => autoAssign('fill'));
        bind('shuffleAssignBtn', () => autoAssign('shuffle'));
        bind('tray-handle', () => toggleTray());
        global.updateEditLockButton?.();
        syncCarbonPrimaryNavigationState();
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
