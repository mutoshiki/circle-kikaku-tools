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

function updateSheetSummary(data = getData()) {
    const summaryEl = byId('sheet-summary');
    if (!summaryEl) return;
    const driverCount = data.cars.length;
    const assignedRiderCount = data.cars.reduce((sum, car) => sum + (car.members || []).filter(Boolean).length, 0);
    const waitingCount = data.waiting.length;
    const riderCount = assignedRiderCount + waitingCount;
    const totalCount = driverCount + riderCount;
    const activePlan = typeof getActiveCarPlan === 'function' ? getActiveCarPlan() : null;
    const template = typeof getCarPlanTemplateConfig === 'function'
        ? getCarPlanTemplateConfig(activePlan || 'car')
        : { ownerLabel: '車出し', memberLabel: '同乗者' };
    const memberSummaryLabel = template.type === 'team' ? 'メンバー' : '同乗者';
    const items = [
        ...(activePlan?.name ? [['表示', activePlan.name]] : []),
        [template.ownerLabel || '車出し', driverCount],
        [memberSummaryLabel, riderCount],
        ['全員', totalCount],
        ['待機', waitingCount]
    ];
    const updated = formatUpdatedAt(data.lastUpdatedAt);
    if (updated) items.push(['最終更新', updated]);
    summaryEl.replaceChildren(...items.map(([label, value]) => {
        const span = document.createElement('span');
        span.className = 'sheet-summary-pill';
        span.append(document.createTextNode(label + ' '));
        const strong = document.createElement('strong');
        strong.textContent = String(value);
        span.appendChild(strong);
        return span;
    }));
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
    const label = template.type === 'team' ? '班' : '車';
    const ownerText = template.type === 'team' ? '班長を置く' : '車出しを置く';
    const createText = `${label}を作成`;
    const html = waitingCount > 0
        ? `<div class="col-12" id="list-empty-hint"><div class="drop-create-lane empty-card--drop-create"><i class="fas ${template.ownerIcon || 'fa-car'}" aria-hidden="true"></i><strong>${ownerText}</strong><span>${createText}</span></div></div>`
        : `<div class="col-12" id="list-empty-hint"><div class="empty-card"><i class="fas fa-plus" aria-hidden="true"></i><strong>参加者登録</strong><span>名簿を読み込むと、${template.sectionTitle}を作れます。</span><button class="seisan-btn primary" type="button" data-action="open-batch">参加者登録を開く</button></div></div>`;

    if (!existing) {
        container.insertAdjacentHTML('afterbegin', html);
        return;
    }
    existing.outerHTML = html;
}
