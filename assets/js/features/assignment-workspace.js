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
    let groupCreateDefaultOwnerId = '';
    let groupCreateCandidateIds = new Set();

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
        const href = './assets/css/cars-members-tray/assignment-workspace-refresh.css?v=assignment-workspace-v13';
        if (!link.href.endsWith(href.replace('./', ''))) link.href = href;
    }

    function setAttributeIfChanged(element, name, value) {
        if (element?.getAttribute(name) !== value) element?.setAttribute(name, value);
    }

    function replaceTabLabel(tab, text) {
        const label = tab?.querySelector('.view-tab-label');
        if (!label) return;
        const current = Array.from(label.childNodes)
            .map(node => node.textContent || '')
            .join('').trim();
        if (current === text) return;
        label.replaceChildren(D.createTextNode(text));
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
        const bar = byId('view-toggle-bar');
        if (!bar || bar.dataset.assignmentDestinationOwner === 'true') return;
        bar.dataset.assignmentDestinationOwner = 'true';
        // Carbon owns activation and selection. The composed component event is
        // the single application hand-off, so state mirroring never competes
        // with user navigation (including WebKit host clicks).
        bar.addEventListener('cds-tabs-selected', event => {
            const tab = event.detail?.item;
            const templateType = tab?.dataset?.allocationType;
            if (templateType !== 'car' && templateType !== 'team') return;
            if (activeType() === templateType && D.body.classList.contains('view-mode-list')) return;
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
                <p class="assignment-workspace-summary" id="assignmentWorkspaceSummary" aria-live="polite">
                    <span class="assignment-workspace-summary-primary"><span class="assignment-workspace-summary-label">未割り当て</span> <strong class="assignment-workspace-summary-unassigned">0人</strong></span>
                    <span class="assignment-workspace-summary-secondary">0人・0台</span>
                </p>
                <div id="assignmentWorkspaceRandomAction" class="assignment-workspace-actions" aria-label="ランダム割り当て"></div>
            </div>`;
        const legacyHeader = topArea.querySelector(':scope > .edit-header');
        topArea.insertBefore(header, legacyHeader || topArea.firstChild);
        return header;
    }

    function removeRetiredAllocationControls() {
        ['fillEmptySeatsBtn', 'traySettingsBtn', 'autoAssignPopover', 'autoAssignMenu', 'clearAllBtn', 'optFemale', 'optMale', 'optGrade']
            .forEach(id => byId(id)?.remove());
    }

    function registeredParticipantCount() {
        const room = global.SanpoCanonicalState?.get?.();
        const canonicalCount = Object.keys(room?.participants || {}).length;
        if (canonicalCount > 0) return canonicalCount;
        return D.querySelectorAll('#waiting-list .member-card, #cars-container .member-card, #cars-container .driver-seat').length;
    }

    function relocateAllocationActions() {
        const actions = byId('assignmentWorkspaceRandomAction');
        const topArea = byId('top-area');
        const cars = byId('cars-container');
        if (!actions || !topArea || !cars) return;
        removeRetiredAllocationControls();

        let footer = byId('assignmentWorkspaceFooterActions');
        if (!footer) {
            footer = D.createElement('div');
            footer.id = 'assignmentWorkspaceFooterActions';
            footer.className = 'assignment-workspace-footer-actions';
            footer.setAttribute('aria-label', '車を追加');
            topArea.insertBefore(footer, cars.nextSibling);
        }
        const hasParticipants = registeredParticipantCount() > 0;
        const workspaceHeader = byId('assignmentWorkspaceHeader');
        if (workspaceHeader) workspaceHeader.hidden = !hasParticipants;
        footer.hidden = !hasParticipants;

        let addGroup = byId('assignmentWorkspaceAddGroupBtn');
        if (!addGroup) {
            addGroup = D.createElement('cds-button');
            addGroup.id = 'assignmentWorkspaceAddGroupBtn';
            addGroup.className = 'assignment-workspace-add-group';
            // Creation is a secondary action. Random assignment remains the one
            // workspace-level primary action.
            addGroup.setAttribute('kind', 'tertiary');
            addGroup.setAttribute('size', 'md');
            addGroup.setAttribute('type', 'button');
            addGroup.innerHTML = '<span data-carbon-icon="add" slot="icon" aria-hidden="true"></span><span></span>';
            addGroup.addEventListener('click', openGroupCreateModal);
        }
        const type = activeType();
        const groupLabel = type === 'team' ? '班' : '車';
        footer.setAttribute('aria-label', `${groupLabel}を追加`);
        addGroup.setAttribute('aria-label', `${groupLabel}を追加`);
        const addLabel = addGroup.querySelector('span:not([slot="icon"]):not([data-carbon-icon])');
        if (addLabel) addLabel.textContent = `${groupLabel}を追加`;
        if (addGroup.parentElement !== footer) footer.appendChild(addGroup);

        const shuffle = byId('shuffleAssignBtn');
        if (!shuffle) return;
        shuffle.setAttribute('kind', 'primary');
        shuffle.setAttribute('size', 'md');
        const label = shuffle.querySelector('span:not([slot="icon"]):not([data-carbon-icon])');
        if (label) label.textContent = 'ランダム割り当て';
        else shuffle.prepend(D.createTextNode('ランダム割り当て'));
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
                <cds-select id="assignmentGroupOwnerSelect" size="lg"></cds-select>
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

    function selectedGroupOwnerId(owner) {
        const value = String(owner?.value || '').trim();
        if (value) return value;
        const selected = owner?.querySelector?.('cds-select-item[selected]') || owner?.querySelector?.('cds-select-item');
        return String(selected?.value || selected?.getAttribute?.('value') || '').trim();
    }

    function reassertGroupOwnerDefault(owner, candidateIds, defaultId) {
        if (!owner || !defaultId) return;
        const current = selectedGroupOwnerId(owner);
        if (!candidateIds.has(current)) owner.value = defaultId;
    }

    function syncGroupOwnerNativeSelection(owner, defaultId) {
        const nativeSelect = owner?.shadowRoot?.querySelector?.('select');
        if (!nativeSelect?.options?.length) return;
        const desiredIndex = Array.from(nativeSelect.options).findIndex(option => option.value === defaultId);
        if (desiredIndex < 0 || nativeSelect.selectedIndex === desiredIndex) return;
        owner.selectedIndex = desiredIndex;
        // Keep the rendered native control aligned when Carbon has just completed
        // its first light-DOM item projection and the public setter is one render
        // behind.
        if (nativeSelect.selectedIndex !== desiredIndex) nativeSelect.selectedIndex = desiredIndex;
        owner.value = nativeSelect.value || defaultId;
    }

    async function settleGroupOwnerSelection(owner, candidateIds, defaultId) {
        reassertGroupOwnerDefault(owner, candidateIds, defaultId);
        await Promise.resolve(owner?.updateComplete);
        syncGroupOwnerNativeSelection(owner, defaultId);
        reassertGroupOwnerDefault(owner, candidateIds, defaultId);
        await Promise.resolve(owner?.updateComplete);
        syncGroupOwnerNativeSelection(owner, defaultId);
    }

    async function openGroupCreateModal() {
        const candidates = waitingCandidates();
        const type = activeType();
        const groupLabel = type === 'team' ? '班' : '車';
        const roleLabel = type === 'team' ? '班長' : '運転手';
        if (!candidates.length) {
            global.AppUI?.showStatus?.(`未割り当ての参加者を選ぶと${groupLabel}を追加できます。`, { tone: 'neutral', duration: 2800 });
            return;
        }
        groupCreateDefaultOwnerId = candidates[0].id;
        groupCreateCandidateIds = new Set(candidates.map(candidate => candidate.id));
        const modal = ensureGroupCreateModal();
        const title = byId('assignmentGroupCreateTitle');
        const owner = byId('assignmentGroupOwnerSelect');
        const capacity = byId('assignmentGroupCapacityInput');
        if (!owner || !capacity) return;
        title.textContent = `${groupLabel}を追加`;
        owner.setAttribute('label-text', roleLabel);
        owner.replaceChildren(...candidates.map((candidate, index) => {
            const item = D.createElement('cds-select-item');
            item.value = candidate.id;
            item.textContent = candidate.name;
            item.toggleAttribute('selected', index === 0);
            return item;
        }));
        owner.value = candidates[0].id;
        const candidateIds = new Set(candidates.map(candidate => candidate.id));
        // Carbon upgrades and renders dynamic select items asynchronously. Reassert
        // the default only while the current value is empty/invalid, so a quick user
        // choice is never overwritten by the lifecycle repair.
        await settleGroupOwnerSelection(owner, candidateIds, candidates[0].id);
        const defaultCapacity = type === 'team' ? 5 : 3;
        capacity.value = String(defaultCapacity);
        capacity.setAttribute('value', String(defaultCapacity));
        openGroupCreateModalSurface(modal);
    }

    function createGroupFromModal(modal) {
        const owner = byId('assignmentGroupOwnerSelect');
        const capacityInput = byId('assignmentGroupCapacityInput');
        const requestedParticipantId = selectedGroupOwnerId(owner);
        const type = activeType();
        const roleLabel = type === 'team' ? '班長' : '運転手';
        const candidates = waitingCandidates();
        // A dynamically-created Carbon select can briefly expose an empty or
        // stale host value while its light-DOM items and shadow options settle.
        // Resolve that transient state against the current waiting pool so a
        // valid default selection can still commit the structural mutation.
        const candidate = candidates.find(item => item.id === requestedParticipantId)
            || (groupCreateCandidateIds.has(requestedParticipantId) ? { id: requestedParticipantId } : null)
            || candidates.find(item => item.id === groupCreateDefaultOwnerId)
            || (groupCreateCandidateIds.has(groupCreateDefaultOwnerId) ? { id: groupCreateDefaultOwnerId } : null)
            || candidates[0];
        if (!candidate) {
            global.AppUI?.showStatus?.(`${roleLabel}を選び直してください。`, { tone: 'warning' });
            return;
        }
        const participantId = candidate.id;
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
        allocation.placements[participantId] = { kind: 'member', driver: true, groupId, order, updatedAt: now };
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
        const type = activeType();
        const groupName = box.querySelector('.car-name-label')?.textContent?.trim()
            || `${type === 'team' ? '班' : '車'}`;
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
            menu.setAttribute('label', `${groupName}の操作`);
            menu.setAttribute('aria-label', `${groupName}の操作`);
            menu.setAttribute('enable-v12-overflowmenu', '');
            menu.innerHTML = `
                <span slot="icon" data-carbon-icon="overflow-menu-vertical" aria-hidden="true"></span>
                <cds-menu>
                    <cds-menu-item label="定員を変更" data-assignment-group-action="capacity"><span data-carbon-icon="edit" slot="render-icon" aria-hidden="true"></span></cds-menu-item>
                    <cds-menu-item label="${type === 'team' ? '班' : '車'}を削除" kind="danger" data-assignment-group-action="delete"><span data-carbon-icon="trash-can" slot="render-icon" aria-hidden="true"></span></cds-menu-item>
                </cds-menu>`;
            header.appendChild(menu);
            menu.addEventListener('click', event => {
                const item = event.composedPath?.().find(node => node instanceof global.Element && node.matches?.('[data-assignment-group-action]'));
                const action = item?.dataset?.assignmentGroupAction;
                if (!action) return;
                event.preventDefault();
                event.stopPropagation();
                if (action === 'capacity') global.editCapacity?.(box);
                if (action === 'delete') box.querySelector('.car-delete-btn')?.click();
                try { menu.open = false; } catch (_) {}
            });
        }
        menu.setAttribute('label', `${groupName}の操作`);
        menu.setAttribute('aria-label', `${groupName}の操作`);
    }

    function removeDeprecatedPersonAffordances(person) {
        person.querySelectorAll('.assignment-drag-handle, .assignment-person-move-menu, [data-assignment-move-target]').forEach(node => node.remove());
        person.classList.remove('manual-drag-source');
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

    function syncGradeText(person) {
        const line = person.querySelector('.member-main-line, .driver-main-line');
        const meta = line?.querySelector('.person-meta');
        if (!meta) return;
        const badge = meta.querySelector('.grade-badge');
        const grade = parseInt(person.dataset.grade, 10) || parseInt(badge?.dataset.grade, 10) || 0;
        if (badge) badge.remove();
        let text = meta.querySelector('.person-grade-text');
        if (grade <= 0) {
            text?.remove();
            return;
        }
        if (!text) {
            text = D.createElement('span');
            text.className = 'person-grade-text';
            meta.appendChild(text);
        }
        text.dataset.grade = String(grade);
        text.textContent = `${grade}年`;
    }

    function candidateDisclosure(box, row) {
        let disclosure = row.nextElementSibling;
        if (!disclosure?.classList.contains('assignment-seat-disclosure')) {
            disclosure = D.createElement('div');
            disclosure.className = 'assignment-seat-disclosure';
            disclosure.hidden = true;
            disclosure.setAttribute('role', 'region');
            row.after(disclosure);
        }
        const groupName = box.querySelector('.car-name-label')?.textContent?.trim() || 'このグループ';
        const groupIndex = Array.from(D.querySelectorAll('#cars-container .car-box')).indexOf(box) + 1;
        const token = String(box.dataset.groupId || groupIndex).replace(/[^A-Za-z0-9_-]/g, '_');
        if (!row.id) row.id = `assignment-empty-seats-${token}`;
        if (!disclosure.id) disclosure.id = `assignment-seat-candidates-${token}`;
        row.setAttribute('aria-controls', disclosure.id);
        disclosure.setAttribute('aria-labelledby', row.id);
        disclosure.setAttribute('aria-label', `${groupName}に追加`);
        return disclosure;
    }

    function seatCandidateSignature(emptySlots) {
        return `${emptySlots.length}:${waitingCandidates().map(candidate => candidate.id).join('|')}`;
    }

    function syncCandidateAccessibleName(item, label) {
        item.setAttribute('aria-label', label);
        const apply = () => item.shadowRoot?.querySelector('button')?.setAttribute('aria-label', label);
        apply();
        Promise.resolve(item.updateComplete).then(apply).catch(() => {});
    }

    function renderSeatCandidates(box, row, emptySlots) {
        const disclosure = candidateDisclosure(box, row);
        const candidates = waitingCandidates();
        const groupName = box.querySelector('.car-name-label')?.textContent?.trim() || 'このグループ';
        disclosure.replaceChildren();
        disclosure.hidden = false;
        disclosure.dataset.signature = seatCandidateSignature(emptySlots);
        if (!candidates.length) {
            const notice = D.createElement('cds-inline-notification');
            notice.className = 'assignment-seat-notification';
            notice.setAttribute('kind', 'info');
            notice.setAttribute('low-contrast', '');
            notice.setAttribute('hide-close-button', '');
            notice.setAttribute('title', '追加できる参加者がいません');
            notice.setAttribute('subtitle', '参加者登録、または別の席から未割り当てに戻してください。');
            disclosure.appendChild(notice);
            global.SanpoCarbon?.renderCarbonIcons?.(disclosure);
            return;
        }

        const list = D.createElement('cds-contained-list');
        list.className = 'assignment-candidate-list';
        list.setAttribute('kind', 'disclosed');
        list.setAttribute('label', `${groupName}に追加`);
        candidates.forEach(candidate => {
            const item = D.createElement('cds-contained-list-item');
            item.className = 'assignment-candidate-item';
            item.setAttribute('clickable', '');
            syncCandidateAccessibleName(item, `${candidate.name}を${groupName}に追加`);
            item.dataset.participantId = candidate.id;
            const content = D.createElement('span');
            content.className = 'assignment-candidate-content';
            const name = D.createElement('span');
            name.className = 'assignment-candidate-name';
            name.textContent = candidate.name;
            content.appendChild(name);
            const grade = parseInt(candidate.card.dataset.grade, 10) || 0;
            if (grade > 0) {
                const gradeText = D.createElement('span');
                gradeText.className = 'assignment-candidate-grade';
                gradeText.textContent = `${grade}年`;
                content.appendChild(gradeText);
            }
            item.appendChild(content);
            const icon = D.createElement('span');
            icon.className = 'assignment-candidate-add';
            icon.setAttribute('slot', 'action');
            icon.setAttribute('data-carbon-icon', 'add');
            icon.setAttribute('aria-hidden', 'true');
            item.appendChild(icon);
            item.addEventListener('click', event => {
                event.preventDefault();
                const target = emptySlots.find(slot => slot.isConnected && !slot.querySelector('.member-card'));
                if (!target) return;
                global.assignWaitingMemberToSeat?.(candidate.card, target);
                row.dataset.open = 'false';
                row.setAttribute('aria-expanded', 'false');
                disclosure.hidden = true;
            });
            list.appendChild(item);
        });
        disclosure.appendChild(list);
        global.SanpoCarbon?.renderCarbonIcons?.(disclosure);
    }

    function openSeatCandidates(slot) {
        const box = slot?.closest?.('.car-box');
        const layout = box?.querySelector('.car-layout-grid');
        const row = layout?.querySelector(':scope > .assignment-empty-seats-row');
        if (!box || !layout || !row) return;
        const emptySlots = Array.from(layout.querySelectorAll(':scope > .seat-slot'))
            .filter(candidate => !candidate.querySelector('.member-card'));
        if (!emptySlots.length) return;
        row.dataset.open = 'true';
        row.setAttribute('aria-expanded', 'true');
        renderSeatCandidates(box, row, emptySlots);
    }

    function decorateEmptySeats(box) {
        const layout = box.querySelector('.car-layout-grid');
        if (!layout) return;
        const slots = Array.from(layout.querySelectorAll(':scope > .seat-slot'));
        const emptySlots = slots.filter(slot => !slot.querySelector('.member-card'));
        slots.forEach(slot => {
            const empty = !slot.querySelector('.member-card');
            slot.classList.toggle('assignment-empty-seat', empty);
            if (!empty) {
                slot.classList.remove('assignment-empty-seat--collapsed');
                slot.removeAttribute('aria-label');
                return;
            }
            slot.classList.add('assignment-empty-seat--collapsed');
            slot.removeAttribute('aria-label');
        });

        let row = layout.querySelector(':scope > .assignment-empty-seats-row');
        let disclosure = row?.nextElementSibling?.classList.contains('assignment-seat-disclosure')
            ? row.nextElementSibling
            : null;
        if (!emptySlots.length) {
            row?.remove();
            disclosure?.remove();
            return;
        }
        if (!row) {
            row = D.createElement('cds-contained-list-item');
            row.className = 'assignment-empty-seats-row';
            row.setAttribute('clickable', '');
            row.setAttribute('aria-expanded', 'false');
            const content = D.createElement('span');
            content.className = 'assignment-empty-seats-content';
            const label = D.createElement('span');
            label.className = 'assignment-empty-seats-label';
            content.appendChild(label);
            const action = D.createElement('span');
            action.className = 'assignment-empty-seats-action';
            action.textContent = '参加者を追加';
            content.appendChild(action);
            row.appendChild(content);
            const icon = D.createElement('span');
            icon.className = 'assignment-empty-seats-icon';
            icon.setAttribute('slot', 'action');
            icon.setAttribute('data-carbon-icon', 'add');
            icon.setAttribute('aria-hidden', 'true');
            row.appendChild(icon);
            row.addEventListener('click', () => {
                const nextEmptySlots = Array.from(layout.querySelectorAll(':scope > .seat-slot'))
                    .filter(slot => !slot.querySelector('.member-card'));
                if (!nextEmptySlots.length) return;
                const open = row.dataset.open === 'true';
                row.dataset.open = open ? 'false' : 'true';
                row.setAttribute('aria-expanded', String(!open));
                if (open) {
                    candidateDisclosure(box, row).hidden = true;
                } else {
                    renderSeatCandidates(box, row, nextEmptySlots);
                }
            });
            layout.appendChild(row);
        }
        const label = row.querySelector('.assignment-empty-seats-label');
        if (label) label.textContent = `空席 ${emptySlots.length}`;
        const groupName = box.querySelector('.car-name-label')?.textContent?.trim() || 'このグループ';
        row.setAttribute('aria-label', `${groupName}、空席 ${emptySlots.length}、参加者を追加`);
        candidateDisclosure(box, row);
        if (row.dataset.open === 'true') {
            const currentDisclosure = candidateDisclosure(box, row);
            if (currentDisclosure.dataset.signature !== seatCandidateSignature(emptySlots)) {
                renderSeatCandidates(box, row, emptySlots);
            }
        } else {
            candidateDisclosure(box, row).hidden = true;
        }
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
        const display = box.querySelector('.capacity-display');
        const passengerCapacity = parseInt(box.dataset.capacity, 10) || box.querySelectorAll('.seat-slot').length;
        const passengerCount = box.querySelectorAll('.seat-slot .member-card').length;
        const anchorCount = box.querySelector('.driver-seat') ? 1 : 0;
        const text = `${passengerCount + anchorCount}/${passengerCapacity + anchorCount}人`;
        if (count && count.textContent !== text) count.textContent = text;
        if (display) {
            display.classList.toggle('is-over', passengerCount > passengerCapacity);
            display.classList.toggle('is-full', passengerCount === passengerCapacity);
            display.setAttribute('aria-label', `${type === 'team' ? '班' : '車'}の人数 ${text}`);
        }
    }

    function decorateCards() {
        const type = activeType();
        Array.from(D.querySelectorAll('#cars-container .car-box')).forEach((box, index) => {
            const groupLabel = box.querySelector('.car-name-label');
            const nextLabel = type === 'team' ? `${index + 1}班` : `${index + 1}号車`;
            if (groupLabel) groupLabel.textContent = nextLabel;
            box.dataset.assignmentGroupIndex = String(index + 1);
            box.setAttribute('role', 'group');
            box.setAttribute('aria-label', nextLabel);
            ensureGroupOverflow(box);
            decorateEmptySeats(box);
            Array.from(box.querySelectorAll('.driver-seat, .seat-slot > .member-card')).forEach(person => {
                removeDeprecatedPersonAffordances(person);
                syncRoleTag(person, type);
                syncGradeText(person);
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
        const total = `${passengers + anchors + waiting}人`;
        const groupCount = `${groups}${type === 'team' ? '班' : '台'}`;
        const unassigned = summary.querySelector('.assignment-workspace-summary-unassigned');
        const secondary = summary.querySelector('.assignment-workspace-summary-secondary');
        if (unassigned) unassigned.textContent = `${waiting}人`;
        if (secondary) secondary.textContent = `${total}・${groupCount}`;
        summary.setAttribute('aria-label', `未割り当て ${waiting}人。${total}・${groupCount}`);
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
        openSeatCandidates,
        isReadOnly: () => false
    });
})(window);
