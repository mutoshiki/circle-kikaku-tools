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
        : { type: 'car', ownerLabel: '車出し', memberLabel: '席' };
    const cars = Array.isArray(plan?.cars) ? plan.cars : [];
    const waiting = Array.isArray(plan?.waiting) ? plan.waiting : [];
    const ownerCount = cars.length;
    const assignedMemberCount = cars.reduce((sum, car) => sum + (car.members || []).filter(Boolean).length, 0);
    const waitingCount = waiting.length;
    const memberCount = assignedMemberCount + waitingCount;
    const totalCount = ownerCount + memberCount;
    const ownerSummaryLabel = template.type === 'team' ? (template.ownerLabel || '班長') : '運転手';
    const memberSummaryLabel = template.type === 'team' ? '班員' : '同乗者';
    const stats = [
        [ownerSummaryLabel, ownerCount],
        [memberSummaryLabel, memberCount],
        ['全員', totalCount],
        ['待機', waitingCount]
    ];
    const row = document.createElement('span');
    row.className = `sheet-summary-row is-${template.type || 'car'}`;
    const planLabel = document.createElement('span');
    planLabel.className = 'sheet-summary-plan-label';
    planLabel.textContent = template.type === 'team' ? '班割' : '車割';
    row.appendChild(planLabel);
    stats.forEach(([label, value]) => {
        const item = document.createElement('span');
        item.className = 'sheet-summary-stat';
        item.append(document.createTextNode(label));
        const strong = document.createElement('strong');
        strong.textContent = String(value);
        item.appendChild(strong);
        row.appendChild(item);
    });
    if (updatedLabel) {
        const updated = document.createElement('span');
        updated.className = 'sheet-summary-updated';
        updated.append(document.createTextNode('更新'));
        const strong = document.createElement('strong');
        strong.textContent = updatedLabel;
        updated.appendChild(strong);
        row.appendChild(updated);
    }
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
    summaryEl.replaceChildren(
        buildSheetPlanSummaryRow(carPlan),
        buildSheetPlanSummaryRow(teamPlan, updated)
    );
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
        const icon = $('.delete-btn-overlay i', card);
        const btn = $('.delete-btn-overlay', card);
        if (!icon || !btn) return;
        icon.className = `fas ${inWaiting ? 'fa-trash-alt' : 'fa-reply'}`;
        btn.title = inWaiting ? '削除' : '待機に戻す';
        const label = btn.querySelector('span');
        if (label) label.textContent = inWaiting ? '削除' : '戻す';
    });
    $$('.car-box').forEach(b => {
        const c = getInt(b.dataset.capacity);
        const n = Array.from($$('.seat-slot', b)).reduce((sum, slot) => sum + getRealSeatCards(slot).length, 0);
        const badge = $('.capacity-badge', b);
        badge.innerHTML = `<span class="capacity-count">${n}/${c}</span><i class="fas fa-pen" aria-hidden="true"></i>`;
        badge.className = `capacity-badge capacity-edit-btn ${n>c?'is-over':(n===c?'is-full':'')}`;
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
    updateAutoAssignSummary();
    updateLastAutoAssignCondition();
    updateTrayMenuDirection();
    if (typeof currentView !== 'undefined' && currentView === 'sheet') {
        renderSheetView();
    }
    if (typeof currentView !== 'undefined' && currentView === 'seisan') {
        renderSettlementView();
    }
}

function renderListEmptyHint() {
    const container = byId('cars-container');
    if (!container) return;
    const hasCar = !!container.querySelector('.car-box');
    const existing = byId('list-empty-hint');
    if (hasCar) {
        existing?.remove();
        return;
    }

    const waitingCount = $$('#waiting-list .member-card').length;
    const activePlan = typeof getActiveCarPlan === 'function' ? getActiveCarPlan() : null;
    const template = typeof getCarPlanTemplateConfig === 'function'
        ? getCarPlanTemplateConfig(activePlan || 'car')
        : { sectionTitle: '車割', ownerLabel: '車出し', groupSuffix: '車', ownerIcon: 'fa-car' };
    const ownerText = template.type === 'team'
        ? '班長にする人をここへドロップ'
        : '車出しをここへドロップ';
    const createText = template.type === 'team' ? '新しい班を作成します' : '新しい車を作成します';
    const html = waitingCount > 0
        ? `<div class="col-12" id="list-empty-hint"><div class="drop-create-lane empty-card--drop-create"><i class="fas ${template.ownerIcon || 'fa-car'}" aria-hidden="true"></i><strong>${ownerText}</strong><span>${createText}</span></div></div>`
        : `<div class="col-12" id="list-empty-hint"><div class="empty-card app-empty-card"><i class="fas fa-plus" aria-hidden="true"></i><strong>参加者登録</strong><div class="seisan-empty-actions"><button class="seisan-btn primary" type="button" data-action="open-batch"><i class="fas fa-plus me-1" aria-hidden="true"></i>参加者登録を開く</button><span class="seisan-empty-or">もしくは</span><button class="seisan-btn" type="button" data-action="switch-seisan-settings"><i class="fas fa-calculator me-1" aria-hidden="true"></i>人数だけで精算</button></div></div></div>`;

    if (!existing) {
        container.insertAdjacentHTML('afterbegin', html);
        return;
    }
    existing.outerHTML = html;
}
