// Unified Carbon Assignment Workspace.
// Car/team allocation is a normal editor destination alongside Participants and Settlement.
// This owner exposes one bulk action (random assignment), compact group rows and direct seat picking.
// Card drag, the visible waiting drawer, allocation-local type switching and special share views are retired.
(function (global) {
    'use strict';

    const D = global.document;
    const byId = id => D.getElementById(id);
    let observer = null;
    let syncFrame = 0;
    let requestedAllocationType = '';
    let applyingAllocationSelection = false;

    function activeType() {
        return D.body.dataset.activePlanTemplate === 'team' ? 'team' : 'car';
    }

    function ensureStylesheet() {
        let link = D.querySelector('link[data-assignment-workspace-style]');
        if (!link) {
            link = D.createElement('link');
            link.rel = 'stylesheet';
            link.dataset.assignmentWorkspaceStyle = 'true';
            D.head.appendChild(link);
        }
        const href = './assets/css/cars-members-tray/assignment-workspace-refresh.css?v=assignment-workspace-v10';
        if (!link.href.endsWith(href.replace('./', ''))) link.href = href;
    }

    function setAttributeIfChanged(element, name, value) {
        if (element?.getAttribute(name) !== value) element?.setAttribute(name, value);
    }

    function replaceTabLabel(tab, text) {
        const label = tab?.querySelector('.view-tab-label');
        if (!label) return;
        const lock = label.querySelector('.view-tab-lock-indicator');
        const current = Array.from(label.childNodes)
            .filter(node => node !== lock)
            .map(node => node.textContent || '')
            .join('').trim();
        if (current === text) return;
        label.replaceChildren(D.createTextNode(text));
        if (lock) label.appendChild(lock);
    }

    function simplifyPrimaryNavigation() {
        const carTab = byId('tab-list');
        const teamTab = byId('tab-team');
        const participantTab = byId('tab-participants');
        const settlementTab = byId('tab-seisan');
        const sheetTab = byId('tab-sheet');
        const bar = byId('view-toggle-bar');
        if (!bar || !carTab || !teamTab || !participantTab || !settlementTab) return;

        sheetTab?.remove();
        if (carTab.dataset.allocationType !== 'car') carTab.dataset.allocationType = 'car';
        if (teamTab.dataset.allocationType !== 'team') teamTab.dataset.allocationType = 'team';
        setAttributeIfChanged(carTab, 'value', 'car');
        setAttributeIfChanged(teamTab, 'value', 'team');
        replaceTabLabel(participantTab, '参加者');
        replaceTabLabel(carTab, '車割');
        replaceTabLabel(teamTab, '班割');
        replaceTabLabel(settlementTab, '精算');
        setAttributeIfChanged(carTab, 'aria-label', '車割');
        setAttributeIfChanged(teamTab, 'aria-label', '班割');

        const desired = [participantTab, carTab, teamTab, settlementTab];
        if (desired.some((tab, index) => bar.children[index] !== tab) || bar.children.length !== desired.length) {
            bar.replaceChildren(...desired);
        }
        if (bar.dataset.assignmentFourDestinationNav !== 'true') {
            bar.dataset.assignmentFourDestinationNav = 'true';
            global.syncCarbonPrimaryNavigationState?.();
        }

        const shellShare = byId('shareLinkBtn');
        if (shellShare) shellShare.hidden = false;
    }

    async function applyCarbonAllocationSelection(templateType) {
        await global.switchView?.('list');
        const next = templateType === 'team' ? 'team' : 'car';
        if (typeof global.updateActiveCarPlanTemplate === 'function') global.updateActiveCarPlanTemplate(next);
        else global.switchCarPlan?.(next);
        const url = new URL(global.location.href);
        url.searchParams.delete('view');
        url.searchParams.delete('allocation');
        global.history.replaceState(global.history.state, '', `${url.pathname}${url.search}${url.hash}`);
        global.SanpoAssignmentWorkspace?.refresh?.();
        global.syncCarbonPrimaryNavigationState?.();
    }

    function bindCarbonAllocationSelection() {
        [['tab-list', 'car'], ['tab-team', 'team']].forEach(([id, templateType]) => {
            const tab = byId(id);
            if (!tab || tab.dataset.assignmentDestinationOwner === 'true') return;
            tab.dataset.assignmentDestinationOwner = 'true';
            const request = () => {
                if (!(tab.selected || tab.hasAttribute('selected'))) return;
                requestedAllocationType = templateType;
                if (applyingAllocationSelection) return;
                applyingAllocationSelection = true;
                void (async () => {
                    while (requestedAllocationType) {
                        const next = requestedAllocationType;
                        requestedAllocationType = '';
                        await applyCarbonAllocationSelection(next);
                    }
                    applyingAllocationSelection = false;
                })();
            };
            // Carbon owns pointer/keyboard selection. The app observes only its
            // selected state, so no host/shadow click listener competes with it.
            new MutationObserver(request).observe(tab, { attributes: true, attributeFilter: ['selected'] });
            Promise.resolve(tab.updateComplete).then(request);
        });
    }

    function createHeader() {
        const topArea = byId('top-area');
        if (!topArea) return null;
        let header = byId('assignmentWorkspaceHeader');
        if (header) return header;

        header = D.createElement('section');
        header.id = 'assignmentWorkspaceHeader';
        header.className = 'assignment-workspace-header';
        header.setAttribute('aria-label', '割り当て操作');
        header.innerHTML = `
            <div class="assignment-workspace-meta-row">
                <p class="assignment-workspace-summary" id="assignmentWorkspaceSummary" aria-live="polite"></p>
            </div>
            <div id="assignmentWorkspaceActions" class="assignment-workspace-actions" aria-label="割り当ての操作"></div>`;
        const legacyHeader = topArea.querySelector(':scope > .edit-header');
        topArea.insertBefore(header, legacyHeader || topArea.firstChild);
        return header;
    }

    function removeRetiredAllocationControls() {
        ['fillEmptySeatsBtn', 'traySettingsBtn', 'autoAssignPopover', 'autoAssignMenu', 'clearAllBtn', 'optFemale', 'optMale', 'optGrade']
            .forEach(id => byId(id)?.remove());
    }

    function relocateAllocationActions() {
        const actions = byId('assignmentWorkspaceActions');
        if (!actions) return;
        removeRetiredAllocationControls();

        let addGroup = byId('assignmentWorkspaceAddGroupBtn');
        if (!addGroup) {
            addGroup = D.createElement('cds-button');
            addGroup.id = 'assignmentWorkspaceAddGroupBtn';
            addGroup.className = 'assignment-workspace-add-group';
            // Creation is a secondary action. Random assignment remains the one
            // workspace-level primary action.
            addGroup.setAttribute('kind', 'secondary');
            addGroup.setAttribute('size', 'lg');
            addGroup.setAttribute('type', 'button');
            addGroup.innerHTML = '<span data-carbon-icon="add" slot="icon" aria-hidden="true"></span><span></span>';
            addGroup.addEventListener('click', openGroupCreateModal);
        }
        const type = activeType();
        const groupLabel = type === 'team' ? '班' : '車';
        addGroup.setAttribute('aria-label', `${groupLabel}を追加`);
        const addLabel = addGroup.querySelector('span:not([slot="icon"]):not([data-carbon-icon])');
        if (addLabel) addLabel.textContent = `${groupLabel}を追加`;
        if (addGroup.parentElement !== actions) actions.appendChild(addGroup);

        const shuffle = byId('shuffleAssignBtn');
        if (!shuffle) return;
        shuffle.setAttribute('kind', 'primary');
        shuffle.setAttribute('size', 'lg');
        const label = shuffle.querySelector('span:not([slot="icon"]):not([data-carbon-icon])');
        if (label) label.textContent = 'ランダムに割り当て';
        else shuffle.prepend(D.createTextNode('ランダムに割り当て'));
        if (shuffle.parentElement !== actions) actions.appendChild(shuffle);

        D.querySelectorAll('.random-tools').forEach(wrapper => {
            if (wrapper !== actions && !wrapper.children.length) wrapper.remove();
        });
    }

    function waitingCandidates() {
        return Array.from(D.querySelectorAll('#waiting-list .member-card'))
            .map(card => ({
                id: String(card.dataset.participantId || ''),
                name: String(card.dataset.name || card.querySelector('.member-name-text')?.textContent || '').trim(),
                card
            }))
            .filter(candidate => candidate.id && candidate.name);
    }

    function ensureGroupCreateModal() {
        let modal = byId('assignmentGroupCreateModal');
        if (modal) return modal;
        modal = D.createElement('cds-modal');
        modal.id = 'assignmentGroupCreateModal';
        modal.className = 'app-modal app-modal--compact';
        modal.setAttribute('size', 'xs');
        modal.setAttribute('aria-labelledby', 'assignmentGroupCreateTitle');
        modal.innerHTML = `
            <cds-modal-header>
                <cds-modal-heading id="assignmentGroupCreateTitle" data-modal-primary-focus tabindex="-1"></cds-modal-heading>
                <cds-modal-close-button close-button-label="閉じる"></cds-modal-close-button>
            </cds-modal-header>
            <cds-modal-body class="app-modal-body">
                <p id="assignmentGroupCreateDescription" class="assignment-group-create-description"></p>
                <cds-select id="assignmentGroupOwnerSelect" label-text="担当者" size="lg"></cds-select>
                <cds-number-input id="assignmentGroupCapacityInput" label="定員" min="1" max="99" inputmode="numeric" size="lg"></cds-number-input>
            </cds-modal-body>
            <cds-modal-footer class="app-modal-footer">
                <cds-modal-footer-button id="assignmentGroupCreateCancel" kind="secondary" type="button">キャンセル</cds-modal-footer-button>
                <cds-modal-footer-button id="assignmentGroupCreateConfirm" kind="primary" type="button">追加</cds-modal-footer-button>
            </cds-modal-footer>`;
        D.body.appendChild(modal);
        byId('assignmentGroupCreateCancel')?.addEventListener('click', () => closeGroupCreateModal(modal));
        byId('assignmentGroupCreateConfirm')?.addEventListener('click', () => createGroupFromModal(modal));
        return modal;
    }

    function openGroupCreateModalSurface(modal) {
        const adapter = global.AppModalAdapter?.getOrCreateInstance?.(modal);
        if (adapter?.show) adapter.show();
        else {
            modal.open = true;
            modal.toggleAttribute('open', true);
        }
    }

    function closeGroupCreateModal(modal) {
        const adapter = global.AppModalAdapter?.getOrCreateInstance?.(modal);
        if (adapter?.hide) adapter.hide({ reason: 'done' });
        else {
            modal.open = false;
            modal.removeAttribute('open');
        }
    }

    function openGroupCreateModal() {
        const candidates = waitingCandidates();
        const type = activeType();
        const groupLabel = type === 'team' ? '班' : '車';
        if (!candidates.length) {
            global.AppUI?.showStatus?.(`未配置の参加者を選ぶと${groupLabel}を追加できます。`, { tone: 'neutral', duration: 2800 });
            return;
        }
        const modal = ensureGroupCreateModal();
        const title = byId('assignmentGroupCreateTitle');
        const description = byId('assignmentGroupCreateDescription');
        const owner = byId('assignmentGroupOwnerSelect');
        const capacity = byId('assignmentGroupCapacityInput');
        if (!owner || !capacity) return;
        title.textContent = `${groupLabel}を追加`;
        description.textContent = `未配置の参加者を${type === 'team' ? '班長' : '運転手'}にして、新しい${groupLabel}を作成します。`;
        owner.replaceChildren(...candidates.map((candidate, index) => {
            const item = D.createElement('cds-select-item');
            item.value = candidate.id;
            item.textContent = candidate.name;
            item.toggleAttribute('selected', index === 0);
            return item;
        }));
        owner.value = candidates[0].id;
        const defaultCapacity = type === 'team' ? 5 : 3;
        capacity.value = String(defaultCapacity);
        capacity.setAttribute('value', String(defaultCapacity));
        openGroupCreateModalSurface(modal);
    }

    function createGroupFromModal(modal) {
        const owner = byId('assignmentGroupOwnerSelect');
        const capacityInput = byId('assignmentGroupCapacityInput');
        const participantId = String(owner?.value || '');
        const candidate = waitingCandidates().find(item => item.id === participantId);
        if (!candidate) {
            global.AppUI?.showStatus?.('担当者を選び直してください。', { tone: 'warning' });
            return;
        }
        const type = activeType();
        const capacity = Math.max(1, Math.min(99, parseInt(capacityInput?.value, 10) || (type === 'team' ? 5 : 3)));
        const state = global.SanpoCanonicalState;
        const room = state?.get?.();
        const allocation = room?.allocations?.[type];
        if (!room || !allocation || !room.participants?.[participantId]) return;
        const baseId = `g_${type}_${participantId.replace(/[^A-Za-z0-9_-]/g, '_')}`;
        let groupId = baseId;
        let suffix = 2;
        while (allocation.groups?.[groupId]) groupId = `${baseId}_${suffix++}`;
        const now = global.SanpoClock?.now?.() ?? Date.now();
        const order = Object.values(allocation.groups || {}).reduce((highest, group) => Math.max(highest, Number(group?.order || 0)), -1) + 1;
        allocation.groups = allocation.groups || {};
        allocation.placements = allocation.placements || {};
        allocation.groups[groupId] = { id: groupId, ownerId: participantId, capacity, order, createdAt: now, updatedAt: now };
        allocation.placements[participantId] = { kind: 'driver', groupId, order, updatedAt: now };
        state.ensureAllParticipantsPlaced?.(allocation, room.participants);
        state.set?.(room);
        global.renderActiveCarPlanToDom?.();
        global.updateUI?.();
        // Creating a car/team is a structural canonical mutation. Commit that
        // exact snapshot immediately so a delayed initial room read cannot win
        // after the modal releases the remote-paint guard.
        const snapshot = state.get?.();
        if (snapshot && global.SanpoSync?.saveImmediate) {
            void global.SanpoSync.saveImmediate({ snapshot });
        } else {
            global.save?.();
        }
        closeGroupCreateModal(modal);
        scheduleSync();
    }

    function concealWaitingPool() {
        const tray = byId('bottom-tray');
        if (!tray) return;
        const waitingContainer = byId('waiting-list-container');
        Array.from(tray.children).forEach(child => {
            if (child !== waitingContainer) child.remove();
        });
        tray.hidden = true;
        tray.setAttribute('aria-hidden', 'true');
        tray.style.display = 'none';
    }

    function ensureGroupOverflow(box) {
        const header = box.querySelector('.car-header');
        if (!header) return;
        let menu = header.querySelector('.assignment-group-menu');
        if (!menu) {
            menu = D.createElement('cds-overflow-menu');
            menu.className = 'assignment-group-menu';
            menu.kind = 'ghost';
            menu.size = 'md';
            // Carbon owns this overlay too. Dynamic Floating UI keeps it above
            // the workspace without the former mobile fixed-sheet override.
            menu.autoalign = true;
            menu.menuAlignment = 'bottom-end';
            menu.setAttribute('label', 'グループの操作');
            menu.setAttribute('aria-label', 'グループの操作');
            menu.setAttribute('enable-v12-overflowmenu', '');
            menu.innerHTML = `
                <span slot="icon" data-carbon-icon="overflow-menu-vertical" aria-hidden="true"></span>
                <cds-menu>
                    <cds-menu-item label="定員を変更" data-assignment-group-action="capacity"><span data-carbon-icon="edit" slot="render-icon" aria-hidden="true"></span></cds-menu-item>
                    <cds-menu-item label="グループを削除" kind="danger" data-assignment-group-action="delete"><span data-carbon-icon="trash-can" slot="render-icon" aria-hidden="true"></span></cds-menu-item>
                </cds-menu>`;
            header.appendChild(menu);
            menu.addEventListener('click', event => {
                const item = event.composedPath?.().find(node => node instanceof global.Element && node.matches?.('[data-assignment-group-action]'));
                const action = item?.dataset?.assignmentGroupAction;
                if (!action) return;
                event.preventDefault();
                event.stopPropagation();
                if (action === 'capacity') box.querySelector('.capacity-edit-btn')?.click();
                if (action === 'delete') box.querySelector('.car-delete-btn')?.click();
                try { menu.open = false; } catch (_) {}
            });
        }
    }

    function removeDeprecatedPersonAffordances(person) {
        person.querySelectorAll('.assignment-drag-handle, .assignment-person-move-menu, [data-assignment-move-target]').forEach(node => node.remove());
        person.classList.remove('manual-drag-source');
    }

    function syncLockIndicator(person) {
        const line = person.querySelector('.member-main-line, .driver-main-line');
        const meta = line?.querySelector('.person-meta');
        if (!line || !meta) return;
        let indicator = meta.querySelector('.assignment-lock-indicator');
        const locked = person.dataset.locked === 'true';
        if (!locked) {
            indicator?.remove();
            return;
        }
        if (!indicator) {
            indicator = D.createElement('span');
            indicator.className = 'assignment-lock-indicator';
            indicator.setAttribute('aria-label', '固定');
            indicator.innerHTML = '<span data-carbon-icon="locked" aria-hidden="true"></span>';
            meta.prepend(indicator);
        }
    }

    function roleEnabled(person) {
        if (!person) return false;
        if (person.dataset.driver === 'true') return true;
        if (person.dataset.driver === 'false') return false;
        return false;
    }

    function syncRoleTag(person, type) {
        const line = person.querySelector('.member-main-line, .driver-main-line');
        const meta = line?.querySelector('.person-meta');
        if (!meta) return;
        let tag = meta.querySelector('.driver-role-tag');
        if (!roleEnabled(person)) {
            tag?.remove();
            return;
        }
        if (!tag) {
            tag = D.createElement('cds-tag');
            tag.className = 'driver-role-tag carbon-display-tag';
            tag.setAttribute('type', 'gray');
            tag.setAttribute('size', 'sm');
            meta.prepend(tag);
        }
        tag.textContent = type === 'team' ? '班長' : '運転手';
        tag.setAttribute('aria-label', tag.textContent);
    }

    function decorateEmptySeats(box) {
        Array.from(box.querySelectorAll('.seat-slot')).forEach((slot, index) => {
            const empty = !slot.querySelector('.member-card');
            slot.classList.toggle('assignment-empty-seat', empty);
            let label = slot.querySelector('.assignment-empty-label');
            if (!empty) {
                label?.remove();
                slot.removeAttribute('aria-label');
                return;
            }
            if (!label) {
                label = D.createElement('span');
                label.className = 'assignment-empty-label';
                slot.prepend(label);
            }
            label.textContent = '空席';
            slot.setAttribute('aria-label', `空席 ${index + 1}`);
            slot.querySelector('.seat-add-btn')?.setAttribute('aria-label', '空席にメンバーを追加');
        });
    }

    function rowPerson(row) {
        return row.classList.contains('driver-seat') ? row : row.querySelector(':scope > .member-card');
    }

    function sortRoleRows(box) {
        const layout = box.querySelector('.car-layout-grid');
        if (!layout) return;
        const rows = Array.from(layout.children).filter(row => row.matches('.driver-seat, .seat-slot'));
        if (box.querySelector('.person-overflow-menu[open]')) return;
        const orderedRows = rows.map((row, index) => {
            const person = rowPerson(row);
            return { row, index, rank: person ? (roleEnabled(person) ? 0 : 1) : 2 };
        }).sort((a, b) => a.rank - b.rank || a.index - b.index).map(({ row }) => row);
        if (orderedRows.every((row, index) => row === rows[index])) return;
        orderedRows.forEach(row => layout.appendChild(row));
    }

    function decorateCapacity(box, type) {
        const count = box.querySelector('.capacity-count');
        const button = box.querySelector('.capacity-edit-btn');
        const passengerCapacity = parseInt(box.dataset.capacity, 10) || box.querySelectorAll('.seat-slot').length;
        const passengerCount = box.querySelectorAll('.seat-slot .member-card').length;
        const anchorCount = box.querySelector('.driver-seat') ? 1 : 0;
        const text = `${passengerCount + anchorCount}/${passengerCapacity + anchorCount}`;
        if (count && count.textContent !== text) count.textContent = text;
        if (button) button.setAttribute('aria-label', `${type === 'team' ? '班' : '車'}の人数 ${text}、定員を変更`);
    }

    function decorateCards() {
        const type = activeType();
        Array.from(D.querySelectorAll('#cars-container .car-box')).forEach((box, index) => {
            const groupLabel = box.querySelector('.car-name-label');
            const nextLabel = type === 'team' ? `${index + 1}班` : `${index + 1}号車`;
            if (groupLabel) groupLabel.textContent = nextLabel;
            box.setAttribute('role', 'group');
            box.setAttribute('aria-label', nextLabel);
            ensureGroupOverflow(box);
            decorateEmptySeats(box);
            Array.from(box.querySelectorAll('.driver-seat, .seat-slot > .member-card')).forEach(person => {
                removeDeprecatedPersonAffordances(person);
                syncLockIndicator(person);
                syncRoleTag(person, type);
            });
            sortRoleRows(box);
            decorateCapacity(box, type);
        });
        global.SanpoCarbon?.renderCarbonIcons?.(byId('cars-container'));
    }

    function syncSummary() {
        const summary = byId('assignmentWorkspaceSummary');
        if (!summary) return;
        const type = activeType();
        const groups = D.querySelectorAll('#cars-container .car-box').length;
        const waiting = D.querySelectorAll('#waiting-list .member-card').length;
        const passengers = D.querySelectorAll('#cars-container .member-card').length;
        const anchors = D.querySelectorAll('#cars-container .driver-seat').length;
        summary.textContent = `${passengers + anchors + waiting}人 · ${groups}${type === 'team' ? '班' : '台'} · 未配置${waiting}人`;
    }

    function normalizeHorizontalPosition() {
        const topArea = byId('top-area');
        if (topArea && topArea.scrollLeft !== 0) topArea.scrollLeft = 0;
    }

    function syncNow() {
        syncFrame = 0;
        D.body.classList.add('assignment-workspace-enabled');
        createHeader();
        relocateAllocationActions();
        simplifyPrimaryNavigation();
        bindCarbonAllocationSelection();
        concealWaitingPool();
        decorateCards();
        syncSummary();
        normalizeHorizontalPosition();
        global.SanpoCarbon?.renderCarbonIcons?.(byId('assignmentWorkspaceHeader'));
    }

    function scheduleSync() {
        if (syncFrame) return;
        syncFrame = global.requestAnimationFrame(syncNow);
    }

    function observe() {
        observer?.disconnect();
        observer = new MutationObserver(mutations => {
            // Carbon mutates menu labels/icons while opening and focusing an item.
            // Those are presentation-only changes: rerunning `sortRoleRows()` moves
            // the focused card, emits focusout, and makes Carbon close its menu.
            // Keep this workspace observer for card/layout mutations only.
            const hasWorkspaceMutation = mutations.some(mutation => !mutation.target.closest?.('cds-overflow-menu.person-overflow-menu'));
            if (hasWorkspaceMutation) scheduleSync();
        });
        const cars = byId('cars-container');
        const waiting = byId('waiting-list');
        const navigation = byId('view-toggle-bar');
        if (cars) observer.observe(cars, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-locked', 'data-capacity', 'data-driver'] });
        if (waiting) observer.observe(waiting, { childList: true, subtree: true });
        if (navigation) observer.observe(navigation, { childList: true });
        observer.observe(D.body, { attributes: true, attributeFilter: ['data-active-plan-template'] });
    }

    function initialize() {
        ensureStylesheet();
        D.body.classList.add('assignment-workspace-enabled');
        createHeader();
        observe();
        global.addEventListener('resize', scheduleSync, { passive: true });
        global.visualViewport?.addEventListener('resize', scheduleSync, { passive: true });
        syncNow();
    }

    global.SanpoAssignmentWorkspace = Object.freeze({
        initialize,
        refresh: scheduleSync,
        isReadOnly: () => false
    });
})(window);
