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
        const href = './assets/css/cars-members-tray/assignment-workspace-refresh.css?v=assignment-workspace-v7';
        if (!link.href.endsWith(href.replace('./', ''))) link.href = href;
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
        const participantTab = byId('tab-participants');
        const settlementTab = byId('tab-seisan');
        const sheetTab = byId('tab-sheet');
        const bar = byId('view-toggle-bar');
        if (!bar || !carTab || !teamTab || !participantTab || !settlementTab) return;

        sheetTab?.remove();
        carTab.dataset.allocationType = 'car';
        teamTab.dataset.allocationType = 'team';
        carTab.setAttribute('value', 'car');
        teamTab.setAttribute('value', 'team');
        replaceTabLabel(participantTab, '参加者');
        replaceTabLabel(carTab, '車割');
        replaceTabLabel(teamTab, '班割');
        replaceTabLabel(settlementTab, '精算');
        carTab.setAttribute('aria-label', '車割');
        teamTab.setAttribute('aria-label', '班割');

        const desired = [participantTab, carTab, teamTab, settlementTab];
        if (desired.some((tab, index) => bar.children[index] !== tab) || bar.children.length !== desired.length) {
            bar.replaceChildren(...desired);
        }
        bar.dataset.assignmentFourDestinationNav = 'true';
        global.syncCarbonPrimaryNavigationState?.();

        const shellShare = byId('shareLinkBtn');
        if (shellShare) shellShare.hidden = false;
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
            menu.setAttribute('label', 'グループの操作');
            menu.setAttribute('aria-label', 'グループの操作');
            menu.setAttribute('enable-v12-overflowmenu', '');
            menu.innerHTML = `
                <span slot="icon" data-carbon-icon="overflow-menu-vertical" aria-hidden="true"></span>
                <cds-menu>
                    <cds-menu-item label="定員を変更" data-assignment-group-action="capacity"><span data-carbon-icon="edit" slot="render-icon" aria-hidden="true"></span></cds-menu-item>
                </cds-menu>`;
            header.appendChild(menu);
            menu.addEventListener('click', event => {
                const item = event.composedPath?.().find(node => node instanceof global.Element && node.matches?.('[data-assignment-group-action="capacity"]'));
                if (!item) return;
                event.preventDefault();
                event.stopPropagation();
                box.querySelector('.capacity-edit-btn')?.click();
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
        rows.map((row, index) => {
            const person = rowPerson(row);
            return { row, index, rank: person ? (roleEnabled(person) ? 0 : 1) : 2 };
        }).sort((a, b) => a.rank - b.rank || a.index - b.index)
            .forEach(({ row }) => layout.appendChild(row));
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
        observer = new MutationObserver(scheduleSync);
        const cars = byId('cars-container');
        const waiting = byId('waiting-list');
        const navigation = byId('view-toggle-bar');
        if (cars) observer.observe(cars, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-locked', 'data-capacity', 'data-driver'] });
        if (waiting) observer.observe(waiting, { childList: true, subtree: true });
        if (navigation) observer.observe(navigation, { childList: true });
        observer.observe(D.body, { attributes: true, attributeFilter: ['class', 'data-active-plan-template'] });
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
