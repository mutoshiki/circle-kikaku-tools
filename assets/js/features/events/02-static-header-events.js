// Header and always-visible command buttons.
(function (global) {
    'use strict';

    const APP_NAVIGATION_LINKS = Object.freeze([
        ['山歩会フォームメーカー', 'https://script.google.com/macros/s/AKfycbw0R5VgBdSLS8aRDJDw7GUIEfHlXRZ6rPrOgjXmO2N7LvhuoGyS_opUCFTCSiUiDZw5/exec'],
        ['学務提出書類作成ツール', 'https://github.com/mutoshiki/sampokai-submission-builder/releases'],
        ['山歩会企画ツール一覧', 'https://mutoshiki.github.io/sanpokai-kikaku-portal/']
    ]);
    const PROJECT_TITLE_SCROLL_THRESHOLD = 8;
    const PROJECT_TITLE_PULL_THRESHOLD = 16;
    let projectTitlePointerStartY = null;

    function ensureCarbonShellHeader() {
        const header = byId('app-header');
        const roomInput = byId('roomNameInput');
        const region = byId('projectTitleRegion');
        if (!header || header.tagName !== 'CDS-HEADER' || !roomInput || !region) return;

        // `cds-header-name` resolves a relative `./` href against the site root.
        // That drops the room query on a real click and boots a new empty room.
        // Keep the current room in the brand link while leaving transient view
        // and allocation state behind.
        const brand = header.querySelector('cds-header-name');
        if (brand) {
            const roomUrl = new URL(global.location.href);
            roomUrl.searchParams.delete('view');
            roomUrl.searchParams.delete('allocation');
            roomUrl.hash = '';
            const roomHref = `${roomUrl.pathname}${roomUrl.search}`;
            if (brand.getAttribute('href') !== roomHref) brand.setAttribute('href', roomHref);
        }

        const roomField = roomInput.closest('.app-room-field');
        roomField?.classList.remove('project-title-source');
        roomField?.removeAttribute('aria-hidden');
        roomInput.removeAttribute('aria-hidden');
        roomInput.tabIndex = 0;
        region.dataset.state ||= 'expanded';

        const overflow = document.querySelector('.header-more cds-overflow-menu');
        if (overflow) {
            overflow.classList.add('header-app-switcher');
            overflow.setAttribute('label', 'アプリメニュー');
            overflow.setAttribute('aria-label', 'アプリメニュー');
            overflow.setAttribute('align', 'bottom-end');
        }
        ensureCarbonShareLabel();
        global.customElements?.whenDefined?.('cds-icon-button').then(ensureCarbonShareLabel).catch(() => {});
        global.SanpoCarbon?.renderCarbonIcons?.(header);
    }

    function ensureCarbonShareLabel() {
        const share = byId('shareLinkBtn');
        if (share?.tagName !== 'CDS-ICON-BUTTON') return;
        const shareLabel = share.getAttribute('aria-label') || share.getAttribute('label') || '共有リンク';
        share.tooltipText = shareLabel;
        share.setAttribute('tooltip-text', shareLabel);
    }

    function readCurrentShellView() {
        if (document.body.classList.contains('view-mode-participants')) return 'participants';
        if (document.body.classList.contains('view-mode-sheet')) return 'sheet';
        if (document.body.classList.contains('view-mode-seisan')) return 'seisan';
        return 'list';
    }

    let syncingCarbonPrimaryNavigation = false;
    function syncCarbonPrimaryNavigationState() {
        if (syncingCarbonPrimaryNavigation) return;
        syncingCarbonPrimaryNavigation = true;
        try {
            const view = document.body.classList.contains('view-mode-participants')
                ? 'participants'
                : (typeof currentView !== 'undefined' ? currentView : readCurrentShellView());
            const allocationType = document.body.dataset.activePlanTemplate === 'team' ? 'team' : 'car';
            const states = [
                ['tab-sheet', view === 'sheet'],
                ['tab-seisan', view === 'seisan'],
                ['tab-list', view === 'list' && allocationType === 'car'],
                ['tab-team', view === 'list' && allocationType === 'team'],
                ['tab-participants', view === 'participants']
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

        } finally {
            syncingCarbonPrimaryNavigation = false;
        }
    }

    function setDestinationLabel(tab, text) {
        if (!tab) return;
        tab.querySelector('.view-tab-icon')?.remove();
        const label = tab.querySelector('.view-tab-label');
        if (!label) return;
        label.replaceChildren(document.createTextNode(text));
    }

    function ensureCarbonPrimaryNavigation() {
        const bar = byId('view-toggle-bar');
        if (!bar || bar.dataset.carbonFourViewNav === 'true') return;
        const sheetTab = byId('tab-sheet');
        const settlementTab = byId('tab-seisan');
        const carTab = byId('tab-list');
        const participantTab = byId('tab-participants');
        const existingTeamTab = byId('tab-team');
        // The canonical four destinations are now in the initial document.
        // Do not build a transient sheet/team navigation and then replace it
        // after hydration; that moved the toolbar while the page was loading.
        if (!sheetTab && settlementTab && carTab && participantTab && existingTeamTab) {
            bar.dataset.carbonFourViewNav = 'true';
            syncCarbonPrimaryNavigationState();
            return;
        }
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

    function setProjectTitleExpanded(expanded) {
        const region = byId('projectTitleRegion');
        const roomInput = byId('roomNameInput');
        if (!region || !roomInput) return;
        const nextState = expanded ? 'expanded' : 'collapsed';
        if (region.dataset.state === nextState) return;
        if (!expanded && roomInput.matches?.(':focus-within')) roomInput.blur?.();
        region.dataset.state = nextState;
        roomInput.inert = !expanded;
        roomInput.tabIndex = expanded ? 0 : -1;
    }

    function getActiveProjectTitleScrollNodes() {
        if (document.body.classList.contains('view-mode-sheet')) {
            return [byId('sheet-view-area'), byId('sheet-canvas')].filter(Boolean);
        }
        if (document.body.classList.contains('view-mode-seisan')) return [byId('seisan-view-area')].filter(Boolean);
        return [byId('top-area')].filter(Boolean);
    }

    function getActiveProjectTitleScrollTop() {
        return Math.max(0, ...getActiveProjectTitleScrollNodes().map(node => Number(node.scrollTop || 0)));
    }

    function setupProjectTitleReveal() {
        if (document.documentElement.dataset.projectTitleRevealBound === 'true') return;
        document.documentElement.dataset.projectTitleRevealBound = 'true';
        const scrollNodes = [byId('top-area'), byId('sheet-view-area'), byId('sheet-canvas'), byId('seisan-view-area')].filter(Boolean);
        scrollNodes.forEach(node => node.addEventListener('scroll', () => {
            const scrollTop = Number(node.scrollTop || 0);
            if (scrollTop > PROJECT_TITLE_SCROLL_THRESHOLD) {
                setProjectTitleExpanded(false);
                return;
            }
            if (scrollTop <= 0) setProjectTitleExpanded(true);
        }, { passive: true }));

        document.addEventListener('wheel', event => {
            if (event.deltaY > PROJECT_TITLE_SCROLL_THRESHOLD) {
                setProjectTitleExpanded(false);
                return;
            }
            if (event.deltaY < -PROJECT_TITLE_SCROLL_THRESHOLD && getActiveProjectTitleScrollTop() <= 0) setProjectTitleExpanded(true);
        }, { passive: true });
        document.addEventListener('pointerdown', event => {
            if (event.pointerType === 'touch') projectTitlePointerStartY = event.clientY;
        }, { passive: true });
        document.addEventListener('pointermove', event => {
            if (event.pointerType !== 'touch' || projectTitlePointerStartY === null) return;
            const deltaY = event.clientY - projectTitlePointerStartY;
            if (deltaY <= -PROJECT_TITLE_PULL_THRESHOLD) {
                setProjectTitleExpanded(false);
                projectTitlePointerStartY = event.clientY;
                return;
            }
            if (getActiveProjectTitleScrollTop() <= 0 && deltaY >= PROJECT_TITLE_PULL_THRESHOLD) {
                setProjectTitleExpanded(true);
                projectTitlePointerStartY = event.clientY;
            }
        }, { passive: true });
        ['pointerup', 'pointercancel'].forEach(type => document.addEventListener(type, () => {
            projectTitlePointerStartY = null;
        }, { passive: true }));
        document.addEventListener('keydown', event => {
            if (!['ArrowUp', 'PageUp', 'Home'].includes(event.key)) return;
            if (getActiveProjectTitleScrollTop() <= 0) setProjectTitleExpanded(true);
        });
    }

    function setupAppNavigationDrawer() {
        const drawer = byId('overviewDrawer');
        const trigger = byId('overviewMenuBtn');
        if (!drawer || drawer.tagName !== 'CDS-SIDE-NAV' || !trigger) return;
        drawer.setAttribute('aria-label', '山歩会ツール');
        drawer.setAttribute('collapse-mode', 'responsive');
        drawer.setAttribute('is-not-persistent', '');
        trigger.setAttribute('aria-controls', 'overviewDrawer');
    }

    function setupStaticHeaderEvents() {
        ensureCarbonShellHeader();
        ensureCarbonPrimaryNavigation();
        setupAppNavigationDrawer();
        setupProjectTitleReveal();
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
        bind('shareLinkBtn', () => copyUrl());
        bind('fillEmptySeatsBtn', () => autoAssign('fill'));
        bind('shuffleAssignBtn', () => autoAssign('shuffle'));
        bind('tray-handle', () => toggleTray());
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
