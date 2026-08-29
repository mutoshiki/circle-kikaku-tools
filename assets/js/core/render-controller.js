// App render controller. Owns room title, sheet summary, and cross-feature UI refresh.
// Split from app.js during S-4 cleanup.

function refreshRoomTitle() {
    const titleEl = byId('sheet-room-name');
    if (!titleEl) return;
    const name = ($('#roomNameInput')?.value || '').trim();
    titleEl.textContent = name || '企画名未設定';
    titleEl.classList.toggle('is-placeholder', !name);
}

function formatUpdatedAt(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function buildSheetPlanSummaryRow(plan, updatedLabel = '') {
    const template = typeof getCarPlanTemplateConfig === 'function'
        ? getCarPlanTemplateConfig(plan || 'car')
        : { type: 'car', ownerLabel: '運転手', memberLabel: '参加者' };
    const cars = Array.isArray(plan?.cars) ? plan.cars : [];
    const waiting = Array.isArray(plan?.waiting) ? plan.waiting : [];
    const ownerCount = cars.length;
    const assignedMemberCount = cars.reduce((sum, car) => sum + (car.members || []).filter(Boolean).length, 0);
    const waitingCount = waiting.length;
    const memberCount = assignedMemberCount + waitingCount;
    const totalCount = ownerCount + memberCount;
    const ownerSummaryLabel = template.type === 'team' ? (template.ownerLabel || '班長') : '運転手';
    const memberSummaryLabel = '参加者';
    const stats = [
        [ownerSummaryLabel, ownerCount],
        [memberSummaryLabel, memberCount],
        ['全員', totalCount],
        ['未割り当て', waitingCount]
    ];

    const row = document.createElement('cds-structured-list-row');
    row.className = `sheet-summary-row is-${template.type || 'car'}`;
    row.setAttribute('condensed', '');

    const labelCell = document.createElement('cds-structured-list-cell');
    labelCell.className = 'sheet-summary-label';
    const label = document.createElement('strong');
    label.textContent = template.type === 'team' ? '班割' : '車割';
    labelCell.appendChild(label);

    const metricsCell = document.createElement('cds-structured-list-cell');
    metricsCell.className = 'sheet-summary-metrics';
    stats.forEach(([statLabel, value]) => {
        const item = document.createElement('span');
        item.className = 'sheet-summary-stat';
        item.append(document.createTextNode(statLabel));
        const strong = document.createElement('strong');
        strong.textContent = `${value}人`;
        item.appendChild(strong);
        metricsCell.appendChild(item);
    });
    if (updatedLabel) {
        const updated = document.createElement('span');
        updated.className = 'sheet-summary-updated';
        updated.append(document.createTextNode('更新'));
        const strong = document.createElement('strong');
        strong.textContent = updatedLabel;
        updated.appendChild(strong);
        metricsCell.appendChild(updated);
    }

    row.append(labelCell, metricsCell);
    return row;
}

function updateSheetSummary(data = getData()) {
    const summaryEl = byId('sheet-summary');
    if (!summaryEl) return;
    const titleBar = byId('sheet-title-bar');
    const hasRegisteredParticipants = (Array.isArray(data.cars) && data.cars.length > 0)
        || (Array.isArray(data.waiting) && data.waiting.length > 0)
        || (Array.isArray(data.carPlans) && data.carPlans.some(plan => (
            (Array.isArray(plan.cars) && plan.cars.length > 0)
            || (Array.isArray(plan.waiting) && plan.waiting.length > 0)
        )));
    if (titleBar) titleBar.hidden = !hasRegisteredParticipants;
    if (!hasRegisteredParticipants) {
        summaryEl.replaceChildren();
        return;
    }
    const plans = Array.isArray(data.carPlans) && data.carPlans.length
        ? data.carPlans
        : [{ id: SINGLE_CAR_PLAN_ID, name: '車割', cars: data.cars || [], waiting: data.waiting || [], templateType: 'car' }];
    const normalizedPlans = typeof normalizeCarPlan === 'function'
        ? plans.map((plan, index) => normalizeCarPlan(plan, index))
        : plans;
    const findPlanByType = type => normalizedPlans.find(plan => (
        typeof normalizeCarPlanTemplateType === 'function'
            ? normalizeCarPlanTemplateType(plan.templateType)
            : String(plan.templateType || 'car')
    ) === type);
    const carPlan = findPlanByType('car') || { cars: [], waiting: [], templateType: 'car' };
    const teamPlan = findPlanByType('team') || { cars: [], waiting: [], templateType: 'team' };
    const updated = formatUpdatedAt(data.lastUpdatedAt);

    const list = document.createElement('cds-structured-list');
    list.className = 'sheet-summary-list';
    list.setAttribute('condensed', '');
    list.setAttribute('aria-label', '車割と班割の集計');
    const body = document.createElement('cds-structured-list-body');
    body.append(
        buildSheetPlanSummaryRow(carPlan),
        buildSheetPlanSummaryRow(teamPlan, updated)
    );
    list.appendChild(body);
    summaryEl.replaceChildren(list);
}

// Large UI features are split into assets/js/features/*.js.

function updateUI() {
    refreshRoomTitle();
    const activePlanForUi = typeof getActiveCarPlan === 'function' ? getActiveCarPlan() : null;
    const activeTemplateForUi = typeof getCarPlanTemplateConfig === 'function' ? getCarPlanTemplateConfig(activePlanForUi || 'car') : { type: 'car' };
    document.body.dataset.activePlanTemplate = activeTemplateForUi.type || 'car';
    if (typeof renderCarPlanSwitcher === 'function') renderCarPlanSwitcher();
    $$('.member-card').forEach(card => {
        const inWaiting = card.parentElement?.id === 'waiting-list';
        card.classList.toggle('in-waiting', inWaiting);
        const btn = $('.delete-btn-overlay', card);
        if (!btn) return;
        window.SanpoIconAdapter?.setIcon(btn, inWaiting ? 'trash-can' : 'undo');
        const label = btn.querySelector('span:not([data-carbon-icon])');
        if (label) label.textContent = inWaiting ? '削除' : '戻す';
    });
    $$('.car-box').forEach(b => {
        const c = getInt(b.dataset.capacity);
        const n = Array.from($$('.seat-slot', b)).reduce((sum, slot) => sum + getRealSeatCards(slot).length, 0);
        const badge = $('.capacity-badge', b);
        const capacityCount = badge ? $('.capacity-count', badge) : null;
        if (capacityCount) capacityCount.textContent = `${n}/${c}`;
        badge?.classList.toggle('is-over', n > c);
        badge?.classList.toggle('is-full', n === c);
        if (badge?.classList.contains('capacity-edit-btn')) {
            badge.setAttribute('kind', n > c ? 'danger--ghost' : 'ghost');
            badge.setAttribute('aria-label', `定員${n}/${c}を変更`);
        }
        const label = $('.car-name-label', b);
        const driverName = $('.driver-name-disp', b)?.innerText?.trim() || '';
        if (label && driverName) {
            label.textContent = activeTemplateForUi.type === 'team'
                ? `第${Array.from($$('.car-box')).indexOf(b) + 1}班`
                : `${driverName}車`;
        }
        b.classList.toggle('is-team-group', activeTemplateForUi.type === 'team');
        b.classList.toggle('over-capacity', n>c);
    });
    if (typeof refreshEmptySeatAccessibility === 'function') refreshEmptySeatAccessibility();
    updateWaitingTrayState();
    renderListEmptyHint();
    updateTrayMenuDirection();
    if (typeof currentView !== 'undefined' && currentView === 'sheet') {
        renderSheetView();
    }
    if (typeof currentView !== 'undefined' && currentView === 'seisan') {
        renderSettlementView();
    }
    if (typeof refreshPlanningCheckCount === 'function') refreshPlanningCheckCount();
    // Participant data can arrive by registration, room restore, or remote sync. Re-evaluate
    // first-view guidance after every UI refresh so a room that already contains people still
    // gets its one-time, per-device guidance.
    window.refreshFirstViewGuidanceEligibility?.();
}

function renderListEmptyHint() {
    const container = byId('cars-container');
    if (!container) return;
    const hasCar = !!container.querySelector('.car-box');
    const waitingCount = $$('#waiting-list .member-card').length;
    const hasParticipants = hasCar || waitingCount > 0;
    const toolbar = document.querySelector('.allocation-toolbar');
    const bottomTray = byId('bottom-tray');
    if (toolbar) toolbar.hidden = !hasParticipants;
    if (bottomTray) bottomTray.hidden = !hasParticipants;
    document.body.classList.toggle('allocation-empty-state', !hasParticipants);

    const existing = byId('list-empty-hint');
    if (hasCar) {
        existing?.remove();
        return;
    }

    if (waitingCount > 0) {
        // Group creation is owned by the explicit workspace action. Do not show
        // the retired drag-to-create affordance when participants are waiting.
        existing?.remove();
        return;
    }

    const entryChoice = window.SanpoApp?.templates?.common?.entryChoice;
    const emptyChoice = typeof entryChoice === 'function'
        ? entryChoice({ className: 'allocation-entry-choice' })
        : '<div class="app-empty-card empty-card app-entry-choice"><div class="seisan-empty-actions"><cds-button kind="primary" size="lg" type="button" data-action="open-batch">参加者登録（推奨）</cds-button><span class="seisan-empty-or">もしくは</span><cds-button kind="secondary" size="lg" type="button" data-action="switch-seisan-settings">人数だけで精算</cds-button></div></div>';
    const html = `<div class="allocation-grid-item allocation-grid-item--full" id="list-empty-hint">${emptyChoice}</div>`;

    if (!existing) {
        container.insertAdjacentHTML('afterbegin', html);
        return;
    }
    existing.outerHTML = html;
}
