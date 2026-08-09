// Data/state feature
// Owns app snapshot serialization, restoration, car-plan switching, and small card state toggles.

// Which allocation tab a person is viewing and whether their waiting tray is collapsed are
// device presentation preferences, not room collaboration data.  Keeping these local prevents
// one phone from switching every other phone from 車割 to 班割 (or collapsing their tray) and
// removes a major source of remote repaint races while a modal is open.
function getDeviceRoomUiStateKey() {
    return `sanpoRoomUi:v1:${roomId}`;
}

function readDeviceRoomUiState() {
    const stored = safeJsonParse(localStorage.getItem(getDeviceRoomUiStateKey()), {}) || {};
    return {
        activeAllocationType: stored.activeAllocationType === 'team' ? 'team' : (stored.activeAllocationType === 'car' ? 'car' : ''),
        trayMinimized: typeof stored.trayMinimized === 'boolean' ? stored.trayMinimized : null
    };
}

function writeDeviceRoomUiState(patch = {}) {
    const current = readDeviceRoomUiState();
    const next = { ...current, ...patch };
    if (next.activeAllocationType !== 'team') next.activeAllocationType = 'car';
    if (typeof next.trayMinimized !== 'boolean') delete next.trayMinimized;
    try { localStorage.setItem(getDeviceRoomUiStateKey(), JSON.stringify(next)); }
    catch (error) { console.warn('Failed to save device room UI state:', error); }
    return next;
}

window.SanpoDeviceRoomUi = Object.freeze({
    read: readDeviceRoomUiState,
    write: writeDeviceRoomUiState
});

function cloneData(value) {
    return JSON.parse(JSON.stringify(value ?? null));
}

function createCarPlanId() {
    return `plan-${(window.SanpoClock?.now?.() ?? Date.now()).toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

const SINGLE_CAR_PLAN_ID = 'plan-car';
const SINGLE_TEAM_PLAN_ID = 'plan-team';

function getSinglePlanId(templateType = 'car') {
    return normalizeCarPlanTemplateType(templateType) === 'team' ? SINGLE_TEAM_PLAN_ID : SINGLE_CAR_PLAN_ID;
}

function getDefaultCarPlanName(index = 0, templateType = 'car') {
    const type = normalizeCarPlanTemplateType(templateType);
    const prefix = type === 'team' ? '班' : '車割';
    return index <= 0 ? prefix : `${prefix} ${index + 1}`;
}

function getNextCarPlanName(templateType = 'car') {
    const type = normalizeCarPlanTemplateType(templateType);
    const count = Array.isArray(carPlans)
        ? carPlans.filter(plan => normalizeCarPlanTemplateType(plan.templateType) === type).length
        : 0;
    return getDefaultCarPlanName(count, type);
}

function normalizeCarPlanTemplateType(value = 'car') {
    const raw = String(value || '').trim().toLowerCase();
    if (raw === 'team' || raw === 'group' || raw === 'han' || raw === '班' || raw === '班割') return 'team';
    return 'car';
}

function getCarPlanTemplateConfig(planOrType = 'car') {
    const type = typeof planOrType === 'string'
        ? normalizeCarPlanTemplateType(planOrType)
        : normalizeCarPlanTemplateType(planOrType?.templateType || planOrType?.template || planOrType?.kind);
    if (type === 'team') {
        return {
            type: 'team',
            sectionTitle: '班',
            sheetTitle: '班割',
            planName: '班割',
            ownerLabel: '班長',
            memberLabel: '班員',
            groupSuffix: '班',
            ownerIcon: 'user-multiple'
        };
    }
    return {
        type: 'car',
        sectionTitle: '車割',
        sheetTitle: '車割',
        planName: '車割',
        ownerLabel: '車出し',
        memberLabel: '席',
        groupSuffix: '車',
        ownerIcon: 'car-small'
    };
}

function getDefaultGroupCapacityForActivePlan() {
    const active = typeof getActiveCarPlan === 'function' ? getActiveCarPlan() : null;
    const type = normalizeCarPlanTemplateType(active?.templateType || 'car');
    return type === 'team' ? 5 : 3;
}

function getActiveGroupSuffix() {
    const active = typeof getActiveCarPlan === 'function' ? getActiveCarPlan() : null;
    return getCarPlanTemplateConfig(active || 'car').groupSuffix;
}

function getMemData(el) {
    return {
        participantId: String(el?.dataset?.participantId || '').trim(),
        name: el.dataset.name,
        memo: $('.memo-popup', el).innerText,
        gender: el.dataset.gender,
        grade: parseInt(el.dataset.grade)||0,
        locked: el.dataset.locked === 'true',
        flag: normalizePersonFlag(el.dataset.flag)
    };
}

function getCurrentAllocationFromDom() {
    return {
        waiting: Array.from($$('#waiting-list .member-card')).map(getMemData),
        cars: Array.from($$('.car-box')).map(c => {
            const driverSeat = $('.driver-seat', c);
            return {
                participantId: String(driverSeat?.dataset?.participantId || '').trim(),
                groupId: String(c.dataset.groupId || '').trim(),
                name: $('.driver-name-disp', c).innerText,
                capacity: c.dataset.capacity,
                driverMemo: $('.driver-memo-text', c).innerText,
                driverGender: driverSeat?.dataset.gender || 'unknown',
                driverGrade: parseInt(driverSeat?.dataset.grade)||0,
                driverFlag: normalizePersonFlag(driverSeat?.dataset.flag),
                members: Array.from($$('.seat-slot', c)).flatMap(slot => getRealSeatCards(slot).map(getMemData))
            };
        })
    };
}

function normalizeCarPlan(plan = {}, index = 0) {
    const id = String(plan.id || plan.planId || '').trim() || createCarPlanId();
    const templateType = normalizeCarPlanTemplateType(plan.templateType || plan.template || plan.kind || 'car');
    const name = String(plan.name || plan.label || '').trim() || getDefaultCarPlanName(index, templateType);
    return {
        id,
        name,
        waiting: Array.isArray(plan.waiting) ? cloneData(plan.waiting) : [],
        cars: Array.isArray(plan.cars) ? cloneData(plan.cars) : [],
        templateType,
        lastAutoAssignLabel: String(plan.lastAutoAssignLabel || ''),
        createdAt: Number(plan.createdAt || (window.SanpoClock?.now?.() ?? Date.now())) || (window.SanpoClock?.now?.() ?? Date.now()),
        updatedAt: Number(plan.updatedAt || (window.SanpoClock?.now?.() ?? Date.now())) || (window.SanpoClock?.now?.() ?? Date.now())
    };
}

function normalizeParticipantKey(value = '') {
    return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function createMemberRecord(member = {}) {
    member = member || {};
    const name = String(member.name || '').trim();
    if (!name) return null;
    return {
        name,
        memo: member.memo || member.driverMemo || '',
        gender: member.gender || member.driverGender || 'unknown',
        grade: parseInt(member.grade ?? member.driverGrade) || 0,
        locked: !!member.locked,
        flag: normalizePersonFlag(member.flag ?? member.driverFlag)
    };
}

function addParticipantToRegistry(registry, member = {}) {
    const record = createMemberRecord(member);
    if (!record) return;
    const key = normalizeParticipantKey(record.name);
    const existing = registry.get(key) || {};
    registry.set(key, {
        name: record.name || existing.name || '',
        memo: record.memo || existing.memo || '',
        gender: record.gender && record.gender !== 'unknown' ? record.gender : (existing.gender || record.gender || 'unknown'),
        grade: record.grade || existing.grade || 0,
        locked: Boolean(record.locked || existing.locked),
        flag: record.flag !== 'none' ? record.flag : (existing.flag || 'none')
    });
}

function collectParticipantRegistryFromPlans(plans = []) {
    const registry = new Map();
    const list = Array.isArray(plans) ? plans : [];
    list.forEach(plan => {
        (plan?.cars || []).forEach(group => {
            addParticipantToRegistry(registry, {
                name: group.name,
                memo: group.driverMemo || '',
                gender: group.driverGender || 'unknown',
                grade: group.driverGrade || 0,
                locked: false,
                flag: group.driverFlag || 'none'
            });
            (group.members || []).forEach(member => addParticipantToRegistry(registry, member));
        });
        (plan?.waiting || []).forEach(member => addParticipantToRegistry(registry, member));
    });
    return registry;
}

function memberFromRegistry(registry, name) {
    const record = registry.get(normalizeParticipantKey(name));
    return record ? cloneData(record) : null;
}

function updateMemberFromRegistry(member, registry) {
    const record = memberFromRegistry(registry, member?.name);
    if (!record) return null;
    return {
        name: record.name,
        memo: record.memo || member.memo || '',
        gender: record.gender || member.gender || 'unknown',
        grade: parseInt(record.grade || member.grade) || 0,
        locked: Boolean(record.locked || member.locked),
        flag: normalizePersonFlag(record.flag !== 'none' ? record.flag : member.flag)
    };
}

function sanitizePlanToParticipantRegistry(plan, registry) {
    const used = new Set();
    const waiting = [];
    const cars = [];
    const putWaiting = member => {
        const key = normalizeParticipantKey(member?.name);
        if (!key || !registry.has(key) || used.has(key)) return;
        const next = updateMemberFromRegistry(member, registry);
        if (!next) return;
        waiting.push(next);
        used.add(key);
    };

    (plan.cars || []).forEach(group => {
        const driverKey = normalizeParticipantKey(group?.name);
        if (!driverKey || !registry.has(driverKey) || used.has(driverKey)) {
            (group?.members || []).forEach(putWaiting);
            return;
        }
        const driverRecord = memberFromRegistry(registry, group.name) || {};
        const nextGroup = {
            ...cloneData(group),
            name: driverRecord.name || group.name,
            driverMemo: driverRecord.memo || group.driverMemo || '',
            driverGender: driverRecord.gender || group.driverGender || 'unknown',
            driverGrade: parseInt(driverRecord.grade || group.driverGrade) || 0,
            driverFlag: normalizePersonFlag(driverRecord.flag !== 'none' ? driverRecord.flag : group.driverFlag),
            members: []
        };
        used.add(driverKey);
        (group.members || []).forEach(member => {
            const key = normalizeParticipantKey(member?.name);
            if (!key || !registry.has(key) || used.has(key)) return;
            const next = updateMemberFromRegistry(member, registry);
            if (!next) return;
            nextGroup.members.push(next);
            used.add(key);
        });
        cars.push(nextGroup);
    });

    (plan.waiting || []).forEach(putWaiting);
    registry.forEach((record, key) => {
        if (!used.has(key)) {
            waiting.push(cloneData(record));
            used.add(key);
        }
    });

    plan.cars = cars;
    plan.waiting = waiting;
    return plan;
}

function createSinglePlanFromSource(source = {}, templateType = 'car', registry = null) {
    const type = normalizeCarPlanTemplateType(templateType);
    const plan = normalizeCarPlan({
        ...cloneData(source || {}),
        id: getSinglePlanId(type),
        name: String(source?.name || source?.label || '').trim() || getDefaultCarPlanName(0, type),
        templateType: type
    }, 0);
    plan.id = getSinglePlanId(type);
    plan.templateType = type;
    if (registry) sanitizePlanToParticipantRegistry(plan, registry);
    return plan;
}

function normalizeSingleCarPlansFromData(data = {}) {
    const legacyPlan = {
        id: data.activeCarPlanId || SINGLE_CAR_PLAN_ID,
        name: '車割',
        waiting: data.waiting || [],
        cars: data.cars || [],
        lastAutoAssignLabel: data.lastAutoAssignLabel || '',
        templateType: 'car'
    };
    const sourcePlans = Array.isArray(data.carPlans) && data.carPlans.length ? data.carPlans : [legacyPlan];
    const normalizedSources = sourcePlans.map((plan, index) => normalizeCarPlan(plan, index));
    const activeSource = normalizedSources.find(plan => plan.id === data.activeCarPlanId);
    const activeType = normalizeCarPlanTemplateType(activeSource?.templateType || 'car');
    const carSource = (activeType === 'car' ? activeSource : null)
        || normalizedSources.find(plan => normalizeCarPlanTemplateType(plan.templateType) === 'car')
        || legacyPlan;
    const teamSource = (activeType === 'team' ? activeSource : null)
        || normalizedSources.find(plan => normalizeCarPlanTemplateType(plan.templateType) === 'team') || {
        id: SINGLE_TEAM_PLAN_ID,
        name: '班',
        waiting: [],
        cars: [],
        templateType: 'team',
        lastAutoAssignLabel: ''
    };
    const registry = collectParticipantRegistryFromPlans([carSource, teamSource]);
    const carPlan = createSinglePlanFromSource(carSource, 'car', registry);
    const teamPlan = createSinglePlanFromSource(teamSource, 'team', registry);
    return [carPlan, teamPlan];
}

function normalizeCarPlansFromData(data = {}) {
    return normalizeSingleCarPlansFromData(data);
}

function ensureSingleCarPlans({ sourcePlan = null, useActiveRoster = false } = {}) {
    const activeType = normalizeCarPlanTemplateType((sourcePlan || carPlans.find(plan => plan.id === activeCarPlanId))?.templateType || 'car');
    carPlans = normalizeSingleCarPlansFromData({ carPlans });
    const source = sourcePlan
        ? carPlans.find(plan => plan.id === getSinglePlanId(normalizeCarPlanTemplateType(sourcePlan.templateType))) || sourcePlan
        : null;
    const registry = useActiveRoster && source
        ? collectParticipantRegistryFromPlans([source])
        : collectParticipantRegistryFromPlans(carPlans);
    carPlans.forEach(plan => sanitizePlanToParticipantRegistry(plan, registry));
    if (!carPlans.some(plan => plan.id === activeCarPlanId)) {
        activeCarPlanId = getSinglePlanId(activeType);
    }
    if (!carPlans.some(plan => plan.id === activeCarPlanId)) activeCarPlanId = SINGLE_CAR_PLAN_ID;
    return carPlans;
}

function pruneSettlementStateToRegisteredParticipants() {
    if (!settlementState || settlementState?.standalone?.enabled === true) return;
    const canonical = window.SanpoCanonicalState?.get?.();
    if (!canonical) return;
    const participantKeys = new Set(Object.values(canonical.participants || {}).map(participant => normalizeParticipantKey(participant?.name)).filter(Boolean));
    const carPlan = window.SanpoCanonicalState.projectAllocation(canonical, 'car');
    const driverKeys = new Set((carPlan.cars || []).map(car => normalizeParticipantKey(car?.name)).filter(Boolean));
    const pruneObject = (object, allowedKeys) => {
        if (!object || typeof object !== 'object') return {};
        const next = {};
        Object.entries(object).forEach(([name, value]) => {
            if (allowedKeys.has(normalizeParticipantKey(name))) next[name] = value;
        });
        return next;
    };
    settlementState.paid = pruneObject(settlementState.paid, participantKeys);
    settlementState.paidBy = pruneObject(settlementState.paidBy, participantKeys);
    settlementState.driverPaid = pruneObject(settlementState.driverPaid, driverKeys);
    settlementState.cars = pruneObject(settlementState.cars, driverKeys);
    if (settlementState.organizerName && !participantKeys.has(normalizeParticipantKey(settlementState.organizerName))) settlementState.organizerName = '';
    window.SanpoCanonicalState.setSettlementFromUi(settlementState);
}

function synchronizeParticipantRosterFromCurrentDom() {
    const active = syncActiveCarPlanFromDom();
    pruneSettlementStateToRegisteredParticipants();
    return active;
}

window.synchronizeParticipantRosterFromCurrentDom = synchronizeParticipantRosterFromCurrentDom;
window.pruneSettlementStateToRegisteredParticipants = pruneSettlementStateToRegisteredParticipants;

function getActiveCarPlan() {
    const canonical = window.SanpoCanonicalState?.get?.();
    if (canonical) {
        const type = canonical.activeAllocationType === 'team' ? 'team' : 'car';
        activeCarPlanId = getSinglePlanId(type);
        const plan = window.SanpoCanonicalState.projectAllocation(canonical, type);
        carPlans = window.SanpoCanonicalState.projectPlans(canonical);
        return plan;
    }
    if (!Array.isArray(carPlans) || !carPlans.length) {
        const dom = getCurrentAllocationFromDom();
        carPlans = normalizeSingleCarPlansFromData({
            activeCarPlanId: activeCarPlanId || SINGLE_CAR_PLAN_ID,
            carPlans: [{ id: SINGLE_CAR_PLAN_ID, name: '車割', ...dom, lastAutoAssignLabel, templateType: 'car' }]
        });
    }
    return carPlans.find(p => p.id === activeCarPlanId) || carPlans[0];
}

function syncActiveCarPlanFromDom() {
    if (isRestoringCarPlans || window.__suspendActiveDomPlanSync) return getActiveCarPlan();
    const canonical = window.SanpoCanonicalState?.get?.();
    if (!canonical) return getActiveCarPlan();
    const type = canonical.activeAllocationType === 'team' ? 'team' : 'car';
    window.SanpoCanonicalState.captureFromDom(canonical, getCurrentAllocationFromDom(), type);
    const allocation = canonical.allocations?.[type];
    if (allocation) allocation.lastAutoAssignLabel = String(lastAutoAssignLabel || allocation.lastAutoAssignLabel || '');
    carPlans = window.SanpoCanonicalState.projectPlans(canonical);
    activeCarPlanId = getSinglePlanId(type);
    return carPlans.find(plan => plan.id === activeCarPlanId) || carPlans[0];
}

function getCarPlansSnapshot(options = {}) {
    const canonical = window.SanpoCanonicalState?.get?.();
    if (canonical) {
        if (!options.skipDomSync) syncActiveCarPlanFromDom();
        carPlans = window.SanpoCanonicalState.projectPlans(canonical);
        return cloneData(carPlans);
    }
    if (!options.skipDomSync) syncActiveCarPlanFromDom();
    return carPlans.map((plan, index) => normalizeCarPlan(plan, index));
}

function renderActiveCarPlanToDom(options = {}) {
    const canonical = window.SanpoCanonicalState?.get?.();
    const type = canonical?.activeAllocationType === 'team' ? 'team' : 'car';
    const plan = canonical
        ? window.SanpoCanonicalState.projectAllocation(canonical, type)
        : getActiveCarPlan();
    const previousCardUpdateSuspend = !!window.__suspendCardUpdateUi;
    isRestoringCarPlans = true;
    window.__suspendCardUpdateUi = true;
    try {
        $('#waiting-list').innerHTML = '';
        $('#cars-container').innerHTML = '';
        (plan.waiting || []).forEach(m => addMember(m.name, m.memo, m.gender, m.grade||0, $('#waiting-list'), m.locked, m.flag, m.participantId));
        (plan.cars || []).forEach(c => addCar(c.name, c.capacity, c.members, c.driverMemo, c.driverGender, c.driverGrade || 0, c.driverFlag, c.participantId, c.groupId));
    } finally {
        isRestoringCarPlans = false;
        window.__suspendCardUpdateUi = previousCardUpdateSuspend;
    }
    activeCarPlanId = getSinglePlanId(type);
    carPlans = canonical ? window.SanpoCanonicalState.projectPlans(canonical) : carPlans;
    lastAutoAssignLabel = plan.lastAutoAssignLabel || '';
    renderCarPlanSwitcher();
    if (!options.skipUpdate) updateUI();
}

function collectParticipantsForNewPlan(plan = null) {
    const source = plan ? { waiting: plan.waiting || [], cars: plan.cars || [] } : getCurrentAllocationFromDom();
    const seen = new Set();
    const people = [];
    const push = member => {
        const name = String(member?.name || '').trim();
        if (!name || seen.has(name)) return;
        seen.add(name);
        people.push({
            name,
            memo: member.memo || '',
            gender: member.gender || 'unknown',
            grade: parseInt(member.grade) || 0,
            locked: !!member.locked,
            flag: normalizePersonFlag(member.flag ?? member.driverFlag)
        });
    };
    (source.cars || []).forEach(car => {
        push({ name: car.name, memo: car.driverMemo || '', gender: car.driverGender || 'unknown', grade: car.driverGrade || 0, locked: false });
        (car.members || []).forEach(push);
    });
    (source.waiting || []).forEach(push);
    return people;
}

function renderCarPlanSwitcher() {
    const bar = byId('car-plan-switcher');
    if (!bar) return;
    const active = getActiveCarPlan();
    const activeTemplateType = normalizeCarPlanTemplateType(active.templateType);
    const selectedIndex = activeTemplateType === 'team' ? 1 : 0;
    bar.innerHTML = `
        <cds-content-switcher class="car-plan-template-tabs" role="tablist" aria-label="車割と班割を切り替え" value="${activeTemplateType}" selected-index="${selectedIndex}" size="lg">
            <cds-content-switcher-item id="car-plan-tab-car" value="car" data-car-plan-template="car" aria-controls="cars-container"${activeTemplateType === 'car' ? ' selected' : ''}>車割</cds-content-switcher-item>
            <cds-content-switcher-item id="car-plan-tab-team" value="team" data-car-plan-template="team" aria-controls="cars-container"${activeTemplateType === 'team' ? ' selected' : ''}>班割</cds-content-switcher-item>
        </cds-content-switcher>
    `;
}

function switchCarPlan(id, { persist = true } = {}) {
    const canonical = window.SanpoCanonicalState?.get?.();
    const nextType = id === SINGLE_TEAM_PLAN_ID || normalizeCarPlanTemplateType(id) === 'team' ? 'team' : 'car';
    if (canonical) {
        const currentType = canonical.activeAllocationType === 'team' ? 'team' : 'car';
        if (currentType === nextType) return;
        syncActiveCarPlanFromDom();
        canonical.activeAllocationType = nextType;
        writeDeviceRoomUiState({ activeAllocationType: nextType });
        activeCarPlanId = getSinglePlanId(nextType);
        const next = window.SanpoCanonicalState.projectAllocation(canonical, nextType);
        lastAutoAssignLabel = next.lastAutoAssignLabel || '';
        renderActiveCarPlanToDom();
        if (persist) save();
        return;
    }
    const nextId = getSinglePlanId(nextType);
    const target = carPlans.find(plan => plan.id === nextId);
    if (!target || target.id === activeCarPlanId) return;
    activeCarPlanId = nextId;
    renderActiveCarPlanToDom();
    if (persist) save();
}

function createNewCarPlanFromParticipants() {
    // 車割・班はそれぞれ1つだけに固定。古いボタン経由の呼び出しは何もしない。
    showMiniToast('車割と班は1つずつ使います', 'neutral');
}

function duplicateActiveCarPlan() {
    // 複数作成は廃止。
    showMiniToast('複製は廃止しました', 'neutral');
}

async function renameActiveCarPlan() {
    if (typeof canUseUnlockedMenuAction === 'function' && !canUseUnlockedMenuAction()) return;
    syncActiveCarPlanFromDom();
    const canonical = window.SanpoCanonicalState?.get?.();
    const active = getActiveCarPlan();
    const config = getCarPlanTemplateConfig(active);
    const nextName = await appPrompt(`${config.sectionTitle}名を入力してください`, active.name || config.sectionTitle, { title: `${config.sectionTitle}名を変更`, okText: '保存' });
    if (nextName == null) return;
    const trimmed = nextName.trim();
    if (!trimmed) return;
    if (canonical) {
        const type = canonical.activeAllocationType === 'team' ? 'team' : 'car';
        canonical.allocations[type].name = trimmed;
        canonical.allocations[type].updatedAt = (window.SanpoClock?.now?.() ?? Date.now());
    }
    renderCarPlanSwitcher();
    updateUI();
    save();
}

async function deleteActiveCarPlan() {
    // 車割・班は最低1つずつ保持する。
    const active = getActiveCarPlan();
    const config = getCarPlanTemplateConfig(active);
    await appAlert(`${config.sectionTitle}は1つだけ使います。削除はできません。`, { title: '削除できません' });
}

function updateActiveCarPlanTemplate(templateType) {
    if (typeof canUseUnlockedMenuAction === 'function' && !canUseUnlockedMenuAction()) return;
    const nextType = normalizeCarPlanTemplateType(templateType);
    switchCarPlan(getSinglePlanId(nextType));
}

function setupCarPlanSwitcherEvents() {
    const bar = byId('car-plan-switcher');
    if (!bar || bar.dataset.bound === 'true') return;
    bar.dataset.bound = 'true';
    bar.addEventListener('change', event => {
        if (event.target?.id === 'carPlanSelect') switchCarPlan(event.target.value);
        if (event.target?.id === 'carPlanTemplateSelect') updateActiveCarPlanTemplate(event.target.value);
    });
    bar.addEventListener('cds-content-switcher-selected', event => {
        const item = event.detail?.item;
        if (!item || !bar.contains(item)) return;
        const nextType = item.dataset.carPlanTemplate || item.value;
        updateActiveCarPlanTemplate(nextType);
        requestAnimationFrame(() => bar.querySelector(`[data-car-plan-template="${nextType}"]`)?.focus());
    });
    bar.addEventListener('click', event => {
        const planChip = event.target.closest('[data-car-plan-id]');
        if (planChip) {
            switchCarPlan(planChip.dataset.carPlanId);
            return;
        }
        const templateChip = event.target.closest('[data-car-plan-template]');
        if (templateChip && !templateChip.closest('cds-content-switcher')) {
            updateActiveCarPlanTemplate(templateChip.dataset.carPlanTemplate);
            return;
        }
        const btn = event.target.closest('[data-car-plan-action]');
        if (!btn || btn.disabled) return;
        const action = btn.dataset.carPlanAction;
        if (action === 'new') createNewCarPlanFromParticipants();
        if (action === 'duplicate') duplicateActiveCarPlan();
        if (action === 'rename') renameActiveCarPlan();
        if (action === 'delete') deleteActiveCarPlan();
    });
    bar.addEventListener('keydown', event => {
        if (!['Home', 'End'].includes(event.key)) return;
        const tabs = Array.from(bar.querySelectorAll('[data-car-plan-template]'));
        const currentIndex = tabs.indexOf(event.target.closest('[data-car-plan-template]'));
        if (currentIndex < 0 || tabs.length < 2) return;
        event.preventDefault();
        const nextIndex = event.key === 'Home' ? 0 : tabs.length - 1;
        const nextType = tabs[nextIndex].dataset.carPlanTemplate;
        updateActiveCarPlanTemplate(nextType);
        requestAnimationFrame(() => bar.querySelector(`[data-car-plan-template="${nextType}"]`)?.focus());
    });
}

function getData(options = {}) {
    const canonical = window.SanpoCanonicalState?.get?.() || window.SanpoCanonicalState?.set?.({});
    const activeType = canonical?.activeAllocationType === 'team' ? 'team' : 'car';
    const domAllocation = options.skipDomSync ? null : getCurrentAllocationFromDom();
    writeDeviceRoomUiState({
        activeAllocationType: activeType,
        trayMinimized: byId('bottom-tray')?.classList.contains('minimized') || false
    });
    const snapshot = window.SanpoCanonicalState.createSnapshotFromUi({
        roomName: $('#roomNameInput').value,
        trayMinimized: byId('bottom-tray')?.classList.contains('minimized') || false,
        editLockEnabled,
        editLockPassphrase,
        editLockScopes: { ...editLockScopes },
        settlement: getSettlementSnapshot(),
        overview: window.SanpoOverview?.getSnapshot?.() || window.SanpoApp?.state?.getSnapshot?.()?.overview || {},
        activeType,
        domAllocation,
        lastAutoAssignLabel
    });
    snapshot.lastUpdatedAt = lastUpdatedAt || snapshot.lastUpdatedAt || (window.SanpoClock?.now?.() ?? Date.now());
    window.SanpoApp?.state?.setSnapshot?.(snapshot);
    return snapshot;
}

function restore(d) {
    const canonical = window.SanpoCanonicalState?.set?.(d) || d;
    window.SanpoApp?.state?.setSnapshot?.(canonical);
    lastUpdatedAt = Number(canonical.lastUpdatedAt || 0) || lastUpdatedAt;
    settlementState = normalizeSettlementState(window.SanpoCanonicalState?.settlementToUi?.(canonical.settlement || {}, canonical.participants || {}) || canonical.settlement || {});
    if (Object.prototype.hasOwnProperty.call(canonical, 'overview')) {
        window.SanpoOverview?.applySnapshot?.(canonical.overview || {});
    }
    $('#roomNameInput').value = canonical.roomName || '';
    editLockEnabled = !!canonical.editLockEnabled;
    editLockPassphrase = canonical.editLockPassphrase || '';
    const restoredLockScopes = canonical.editLockScopes && typeof canonical.editLockScopes === 'object' ? canonical.editLockScopes : null;
    editLockScopes = {
        allocation: restoredLockScopes ? !!restoredLockScopes.allocation : editLockEnabled,
        settlement: restoredLockScopes ? !!restoredLockScopes.settlement : editLockEnabled
    };
    editLockEnabled = !!editLockPassphrase && (editLockScopes.allocation || editLockScopes.settlement);
    const deviceUi = readDeviceRoomUiState();
    const activeType = deviceUi.activeAllocationType || (canonical.activeAllocationType === 'team' ? 'team' : 'car');
    canonical.activeAllocationType = activeType;
    writeDeviceRoomUiState({ activeAllocationType: activeType });
    activeCarPlanId = getSinglePlanId(activeType);
    carPlans = window.SanpoCanonicalState?.projectPlans?.(canonical) || [];
    const active = window.SanpoCanonicalState?.projectAllocation?.(canonical, activeType) || carPlans.find(plan => plan.id === activeCarPlanId) || carPlans[0];
    lastAutoAssignLabel = active?.lastAutoAssignLabel || '';
    updateLastAutoAssignCondition();
    loadTrustedEditPassphrase();
    if (editLockPassphrase && trustedEditPassphrase && trustedEditPassphrase !== editLockPassphrase) rememberTrustedDevice('');
    updateEditLockButton();
    refreshRoomTitle();
    const tray = byId('bottom-tray');
    if (tray) {
        const trayMinimized = deviceUi.trayMinimized == null ? canonical.trayMinimized === true : deviceUi.trayMinimized;
        canonical.trayMinimized = trayMinimized;
        writeDeviceRoomUiState({ trayMinimized });
        tray.classList.toggle('minimized', trayMinimized);
        tray.dataset.userMinimized = trayMinimized ? 'true' : 'false';
    }
    renderActiveCarPlanToDom();
    if (currentView === 'seisan') renderSettlementView();
}

async function clearAll() {
    if(!await appConfirm('固定以外を未割り当てに戻します。', { title: '全員を未割り当てへ', okText: '実行' })) return;
    $$('.seat-slot').forEach(slot => getRealSeatCards(slot).filter(m => m.dataset.locked !== 'true').forEach(m => $('#waiting-list').appendChild(m)));
    updateUI(); save();
}
window.SanpoApp?.exposeCompat?.('clearAll', clearAll);
window.SanpoApp?.registerActions?.({
    'clear-all': () => clearAll()
});

function toggleLock(el) {
    if (!el) return;
    const locked = el.dataset.locked === 'true';
    const nextLocked = !locked;
    el.dataset.locked = nextLocked;
    const btn = $('.lock-btn', el);
    const label = btn?.querySelector('span:not([data-carbon-icon])');
    if (btn) btn.classList.toggle('text-warning', nextLocked);
    if (btn) window.SanpoIconAdapter?.setIcon(btn, nextLocked ? 'locked' : 'unlocked');
    if (label) label.textContent = nextLocked ? '固定中' : '固定';
    save();
}

D.addEventListener('DOMContentLoaded', () => {
    setupCarPlanSwitcherEvents();
    renderCarPlanSwitcher();
});

window.SanpoApp?.registerRenderers?.({
    restoreAppState: restore,
    captureAppState: getData
});
