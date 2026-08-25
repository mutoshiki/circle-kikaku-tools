// Unified Carbon assignment workspace
// Presentation/orchestration only: allocation state, sync, drag, and auto-assign owners stay unchanged.
(function (global) {
    'use strict';

    const D = global.document;
    const byId = id => D.getElementById(id);
    let observer = null;
    let syncFrame = 0;
    let switcherCommit = false;

    function isSharedReadOnlyMode() {
        return new URLSearchParams(global.location.search).get('view') === 'sheet';
    }

    function ensureStylesheet() {
        if (D.querySelector('link[data-assignment-workspace-style]')) return;
        const link = D.createElement('link');
        link.rel = 'stylesheet';
        link.href = './assets/css/cars-members-tray/assignment-workspace-refresh.css?v=assignment-workspace-v1';
        link.dataset.assignmentWorkspaceStyle = 'true';
        D.head.appendChild(link);
    }

    function activeType() {
        return D.body.dataset.activePlanTemplate === 'team' ? 'team' : 'car';
    }

    function replaceTabLabel(tab, text) {
        const label = tab?.querySelector('.view-tab-label');
        if (!label) return;
        const lock = label.querySelector('.view-tab-lock-indicator');
        label.replaceChildren(D.createTextNode(text));
        if (lock) label.appendChild(lock);
    }

    function simplifyPrimaryNavigation() {
        const carTab = byId('tab-list');
        const teamTab = byId('tab-team');
        const sheetTab = byId('tab-sheet');
        const bar = byId('view-toggle-bar');
        if (sheetTab) sheetTab.hidden = true;
        if (teamTab) teamTab.hidden = true;
        if (!carTab) return;

        carTab.dataset.allocationType = 'workspace';
        carTab.setAttribute('aria-label', '車割・班割');
        replaceTabLabel(carTab, '車割・班割');

        if (D.body.classList.contains('view-mode-list')) {
            carTab.classList.add('active');
            carTab.toggleAttribute('selected', true);
            carTab.setAttribute('aria-current', 'page');
            if (teamTab) {
                teamTab.classList.remove('active');
                teamTab.removeAttribute('selected');
                teamTab.removeAttribute('aria-current');
            }
            if (bar) {
                bar.setAttribute('value', 'car');
                try { bar.value = 'car'; } catch (_) {}
            }
        }
    }

    function createHeader() {
        const topArea = byId('top-area');
        if (!topArea) return null;
        let header = byId('assignmentWorkspaceHeader');
        if (header) return header;

        header = D.createElement('section');
        header.id = 'assignmentWorkspaceHeader';
        header.className = 'assignment-workspace-header';
        header.setAttribute('aria-labelledby', 'assignmentWorkspaceTitle');
        header.innerHTML = `
            <div class="assignment-workspace-heading-row">
                <div class="assignment-workspace-title-block">
                    <h2 class="assignment-workspace-title" id="assignmentWorkspaceTitle">車割・班割</h2>
                    <p class="assignment-workspace-summary" id="assignmentWorkspaceSummary" aria-live="polite"></p>
                </div>
                <cds-button id="assignmentShareBtn" class="assignment-workspace-share" kind="primary" size="lg" type="button">
                    <span>共有</span><span data-carbon-icon="link" slot="icon" aria-hidden="true"></span>
                </cds-button>
            </div>
            <div class="assignment-workspace-switcher-row">
                <cds-content-switcher id="assignmentTypeSwitcher" size="lg" value="car" aria-label="割り当ての種類">
                    <cds-content-switcher-item value="car" selected>車割</cds-content-switcher-item>
                    <cds-content-switcher-item value="team">班割</cds-content-switcher-item>
                </cds-content-switcher>
            </div>
            <div id="assignmentWorkspaceActions" class="assignment-workspace-actions" aria-label="車割・班割の操作"></div>`;

        const legacyHeader = topArea.querySelector(':scope > .edit-header');
        topArea.insertBefore(header, legacyHeader || topArea.firstChild);

        byId('assignmentShareBtn')?.addEventListener('click', () => global.copyUrl?.());
        bindTypeSwitcher();
        global.SanpoCarbon?.renderCarbonIcons?.(header);
        return header;
    }

    function bindTypeSwitcher() {
        const switcher = byId('assignmentTypeSwitcher');
        if (!switcher || switcher.dataset.assignmentBound === 'true') return;
        switcher.dataset.assignmentBound = 'true';

        const commit = value => {
            const next = value === 'team' ? 'team' : 'car';
            if (switcherCommit || next === activeType()) return;
            switcherCommit = true;
            try {
                if (typeof global.updateActiveCarPlanTemplate === 'function') global.updateActiveCarPlanTemplate(next);
                else if (typeof global.switchCarPlan === 'function') global.switchCarPlan(next);
            } finally {
                queueMicrotask(() => {
                    switcherCommit = false;
                    scheduleSync();
                });
            }
        };

        switcher.addEventListener('cds-content-switcher-selected', event => {
            const item = event.detail?.item;
            if (!item || !switcher.contains(item)) return;
            commit(item.value || item.getAttribute('value'));
        });
        switcher.addEventListener('change', event => {
            const item = event.detail?.item || event.target?.closest?.('cds-content-switcher-item');
            commit(item?.value || item?.getAttribute?.('value') || switcher.value);
        });
    }

    function relocateAllocationActions() {
        const actions = byId('assignmentWorkspaceActions');
        if (!actions) return;

        const randomTools = D.querySelector('#bottom-tray .random-tools, .random-tools');
        const fill = byId('fillEmptySeatsBtn');
        if (fill && fill.parentElement !== actions) {
            fill.setAttribute('kind', 'ghost');
            fill.querySelector('span:not([data-carbon-icon])')?.replaceChildren(D.createTextNode('空きを埋める'));
            actions.appendChild(fill);
        }
        if (randomTools && randomTools.parentElement !== actions) {
            const shuffle = byId('shuffleAssignBtn');
            if (shuffle) {
                shuffle.setAttribute('kind', 'tertiary');
                const label = Array.from(shuffle.children).find(node => node.tagName !== 'SVG' && !node.hasAttribute?.('data-carbon-icon'));
                if (label) label.textContent = '自動で割り当て';
            }
            actions.appendChild(randomTools);
        }
    }

    function ensureGroupOverflow(box, type) {
        const header = box.querySelector('.car-header');
        if (!header) return;
        let menu = header.querySelector('.assignment-group-menu');
        if (!menu) {
            menu = D.createElement('cds-overflow-menu');
            menu.className = 'assignment-group-menu';
            menu.kind = 'ghost';
            menu.size = 'md';
            menu.setAttribute('label', 'グループの操作');
            menu.setAttribute('aria-label', 'グループの操作');
            menu.setAttribute('enable-v12-overflowmenu', '');
            menu.innerHTML = `
                <span slot="icon" data-carbon-icon="overflow-menu-vertical" aria-hidden="true"></span>
                <cds-menu>
                    <cds-menu-item label="定員を変更" data-assignment-group-action="capacity"><span data-carbon-icon="edit" slot="render-icon" aria-hidden="true"></span></cds-menu-item>
                    <cds-menu-item label="${type === 'team' ? '班長を未配置に戻す' : '運転手を未配置に戻す'}" data-assignment-group-action="return"><span data-carbon-icon="undo" slot="render-icon" aria-hidden="true"></span></cds-menu-item>
                </cds-menu>`;
            header.appendChild(menu);
            menu.addEventListener('click', event => {
                const item = event.composedPath?.().find(node => node instanceof Element && node.matches?.('[data-assignment-group-action]'));
                if (!item) return;
                event.preventDefault();
                event.stopPropagation();
                if (item.dataset.assignmentGroupAction === 'capacity') box.querySelector('.capacity-edit-btn')?.click();
                if (item.dataset.assignmentGroupAction === 'return') box.querySelector('.car-return-btn')?.click();
                try { menu.open = false; } catch (_) {}
            });
        }
        const returnItem = menu.querySelector('[data-assignment-group-action="return"]');
        returnItem?.setAttribute('label', type === 'team' ? '班長を未配置に戻す' : '運転手を未配置に戻す');
    }

    function ensureDragHandle(card) {
        const line = card.querySelector('.member-main-line');
        if (!line || line.querySelector('.assignment-drag-handle')) return;
        const handle = D.createElement('span');
        handle.className = 'assignment-drag-handle';
        handle.setAttribute('aria-hidden', 'true');
        handle.innerHTML = '<span data-carbon-icon="draggable" aria-hidden="true"></span>';
        line.prepend(handle);
    }

    function syncLockIndicator(card) {
        const line = card.querySelector('.member-main-line');
        if (!line) return;
        let indicator = line.querySelector('.assignment-lock-indicator');
        const locked = card.dataset.locked === 'true';
        if (!locked) {
            indicator?.remove();
            return;
        }
        if (!indicator) {
            indicator = D.createElement('span');
            indicator.className = 'assignment-lock-indicator';
            indicator.setAttribute('aria-label', '固定');
            indicator.innerHTML = '<span data-carbon-icon="locked" aria-hidden="true"></span>';
            const menu = line.querySelector('.person-overflow-menu');
            line.insertBefore(indicator, menu || null);
        }
    }

    function decorateEmptySeats(box) {
        const slots = Array.from(box.querySelectorAll('.seat-slot'));
        const empty = slots.filter(slot => !slot.querySelector('.member-card'));
        slots.forEach(slot => {
            slot.classList.remove('assignment-empty-seat--primary', 'assignment-empty-seat--collapsed');
            slot.querySelector('.assignment-empty-label')?.remove();
        });
        empty.forEach((slot, index) => {
            slot.classList.add(index === 0 ? 'assignment-empty-seat--primary' : 'assignment-empty-seat--collapsed');
        });
        const first = empty[0];
        if (first) {
            const label = D.createElement('span');
            label.className = 'assignment-empty-label';
            label.textContent = `${empty.length}席空き`;
            first.prepend(label);
        }
    }

    function decorateCards() {
        const type = activeType();
        const boxes = Array.from(D.querySelectorAll('#cars-container .car-box'));
        boxes.forEach((box, index) => {
            box.dataset.assignmentIndex = String(index + 1);
            const groupLabel = box.querySelector('.car-name-label');
            if (groupLabel) groupLabel.textContent = type === 'team' ? `${index + 1}班` : `${index + 1}号車`;
            const driverRole = box.querySelector('.driver-role-tag');
            if (driverRole) driverRole.textContent = type === 'team' ? '班長' : '運転手';
            ensureGroupOverflow(box, type);
            decorateEmptySeats(box);
        });

        D.querySelectorAll('#cars-container .member-card, #waiting-list .member-card').forEach(card => {
            ensureDragHandle(card);
            syncLockIndicator(card);
        });
        global.SanpoCarbon?.renderCarbonIcons?.(byId('cars-container'));
        global.SanpoCarbon?.renderCarbonIcons?.(byId('waiting-list'));
    }

    function syncSwitcher() {
        const type = activeType();
        const switcher = byId('assignmentTypeSwitcher');
        if (!switcher) return;
        switcher.setAttribute('value', type);
        try { switcher.value = type; } catch (_) {}
        switcher.querySelectorAll('cds-content-switcher-item').forEach(item => {
            const selected = (item.value || item.getAttribute('value')) === type;
            item.selected = selected;
            item.toggleAttribute('selected', selected);
        });
    }

    function syncSummary() {
        const summary = byId('assignmentWorkspaceSummary');
        if (!summary) return;
        const type = activeType();
        const groups = D.querySelectorAll('#cars-container .car-box').length;
        const waiting = D.querySelectorAll('#waiting-list .member-card').length;
        const assignedMembers = D.querySelectorAll('#cars-container .member-card').length;
        const drivers = D.querySelectorAll('#cars-container .driver-seat').length;
        const total = assignedMembers + drivers + waiting;
        const unit = type === 'team' ? '班' : '台';
        summary.textContent = `${total}人 · ${groups}${unit} · 未配置${waiting}人`;
    }

    function applyReadOnlyMode() {
        const readonly = isSharedReadOnlyMode();
        D.body.classList.toggle('assignment-readonly', readonly);
        if (!readonly) return;

        const topArea = byId('top-area');
        const sheetArea = byId('sheet-view-area');
        const tray = byId('bottom-tray');
        if (topArea) {
            topArea.hidden = false;
            topArea.style.display = '';
        }
        if (sheetArea) {
            sheetArea.hidden = true;
            sheetArea.classList.remove('active');
            sheetArea.style.display = 'none';
        }
        if (tray) tray.style.display = 'none';

        const editor = byId('projectTitleEditor');
        if (editor) {
            editor.setAttribute('contenteditable', 'false');
            editor.setAttribute('aria-readonly', 'true');
            editor.tabIndex = -1;
        }
    }

    function syncNow() {
        syncFrame = 0;
        D.body.classList.add('assignment-workspace-enabled');
        createHeader();
        relocateAllocationActions();
        simplifyPrimaryNavigation();
        syncSwitcher();
        decorateCards();
        syncSummary();
        applyReadOnlyMode();
        global.SanpoCarbon?.renderCarbonIcons?.(byId('assignmentWorkspaceHeader'));
    }

    function scheduleSync() {
        if (syncFrame) return;
        syncFrame = global.requestAnimationFrame(syncNow);
    }

    function observe() {
        observer?.disconnect();
        observer = new MutationObserver(scheduleSync);
        const cars = byId('cars-container');
        const waiting = byId('waiting-list');
        if (cars) observer.observe(cars, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-locked', 'data-capacity', 'class'] });
        if (waiting) observer.observe(waiting, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-locked', 'class'] });
        observer.observe(D.body, { attributes: true, attributeFilter: ['class', 'data-active-plan-template'] });
    }

    function initialize() {
        ensureStylesheet();
        D.body.classList.add('assignment-workspace-enabled');
        createHeader();
        relocateAllocationActions();
        observe();
        syncNow();
    }

    global.SanpoAssignmentWorkspace = Object.freeze({
        initialize,
        refresh: scheduleSync,
        isReadOnly: isSharedReadOnlyMode
    });
})(window);
