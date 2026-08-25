// Unified Carbon assignment workspace.
// Allocation state, sync, drag/drop, and auto-assign algorithms remain owned by their existing modules.
(function (global) {
    'use strict';

    const D = global.document;
    const byId = id => D.getElementById(id);
    let observer = null;
    let syncFrame = 0;
    let switcherCommit = false;
    let shareInitialTypeApplied = false;

    function isSharedReadOnlyMode() {
        return new URLSearchParams(global.location.search).get('view') === 'sheet';
    }

    function requestedShareType() {
        return new URLSearchParams(global.location.search).get('allocation') === 'team' ? 'team' : 'car';
    }

    function activeType() {
        return D.body.dataset.activePlanTemplate === 'team' ? 'team' : 'car';
    }

    function ensureStylesheet() {
        if (D.querySelector('link[data-assignment-workspace-style]')) return;
        const link = D.createElement('link');
        link.rel = 'stylesheet';
        link.href = './assets/css/cars-members-tray/assignment-workspace-refresh.css?v=assignment-workspace-v2';
        link.dataset.assignmentWorkspaceStyle = 'true';
        D.head.appendChild(link);
    }

    function replaceTabLabel(tab, text) {
        const label = tab?.querySelector('.view-tab-label');
        if (!label) return;
        const lock = label.querySelector('.view-tab-lock-indicator');
        const textNode = label.firstChild;
        const alreadyCorrect = textNode?.nodeType === global.Node.TEXT_NODE
            && textNode.textContent === text
            && label.childNodes.length === (lock ? 2 : 1);
        if (alreadyCorrect) return;
        label.replaceChildren(D.createTextNode(text));
        if (lock) label.appendChild(lock);
    }

    function syncShellShareVisibility() {
        const shellShare = byId('shareLinkBtn');
        if (!shellShare) return;
        const hidden = isSharedReadOnlyMode() || D.body.classList.contains('view-mode-list');
        shellShare.hidden = hidden;
    }

    function simplifyPrimaryNavigation() {
        const workspaceTab = byId('tab-list');
        const teamTab = byId('tab-team');
        const sheetTab = byId('tab-sheet');
        const participantTab = byId('tab-participants');
        const settlementTab = byId('tab-seisan');
        const bar = byId('view-toggle-bar');
        if (sheetTab) sheetTab.hidden = true;
        if (teamTab) teamTab.hidden = true;
        if (!workspaceTab) return;

        workspaceTab.dataset.allocationType = 'workspace';
        workspaceTab.setAttribute('aria-label', '車割・班割');
        replaceTabLabel(workspaceTab, '車割・班割');

        // Primary navigation represents destinations only. Car/team is a view switch inside
        // this workspace, so it must not consume another primary tab.
        if (bar) [participantTab, workspaceTab, settlementTab].filter(Boolean).forEach(tab => bar.appendChild(tab));

        if (D.body.classList.contains('view-mode-list')) {
            workspaceTab.classList.add('active');
            workspaceTab.toggleAttribute('selected', true);
            workspaceTab.setAttribute('aria-current', 'page');
            teamTab?.classList.remove('active');
            teamTab?.removeAttribute('selected');
            teamTab?.removeAttribute('aria-current');
            if (bar) {
                bar.setAttribute('value', 'car');
                try { bar.value = 'car'; } catch (_) {}
            }
        }
        syncShellShareVisibility();
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

    function switchAllocationType(value) {
        const next = value === 'team' ? 'team' : 'car';
        if (next === activeType()) return;
        if (isSharedReadOnlyMode() && typeof global.switchCarPlan === 'function') {
            global.switchCarPlan(next, { persist: false });
            return;
        }
        if (typeof global.updateActiveCarPlanTemplate === 'function') global.updateActiveCarPlanTemplate(next);
        else if (typeof global.switchCarPlan === 'function') global.switchCarPlan(next);
    }

    function bindTypeSwitcher() {
        const switcher = byId('assignmentTypeSwitcher');
        if (!switcher || switcher.dataset.assignmentBound === 'true') return;
        switcher.dataset.assignmentBound = 'true';

        const commit = value => {
            const next = value === 'team' ? 'team' : 'car';
            if (switcherCommit || next === activeType()) return;
            switcherCommit = true;
            try { switchAllocationType(next); }
            finally {
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
        if (!actions || isSharedReadOnlyMode()) return;

        const fill = byId('fillEmptySeatsBtn');
        if (fill && fill.parentElement !== actions) {
            fill.setAttribute('kind', 'ghost');
            actions.appendChild(fill);
        }

        const randomTools = D.querySelector('#bottom-tray .random-tools, .random-tools');
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
        if (!header || isSharedReadOnlyMode()) return;
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
                    <cds-menu-item data-assignment-group-action="return"><span data-carbon-icon="undo" slot="render-icon" aria-hidden="true"></span></cds-menu-item>
                </cds-menu>`;
            header.appendChild(menu);
            menu.addEventListener('click', event => {
                const item = event.composedPath?.().find(node => node instanceof global.Element && node.matches?.('[data-assignment-group-action]'));
                if (!item) return;
                event.preventDefault();
                event.stopPropagation();
                if (item.dataset.assignmentGroupAction === 'capacity') box.querySelector('.capacity-edit-btn')?.click();
                if (item.dataset.assignmentGroupAction === 'return') box.querySelector('.car-return-btn')?.click();
                try { menu.open = false; } catch (_) {}
            });
        }
        const returnItem = menu.querySelector('[data-assignment-group-action="return"]');
        const label = type === 'team' ? '班長を未配置に戻す' : '運転手を未配置に戻す';
        if (returnItem?.getAttribute('label') !== label) returnItem?.setAttribute('label', label);
    }

    function ensureDragHandle(card) {
        if (isSharedReadOnlyMode()) return;
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
            const primary = slot === empty[0];
            const collapsed = empty.includes(slot) && !primary;
            slot.classList.toggle('assignment-empty-seat--primary', primary);
            slot.classList.toggle('assignment-empty-seat--collapsed', collapsed);
            if (!empty.includes(slot)) slot.querySelector('.assignment-empty-label')?.remove();
        });
        const first = empty[0];
        if (!first) return;
        let label = first.querySelector('.assignment-empty-label');
        if (!label) {
            label = D.createElement('span');
            label.className = 'assignment-empty-label';
            first.prepend(label);
        }
        const text = `${empty.length}席空き`;
        if (label.textContent !== text) label.textContent = text;
    }

    function currentMemberBox(card) {
        return card.closest('.car-box');
    }

    function firstOpenSeat(box, movingCard = null) {
        return Array.from(box?.querySelectorAll('.seat-slot') || []).find(slot => {
            const occupant = slot.querySelector('.member-card');
            return !occupant || occupant === movingCard;
        }) || null;
    }

    function rebuildMoveMenu(card, boxes, type) {
        if (isSharedReadOnlyMode()) return;
        const menu = card.querySelector('.person-pop-menu');
        if (!menu) return;
        menu.querySelector('.assignment-person-move-menu')?.remove();

        const move = D.createElement('cds-menu-item');
        move.className = 'assignment-person-move-menu';
        move.setAttribute('label', '移動');
        if (card.dataset.locked === 'true') move.setAttribute('disabled', '');

        const group = D.createElement('cds-menu-item-group');
        group.slot = 'submenu';
        const currentBox = currentMemberBox(card);
        boxes.forEach((box, index) => {
            const item = D.createElement('cds-menu-item');
            item.setAttribute('label', type === 'team' ? `${index + 1}班` : `${index + 1}号車`);
            item.dataset.assignmentMoveTarget = String(index);
            if (box === currentBox || !firstOpenSeat(box, card)) item.setAttribute('disabled', '');
            group.appendChild(item);
        });
        if (card.parentElement?.id !== 'waiting-list') {
            const waiting = D.createElement('cds-menu-item');
            waiting.setAttribute('label', '未配置');
            waiting.dataset.assignmentMoveTarget = 'waiting';
            group.appendChild(waiting);
        }
        move.appendChild(group);
        menu.prepend(move);
    }

    function handleMoveMenuClick(event) {
        const path = event.composedPath?.() || [];
        const item = path.find(node => node instanceof global.Element && node.hasAttribute?.('data-assignment-move-target'));
        if (!item || item.hasAttribute('disabled')) return;
        const card = path.find(node => node instanceof global.Element && node.classList?.contains('member-card'))
            || item.closest('.member-card');
        if (!card || card.dataset.locked === 'true') return;

        const target = item.dataset.assignmentMoveTarget;
        if (target === 'waiting') {
            byId('waiting-list')?.appendChild(card);
        } else {
            const box = D.querySelectorAll('#cars-container .car-box')[Number(target)];
            const slot = firstOpenSeat(box, card);
            if (!slot) {
                global.showMiniToast?.('空きがありません', 'warning');
                return;
            }
            slot.appendChild(card);
        }
        event.preventDefault();
        event.stopPropagation();
        global.updateUI?.();
        global.save?.();
        scheduleSync();
    }

    function bindMoveMenuEvents() {
        if (D.documentElement.dataset.assignmentMoveBound === 'true') return;
        D.documentElement.dataset.assignmentMoveBound = 'true';
        D.addEventListener('click', handleMoveMenuClick, true);
    }

    function decorateCards() {
        const type = activeType();
        const boxes = Array.from(D.querySelectorAll('#cars-container .car-box'));
        boxes.forEach((box, index) => {
            box.dataset.assignmentIndex = String(index + 1);
            const groupLabel = box.querySelector('.car-name-label');
            const nextLabel = type === 'team' ? `${index + 1}班` : `${index + 1}号車`;
            if (groupLabel && groupLabel.textContent !== nextLabel) groupLabel.textContent = nextLabel;
            const role = box.querySelector('.driver-role-tag');
            const nextRole = type === 'team' ? '班長' : '運転手';
            if (role && role.textContent !== nextRole) role.textContent = nextRole;
            ensureGroupOverflow(box, type);
            decorateEmptySeats(box);
        });

        D.querySelectorAll('#cars-container .member-card, #waiting-list .member-card').forEach(card => {
            ensureDragHandle(card);
            syncLockIndicator(card);
            rebuildMoveMenu(card, boxes, type);
        });
        global.SanpoCarbon?.renderCarbonIcons?.(byId('cars-container'));
        global.SanpoCarbon?.renderCarbonIcons?.(byId('waiting-list'));
    }

    function syncSwitcher() {
        const type = activeType();
        const switcher = byId('assignmentTypeSwitcher');
        if (!switcher) return;
        if (switcher.getAttribute('value') !== type) switcher.setAttribute('value', type);
        try { if (switcher.value !== type) switcher.value = type; } catch (_) {}
        switcher.querySelectorAll('cds-content-switcher-item').forEach(item => {
            const selected = (item.value || item.getAttribute('value')) === type;
            if (!!item.selected !== selected) item.selected = selected;
            item.toggleAttribute('selected', selected);
        });
    }

    function syncSummary() {
        const summary = byId('assignmentWorkspaceSummary');
        if (!summary) return;
        const type = activeType();
        const groups = D.querySelectorAll('#cars-container .car-box').length;
        const waiting = D.querySelectorAll('#waiting-list .member-card').length;
        const passengers = D.querySelectorAll('#cars-container .member-card').length;
        const owners = D.querySelectorAll('#cars-container .driver-seat').length;
        const total = passengers + owners + waiting;
        const unit = type === 'team' ? '班' : '台';
        const text = `${total}人 · ${groups}${unit} · 未配置${waiting}人`;
        if (summary.textContent !== text) summary.textContent = text;
    }

    function applyShareInitialType() {
        if (!isSharedReadOnlyMode() || shareInitialTypeApplied) return;
        shareInitialTypeApplied = true;
        const requested = requestedShareType();
        if (requested !== activeType()) switchAllocationType(requested);
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

        const roomInput = byId('roomNameInput');
        if (roomInput) {
            roomInput.readOnly = true;
            roomInput.toggleAttribute('readonly', true);
        }
    }

    function syncNow() {
        syncFrame = 0;
        D.body.classList.add('assignment-workspace-enabled');
        createHeader();
        relocateAllocationActions();
        simplifyPrimaryNavigation();
        applyShareInitialType();
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
        const navigation = byId('view-toggle-bar');
        if (cars) observer.observe(cars, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-locked', 'data-capacity'] });
        if (waiting) observer.observe(waiting, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-locked'] });
        if (navigation) observer.observe(navigation, { childList: true });
        observer.observe(D.body, { attributes: true, attributeFilter: ['class', 'data-active-plan-template'] });
    }

    function initialize() {
        ensureStylesheet();
        D.body.classList.add('assignment-workspace-enabled');
        createHeader();
        relocateAllocationActions();
        bindMoveMenuEvents();
        observe();
        syncNow();
    }

    global.SanpoAssignmentWorkspace = Object.freeze({
        initialize,
        refresh: scheduleSync,
        isReadOnly: isSharedReadOnlyMode
    });
})(window);
