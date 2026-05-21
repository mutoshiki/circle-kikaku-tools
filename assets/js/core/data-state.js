// Data/state feature
// Owns app snapshot serialization, restoration, car-plan switching, and small card state toggles.

function cloneData(value) {
    return JSON.parse(JSON.stringify(value ?? null));
}

function createCarPlanId() {
    return `plan-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
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
            ownerLabel: '班長',
            memberLabel: '班員',
            groupSuffix: '班',
            ownerIcon: 'fa-user-group'
        };
    }
    return {
        type: 'car',
        sectionTitle: '車割',
        ownerLabel: '車出し',
        memberLabel: '席',
        groupSuffix: '車',
        ownerIcon: 'fa-car'
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
        name: el.dataset.name, memo: $('.memo-popup', el).innerText,
        gender: el.dataset.gender, grade: parseInt(el.dataset.grade)||0, locked: el.dataset.locked === 'true'
    };
}

function getCurrentAllocationFromDom() {
    return {
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
        createdAt: Number(plan.createdAt || Date.now()) || Date.now(),
        updatedAt: Number(plan.updatedAt || Date.now()) || Date.now()
    };
}

function normalizeParticipantKey(value = '') {
    return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function createMemberRecord(member = {}) {
    const name = String(member.name || '').trim();
    if (!name) return null;
    return {
        name,
        memo: member.memo || member.driverMemo || '',
        gender: member.gender || member.driverGender || 'unknown',
        grade: parseInt(member.grade ?? member.driverGrade) || 0,
        locked: !!member.locked
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
        locked: Boolean(record.locked || existing.locked)
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
                locked: false
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
        locked: Boolean(record.locked || member.locked)
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

function getActiveCarPlan() {
    if (!Array.isArray(carPlans) || !carPlans.length) {
        const dom = getCurrentAllocationFromDom();
        carPlans = normalizeSingleCarPlansFromData({
            activeCarPlanId: activeCarPlanId || SINGLE_CAR_PLAN_ID,
            carPlans: [{ id: SINGLE_CAR_PLAN_ID, name: '車割', ...dom, lastAutoAssignLabel, templateType: 'car' }]
        });
    } else {
        ensureSingleCarPlans();
    }
    let plan = carPlans.find(p => p.id === activeCarPlanId);
    if (!plan) {
        activeCarPlanId = SINGLE_CAR_PLAN_ID;
        plan = carPlans.find(p => p.id === activeCarPlanId) || carPlans[0];
    }
    return plan;
}

function syncActiveCarPlanFromDom() {
    if (isRestoringCarPlans) return getActiveCarPlan();
    const plan = getActiveCarPlan();
    const dom = getCurrentAllocationFromDom();
    plan.waiting = cloneData(dom.waiting);
    plan.cars = cloneData(dom.cars);
    plan.lastAutoAssignLabel = lastAutoAssignLabel || '';
    plan.updatedAt = Date.now();
    ensureSingleCarPlans({ sourcePlan: plan, useActiveRoster: true });
    return carPlans.find(p => p.id === activeCarPlanId) || plan;
}

function getCarPlansSnapshot() {
    syncActiveCarPlanFromDom();
    ensureSingleCarPlans();
    return carPlans.map((plan, index) => normalizeCarPlan(plan, index));
}

function renderActiveCarPlanToDom() {
    const plan = getActiveCarPlan();
    isRestoringCarPlans = true;
    $('#waiting-list').innerHTML = '';
    $('#cars-container').innerHTML = '';
    (plan.waiting || []).forEach(m => addMember(m.name, m.memo, m.gender, m.grade||0, $('#waiting-list'), m.locked));
    (plan.cars || []).forEach(c => addCar(c.name, c.capacity, c.members, c.driverMemo, c.driverGender, c.driverGrade || 0));
    isRestoringCarPlans = false;
    lastAutoAssignLabel = plan.lastAutoAssignLabel || '';
    renderCarPlanSwitcher();
    updateUI();
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
            locked: !!member.locked
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
    bar.innerHTML = `
        <div class="car-plan-template-tabs" role="tablist" aria-label="車割と班割を切り替え">
            <button type="button" class="car-plan-template-chip${activeTemplateType === 'car' ? ' active' : ''}" data-car-plan-template="car" aria-pressed="${activeTemplateType === 'car' ? 'true' : 'false'}"><i class="fas fa-car-side" aria-hidden="true"></i><span>車割</span></button>
            <button type="button" class="car-plan-template-chip${activeTemplateType === 'team' ? ' active' : ''}" data-car-plan-template="team" aria-pressed="${activeTemplateType === 'team' ? 'true' : 'false'}"><i class="fas fa-user-group" aria-hidden="true"></i><span>班割</span></button>
        </div>
    `;
}

function switchCarPlan(id, { persist = true } = {}) {
    const nextId = id === SINGLE_TEAM_PLAN_ID || normalizeCarPlanTemplateType(id) === 'team' ? SINGLE_TEAM_PLAN_ID : SINGLE_CAR_PLAN_ID;
    const target = carPlans.find(plan => plan.id === nextId);
    if (!target || target.id === activeCarPlanId) return;
    syncActiveCarPlanFromDom();
    ensureSingleCarPlans({ sourcePlan: carPlans.find(plan => plan.id === activeCarPlanId), useActiveRoster: true });
    activeCarPlanId = nextId;
    const next = getActiveCarPlan();
    lastAutoAssignLabel = next.lastAutoAssignLabel || '';
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
    const active = getActiveCarPlan();
    const config = getCarPlanTemplateConfig(active);
    const nextName = await appPrompt(`${config.sectionTitle}名を入力してください`, active.name || config.sectionTitle, { title: `${config.sectionTitle}名を変更`, okText: '保存' });
    if (nextName == null) return;
    const trimmed = nextName.trim();
    if (!trimmed) return;
    active.name = trimmed;
    active.updatedAt = Date.now();
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
    syncActiveCarPlanFromDom();
    const nextType = normalizeCarPlanTemplateType(templateType);
    const nextId = getSinglePlanId(nextType);
    ensureSingleCarPlans({ sourcePlan: carPlans.find(plan => plan.id === activeCarPlanId), useActiveRoster: true });
    if (activeCarPlanId === nextId) return;
    activeCarPlanId = nextId;
    const next = getActiveCarPlan();
    lastAutoAssignLabel = next.lastAutoAssignLabel || '';
    renderActiveCarPlanToDom();
    save();
}

function setupCarPlanSwitcherEvents() {
    const bar = byId('car-plan-switcher');
    if (!bar || bar.dataset.bound === 'true') return;
    bar.dataset.bound = 'true';
    bar.addEventListener('change', event => {
        if (event.target?.id === 'carPlanSelect') switchCarPlan(event.target.value);
        if (event.target?.id === 'carPlanTemplateSelect') updateActiveCarPlanTemplate(event.target.value);
    });
    bar.addEventListener('click', event => {
        const planChip = event.target.closest('[data-car-plan-id]');
        if (planChip) {
            switchCarPlan(planChip.dataset.carPlanId);
            return;
        }
        const templateChip = event.target.closest('[data-car-plan-template]');
        if (templateChip) {
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
}

function getData() {
    const plans = getCarPlansSnapshot();
    const active = plans.find(plan => plan.id === activeCarPlanId) || plans[0];
    const snapshot = {
        schemaVersion: APP_SCHEMA_VERSION,
        roomName: $('#roomNameInput').value,
        trayMinimized: byId("bottom-tray")
                           .classList.contains("minimized"),
        editLockEnabled,
        editLockPassphrase,
        activeCarPlanId: active.id,
        carPlans: plans,
        lastAutoAssignLabel: active.lastAutoAssignLabel || '',

        waiting: cloneData(active.waiting || []),
        cars: cloneData(active.cars || []),
        settlement: getSettlementSnapshot(),
        overview: window.SanpoOverview?.getSnapshot?.() || window.SanpoApp?.state?.getSnapshot?.()?.overview || {},
        lastUpdatedAt
    };
    window.SanpoApp?.state?.setSnapshot?.(snapshot);
    return snapshot;
}

function restore(d) {
    window.SanpoApp?.state?.setSnapshot?.(d);
    lastUpdatedAt = Number(d.lastUpdatedAt || 0) || lastUpdatedAt;
    settlementState = normalizeSettlementState(d.settlement || settlementState || {});
    if (Object.prototype.hasOwnProperty.call(d, 'overview')) {
        window.SanpoOverview?.applySnapshot?.(d.overview || {});
    }
    $('#roomNameInput').value = d.roomName || '';
    editLockEnabled = !!d.editLockEnabled;
    editLockPassphrase = d.editLockPassphrase || '';
    carPlans = normalizeCarPlansFromData(d);
    const requestedActive = d.activeCarPlanId && carPlans.some(plan => plan.id === d.activeCarPlanId)
        ? d.activeCarPlanId
        : (normalizeCarPlanTemplateType((d.carPlans || []).find(plan => plan.id === d.activeCarPlanId)?.templateType) === 'team' ? SINGLE_TEAM_PLAN_ID : SINGLE_CAR_PLAN_ID);
    activeCarPlanId = requestedActive && carPlans.some(plan => plan.id === requestedActive) ? requestedActive : SINGLE_CAR_PLAN_ID;
    const active = getActiveCarPlan();
    lastAutoAssignLabel = active.lastAutoAssignLabel || d.lastAutoAssignLabel || '';
    updateLastAutoAssignCondition();
    loadTrustedEditPassphrase();
    if (editLockPassphrase && trustedEditPassphrase && trustedEditPassphrase !== editLockPassphrase) {
        rememberTrustedDevice('');
    }
    updateEditLockButton();
    refreshRoomTitle();
    const tray = byId("bottom-tray");
    if (d.trayMinimized) {
      tray.classList.add("minimized");
    } else {
      tray.classList.remove("minimized");
    }
    tray.dataset.userMinimized = d.trayMinimized ? 'true' : 'false';

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

function toggleStatus(el) {
    const g = el.dataset.gender;
    let nG = 'male';
    if (g==='male') { nG='female'; }
    else if (g==='female') { nG='unknown'; }
    else { nG='male'; }
    el.dataset.gender = nG;
    updatePersonGenderBadge(el);
    save();
}

function toggleLock(el) {
    if (!el) return;
    const locked = el.dataset.locked === 'true';
    const nextLocked = !locked;
    el.dataset.locked = nextLocked;
    const btn = $('.lock-btn', el);
    const icon = btn?.querySelector('i');
    const label = btn?.querySelector('span');
    if (btn) btn.classList.toggle('text-warning', nextLocked);
    if (icon) icon.className = `fas ${nextLocked ? 'fa-lock' : 'fa-unlock'}`;
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
