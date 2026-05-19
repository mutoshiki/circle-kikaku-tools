// Settlement state and DOM snapshot helpers.
// Split from features/settlement.js during S-3 cleanup.

function getDefaultSettlementState() {
    return {
        rounding: '100',
        organizerFree: true,
        organizerName: '',
        driverReward: '1000',
        cars: {},
        routeStops: [],
        paid: {},
        driverPaid: {}
    };
}

function normalizeExtraItem(ex = {}) {
    const type = ex.type === 'club' ? 'club' : 'split';
    return {
        name: String(ex.name ?? '').trim(),
        amount: String(ex.amount ?? ''),
        type
    };
}

function hasMeaningfulExtra(ex = {}) {
    return Boolean(String(ex.name ?? '').trim() || String(ex.amount ?? '').trim());
}

function normalizeCarSettlementState(raw = {}) {
    // 入力中の空行も保持する。
    // ここで空行を消すと、「諸経費を追加」直後に再描画で行が消えるため。
    const extras = Array.isArray(raw.extras) ? raw.extras.map(normalizeExtraItem) : [];
    if (!extras.length) {
        if (String(raw.splitExtra ?? '').trim()) extras.push({ name: '諸経費', amount: String(raw.splitExtra), type: 'split' });
        if (String(raw.clubExtra ?? '').trim()) extras.push({ name: '部費負担', amount: String(raw.clubExtra), type: 'club' });
    }
    return {
        dist: String(raw.dist ?? ''),
        eco: String(raw.eco ?? ''),
        price: String(raw.price ?? ''),
        extras
    };
}

function normalizeSettlementState(state = {}) {
    const base = getDefaultSettlementState();
    const cars = {};
    if (state.cars && typeof state.cars === 'object') {
        Object.entries(state.cars).forEach(([name, car]) => {
            cars[name] = normalizeCarSettlementState(car || {});
        });
    }
    return {
        ...base,
        ...state,
        rounding: String(state.rounding ?? base.rounding),
        organizerFree: state.organizerFree !== undefined ? !!state.organizerFree : true,
        organizerName: state.organizerName || '',
        driverReward: String(state.driverReward ?? base.driverReward),
        cars,
        routeStops: Array.isArray(state.routeStops) ? state.routeStops.map(v => String(v ?? '').trim()).filter(Boolean) : [],
        paid: state.paid && typeof state.paid === 'object' ? state.paid : {},
        driverPaid: state.driverPaid && typeof state.driverPaid === 'object' ? state.driverPaid : {}
    };
}

function ensureSettlementState() {
    if (!settlementState) settlementState = normalizeSettlementState({});
    return settlementState;
}

function getNumberValue(value) {
    const n = Number(String(value ?? '').replace(/,/g, ''));
    return Number.isFinite(n) ? n : 0;
}

function roundUp(value, unit) {
    const u = Math.max(1, Number(unit) || 1);
    return Math.ceil(value / u) * u;
}

function yen(value) {
    return window.SanpoSettlement?.yen ? window.SanpoSettlement.yen(value) : ('¥' + Math.round(value || 0).toLocaleString());
}

function getRoomDataOnly() {
    const roomName = $('#roomNameInput')?.value || '';
    if (typeof getCarPlansSnapshot === 'function' && typeof normalizeCarPlanTemplateType === 'function') {
        const plans = getCarPlansSnapshot();
        const active = plans.find(plan => plan.id === activeCarPlanId);
        const target = active && normalizeCarPlanTemplateType(active.templateType) === 'car'
            ? active
            : plans.find(plan => normalizeCarPlanTemplateType(plan.templateType) === 'car');
        if (target) {
            return {
                roomName,
                settlementPlanName: target.name || '車割',
                waiting: cloneData(target.waiting || []),
                cars: cloneData(target.cars || [])
            };
        }
    }
    return {
        roomName,
        settlementPlanName: '',
        waiting: Array.from($$('#waiting-list .member-card')).map(getMemData),
        cars: Array.from($$('.car-box')).map(c => ({
            name: $('.driver-name-disp', c).innerText,
            capacity: c.dataset.capacity,
            driverMemo: $('.driver-memo-text', c).innerText,
            driverGender: $('.driver-seat', c).dataset.gender,
            driverGrade: parseInt($('.driver-seat', c).dataset.grade)||0,
            members: Array.from($$('.seat-slot', c)).flatMap(s => getRealSeatCards(s).map(getMemData))
        }))
    };
}

function getParticipantList(data = null) {
    const source = data || getRoomDataOnly();
    const seen = new Set();
    const list = [];
    const push = (name, role) => {
        const key = String(name || '').trim();
        if (!key || seen.has(key)) return;
        seen.add(key);
        list.push({ name: key, role });
    };
    (source.cars || []).forEach(car => {
        push(car.name, 'driver');
        (car.members || []).forEach(m => push(m?.name, 'member'));
    });
    (source.waiting || []).forEach(m => push(m?.name, 'waiting'));
    return list;
}

function syncSettlementStateFromDOM() {
    const state = ensureSettlementState();
    const rounding = byId('seisanRounding');
    const organizerFree = byId('seisanOrganizerFree');
    const organizerName = byId('seisanOrganizerName');
    const driverReward = byId('seisanDriverReward');

    if (rounding) state.rounding = rounding.value || '100';
    if (organizerFree) state.organizerFree = organizerFree.checked;
    if (organizerName) state.organizerName = organizerName.value || '';
    if (driverReward) state.driverReward = driverReward.value;

    document.querySelectorAll('.seisan-car-row').forEach(row => {
        const name = row.dataset.driverName;
        if (!name) return;
        // 入力途中の空行も保持する。計算時だけ空行を除外する。
        const extras = Array.from(row.querySelectorAll('.seisan-extra-row')).map(exRow => normalizeExtraItem({
            name: exRow.querySelector('[data-extra-field="name"]')?.value || '',
            amount: exRow.querySelector('[data-extra-field="amount"]')?.value || '',
            type: exRow.querySelector('[data-extra-field="type"]')?.value || 'split'
        }));
        state.cars[name] = normalizeCarSettlementState({
            dist: row.querySelector('[data-field="dist"]')?.value || '',
            eco: row.querySelector('[data-field="eco"]')?.value || '',
            price: row.querySelector('[data-field="price"]')?.value || '',
            extras
        });
    });
    return state;
}

function getSettlementSnapshot() {
    const state = ensureSettlementState();
    const settlementArea = byId('seisan-view-area');
    if (settlementArea && settlementArea.classList.contains('active')) syncSettlementStateFromDOM();
    return JSON.parse(JSON.stringify(state));
}
