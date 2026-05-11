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
    const items = [
        ['車出し', driverCount],
        ['同乗者', riderCount],
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
    if (!existing) {
        container.insertAdjacentHTML('afterbegin', `<div class="col-12" id="list-empty-hint"><div class="empty-card"><i class="fas fa-paste"></i><strong>まずは参加者登録から</strong><span>企画の参加者と車出しを登録すると、ここに車割の編集画面が表示されます。</span><button class="seisan-btn primary" type="button" data-action="open-batch">参加者登録を開く</button></div></div>`);
    }
}
