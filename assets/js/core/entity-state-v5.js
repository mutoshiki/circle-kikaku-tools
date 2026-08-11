// Canonical room state (Schema v5).
// Participants are the single source of truth. Allocation surfaces only reference participant ids.
// UI-oriented waiting/cars/carPlans shapes are projections and are never persisted remotely.

const CANONICAL_SCHEMA_VERSION = 5;
const ALLOCATION_TYPES = Object.freeze(['car', 'team']);
let canonicalRoomState = null;

function cloneCanonical(value) {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
}

function canonicalNow() {
    return window.SanpoClock?.now?.() ?? Date.now();
}

function normalizeCanonicalName(value = '') {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function canonicalNameKey(value = '') {
    return normalizeCanonicalName(value).toLowerCase();
}

function makeCanonicalSettlementExtraId(scope = '', index = 0, extra = {}, used = new Set()) {
    const fingerprint = JSON.stringify({
        name: String(extra?.name ?? ''),
        amount: String(extra?.amount ?? ''),
        type: String(extra?.type ?? ''),
        timesFeeKind: String(extra?.timesFeeKind ?? '')
    });
    const base = `x_${hashCanonicalString(`${scope}:${index}:${fingerprint}`)}`;
    let id = base;
    let suffix = 2;
    while (used.has(id)) id = `${base}_${suffix++}`;
    used.add(id);
    return id;
}

function normalizeCanonicalSettlementCar(raw = {}, scope = '') {
    const car = cloneCanonical(raw || {}) || {};
    if (!Array.isArray(car.extras)) return car;
    const used = new Set();
    car.extras = car.extras.map((extra, index) => {
        const next = cloneCanonical(extra || {}) || {};
        const preferred = String(next.id || '').trim();
        next.id = preferred && !used.has(preferred)
            ? (used.add(preferred), preferred)
            : makeCanonicalSettlementExtraId(scope, index, next, used);
        return next;
    });
    return car;
}

function normalizeCanonicalFlag(value = 'none') {
    return ['blue', 'purple', 'yellow', 'red'].includes(value) ? value : 'none';
}

function hashCanonicalString(value = '') {
    // FNV-1a 32-bit. Stable across devices and does not expose the participant name in Firebase keys.
    let hash = 0x811c9dc5;
    const input = String(value || '');
    for (let i = 0; i < input.length; i += 1) {
        hash ^= input.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(36);
}

function makeCanonicalParticipantId(name, existing = {}) {
    const key = canonicalNameKey(name) || `participant-${canonicalNow()}`;
    const base = `p_${hashCanonicalString(key)}`;
    if (!existing[base] || canonicalNameKey(existing[base]?.name) === key) return base;
    let index = 2;
    while (existing[`${base}_${index}`] && canonicalNameKey(existing[`${base}_${index}`]?.name) !== key) index += 1;
    return `${base}_${index}`;
}

function makeCanonicalGroupId(type, ownerId, existing = {}) {
    const normalizedType = type === 'team' ? 'team' : 'car';
    const base = `g_${normalizedType}_${String(ownerId || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    if (!existing[base]) return base;
    let index = 2;
    while (existing[`${base}_${index}`]) index += 1;
    return `${base}_${index}`;
}

function normalizeCanonicalParticipant(raw = {}, id = '') {
    const name = normalizeCanonicalName(raw.name || '');
    if (!name) return null;
    const participantId = String(raw.id || id || '').trim();
    return {
        id: participantId,
        name,
        memo: String(raw.memo ?? raw.driverMemo ?? ''),
        gender: ['male', 'female', 'unknown'].includes(raw.gender || raw.driverGender) ? (raw.gender || raw.driverGender) : 'unknown',
        grade: Math.max(0, Math.min(4, parseInt(raw.grade ?? raw.driverGrade) || 0)),
        locked: raw.locked === true,
        flag: normalizeCanonicalFlag(raw.flag ?? raw.driverFlag),
        updatedAt: Number(raw.updatedAt || canonicalNow()) || canonicalNow()
    };
}

function participantRecordFromLegacy(raw = {}) {
    return normalizeCanonicalParticipant({
        name: raw.name,
        memo: raw.memo ?? raw.driverMemo ?? '',
        gender: raw.gender ?? raw.driverGender ?? 'unknown',
        grade: raw.grade ?? raw.driverGrade ?? 0,
        locked: raw.locked === true,
        flag: raw.flag ?? raw.driverFlag ?? 'none'
    });
}

function mergeParticipantRecord(existing = null, incoming = null, id = '') {
    if (!incoming) return existing;
    if (!existing) return { ...incoming, id: id || incoming.id };
    const next = { ...existing };
    next.id = id || incoming.id || existing.id;
    next.name = incoming.name || existing.name;
    if (incoming.memo) next.memo = incoming.memo;
    if (incoming.gender && incoming.gender !== 'unknown') next.gender = incoming.gender;
    if (incoming.grade) next.grade = incoming.grade;
    next.locked = Boolean(incoming.locked || existing.locked);
    if (incoming.flag && incoming.flag !== 'none') next.flag = incoming.flag;
    next.updatedAt = Math.max(Number(existing.updatedAt || 0), Number(incoming.updatedAt || 0), canonicalNow());
    return next;
}

function emptyCanonicalAllocation(type = 'car') {
    const normalizedType = type === 'team' ? 'team' : 'car';
    return {
        id: normalizedType === 'team' ? 'plan-team' : 'plan-car',
        type: normalizedType,
        name: normalizedType === 'team' ? '班割' : '車割',
        groups: {},
        placements: {},
        lastAutoAssignLabel: '',
        updatedAt: canonicalNow()
    };
}

function emptyCanonicalRoom() {
    return {
        schemaVersion: CANONICAL_SCHEMA_VERSION,
        roomName: '',
        participants: {},
        participantTombstones: {},
        allocations: {
            car: emptyCanonicalAllocation('car'),
            team: emptyCanonicalAllocation('team')
        },
        activeAllocationType: 'car',
        trayMinimized: false,
        editLockEnabled: false,
        editLockPassphrase: '',
        editLockScopes: { allocation: false, settlement: false },
        settlement: {},
        overview: {},
        meta: {},
        lastUpdatedAt: 0,
        lastUpdatedBy: '',
        revision: 0
    };
}

function findCanonicalParticipantIdByName(participants = {}, name = '') {
    const key = canonicalNameKey(name);
    if (!key) return '';
    return Object.keys(participants).find(id => canonicalNameKey(participants[id]?.name) === key) || '';
}

function ensureCanonicalParticipant(participants, raw = {}, preferredId = '', tombstones = {}) {
    const record = participantRecordFromLegacy(raw);
    if (!record) return '';
    const existingId = preferredId && participants[preferredId] && !tombstones?.[preferredId]
        ? preferredId
        : findCanonicalParticipantIdByName(participants, record.name);
    const reserved = { ...(participants || {}) };
    Object.keys(tombstones || {}).forEach(id => {
        if (!reserved[id]) reserved[id] = { name: '__deleted__' };
    });
    const safePreferred = preferredId && !tombstones?.[preferredId] ? preferredId : '';
    const id = existingId || safePreferred || makeCanonicalParticipantId(record.name, reserved);
    participants[id] = mergeParticipantRecord(participants[id], { ...record, id }, id);
    return id;
}

function normalizeLegacyPlanType(plan = {}, fallback = 'car') {
    const raw = String(plan.templateType || plan.template || plan.kind || fallback || 'car').toLowerCase();
    return ['team', 'group', 'han', '班', '班割'].includes(raw) ? 'team' : 'car';
}

function getLegacyPlansForMigration(data = {}) {
    const sourcePlans = Array.isArray(data.carPlans) ? data.carPlans : [];
    const result = [];
    if (sourcePlans.length) {
        sourcePlans.forEach((plan, index) => result.push({ ...cloneCanonical(plan), _index: index }));
    } else {
        result.push({
            id: data.activeCarPlanId || 'plan-car',
            name: '車割',
            templateType: 'car',
            waiting: Array.isArray(data.waiting) ? data.waiting : [],
            cars: Array.isArray(data.cars) ? data.cars : [],
            lastAutoAssignLabel: data.lastAutoAssignLabel || ''
        });
    }
    return result;
}

function migrateLegacyPlanIntoAllocation(plan, allocation, participants) {
    const type = allocation.type;
    allocation.name = normalizeCanonicalName(plan.name || plan.label) || allocation.name;
    allocation.lastAutoAssignLabel = String(plan.lastAutoAssignLabel || allocation.lastAutoAssignLabel || '');
    allocation.groups = {};
    allocation.placements = {};
    let waitingOrder = 0;

    (Array.isArray(plan.cars) ? plan.cars : []).forEach((group, groupIndex) => {
        const ownerId = ensureCanonicalParticipant(participants, {
            name: group?.name,
            memo: group?.driverMemo || '',
            gender: group?.driverGender || 'unknown',
            grade: group?.driverGrade || 0,
            flag: group?.driverFlag || 'none'
        });
        if (!ownerId) return;
        const groupId = makeCanonicalGroupId(type, ownerId, allocation.groups);
        allocation.groups[groupId] = {
            id: groupId,
            ownerId,
            capacity: Math.max(1, parseInt(group?.capacity) || (type === 'team' ? 5 : 3)),
            order: groupIndex,
            updatedAt: canonicalNow()
        };
        allocation.placements[ownerId] = { kind: 'driver', groupId, order: groupIndex, updatedAt: canonicalNow() };
        (Array.isArray(group?.members) ? group.members : []).forEach((member, memberIndex) => {
            const memberId = ensureCanonicalParticipant(participants, member || {});
            if (!memberId || allocation.placements[memberId]) return;
            allocation.placements[memberId] = { kind: 'member', groupId, order: memberIndex, updatedAt: canonicalNow() };
        });
    });

    (Array.isArray(plan.waiting) ? plan.waiting : []).forEach(member => {
        const id = ensureCanonicalParticipant(participants, member || {});
        if (!id || allocation.placements[id]) return;
        allocation.placements[id] = { kind: 'waiting', groupId: '', order: waitingOrder++, updatedAt: canonicalNow() };
    });
}

function ensureAllParticipantsPlaced(allocation, participants) {
    const validParticipantIds = new Set(Object.keys(participants || {}));
    Object.keys(allocation.placements || {}).forEach(id => {
        if (!validParticipantIds.has(id)) delete allocation.placements[id];
    });
    Object.keys(allocation.groups || {}).forEach(groupId => {
        const group = allocation.groups[groupId];
        if (!group || !validParticipantIds.has(group.ownerId)) {
            delete allocation.groups[groupId];
            return;
        }
        // A persisted group and its owner placement form one logical allocation entity.
        // Concurrent clients may write these two Firebase paths in opposite orders
        // (for example: one device deletes an old car while another promotes one of
        // its members to a new driver). If the group still exists after merging, its
        // owner must be its driver; otherwise the room can contain a car whose driver
        // is simultaneously marked waiting/member. Removing a car deletes the group,
        // so an extant group is authoritative for this invariant.
        const ownerPlacement = allocation.placements?.[group.ownerId];
        if (!ownerPlacement || ownerPlacement.kind !== 'driver' || ownerPlacement.groupId !== groupId) {
            allocation.placements[group.ownerId] = {
                kind: 'driver',
                groupId,
                order: Number(group.order) || 0,
                updatedAt: Math.max(Number(group.updatedAt || 0), Number(ownerPlacement?.updatedAt || 0), canonicalNow())
            };
        }
    });
    Object.entries(allocation.placements || {}).forEach(([id, placement]) => {
        if (placement?.kind !== 'driver' && placement?.kind !== 'member') return;
        if (!allocation.groups?.[placement.groupId]) {
            allocation.placements[id] = { kind: 'waiting', groupId: '', order: Number.MAX_SAFE_INTEGER, updatedAt: canonicalNow() };
        }
    });

    // Capacity is a room invariant, not just a UI check. Two phones can both see the
    // final free seat and commit different members. Keep the earliest accepted placements
    // and deterministically return overflow members to waiting so every client converges.
    Object.entries(allocation.groups || {}).forEach(([groupId, group]) => {
        const capacity = Math.max(1, parseInt(group?.capacity) || (allocation.type === 'team' ? 5 : 3));
        const members = Object.entries(allocation.placements || {})
            .filter(([, placement]) => placement?.kind === 'member' && placement.groupId === groupId)
            .sort(([idA, a], [idB, b]) => {
                const timeDiff = (Number(a?.updatedAt) || 0) - (Number(b?.updatedAt) || 0);
                if (timeDiff) return timeDiff;
                const orderDiff = (Number(a?.order) || 0) - (Number(b?.order) || 0);
                return orderDiff || String(idA).localeCompare(String(idB));
            });
        members.slice(capacity).forEach(([id, placement]) => {
            allocation.placements[id] = {
                kind: 'waiting',
                groupId: '',
                order: Number.MAX_SAFE_INTEGER,
                updatedAt: Math.max(Number(placement?.updatedAt || 0), canonicalNow())
            };
        });
    });

    let order = Object.values(allocation.placements || {})
        .filter(p => p?.kind === 'waiting')
        .reduce((max, p) => Math.max(max, Number(p.order) || 0), -1) + 1;
    Object.keys(participants || {}).forEach(id => {
        if (!allocation.placements[id]) {
            allocation.placements[id] = { kind: 'waiting', groupId: '', order: order++, updatedAt: canonicalNow() };
        }
    });
}

function migrateToCanonicalRoom(raw = {}) {
    // Realtime Database omits empty objects. A valid v5 room with zero participants
    // therefore has no `participants` property, and empty group/placement maps are
    // absent too. Schema + allocation roots are the canonical marker.
    if (raw && Number(raw.schemaVersion) >= CANONICAL_SCHEMA_VERSION && raw.allocations) {
        const canonical = { ...emptyCanonicalRoom(), ...cloneCanonical(raw) };
        canonical.schemaVersion = CANONICAL_SCHEMA_VERSION;
        canonical.participants = {};
        canonical.participantTombstones = cloneCanonical(raw.participantTombstones || {}) || {};
        Object.entries(raw.participants || {}).forEach(([id, participant]) => {
            if (canonical.participantTombstones[id]) return;
            const normalized = normalizeCanonicalParticipant(participant, id);
            if (normalized) canonical.participants[id] = normalized;
        });
        canonical.allocations = {
            car: { ...emptyCanonicalAllocation('car'), ...(cloneCanonical(raw.allocations?.car) || {}) },
            team: { ...emptyCanonicalAllocation('team'), ...(cloneCanonical(raw.allocations?.team) || {}) }
        };
        ALLOCATION_TYPES.forEach(type => {
            canonical.allocations[type].type = type;
            canonical.allocations[type].groups = cloneCanonical(canonical.allocations[type].groups || {});
            canonical.allocations[type].placements = cloneCanonical(canonical.allocations[type].placements || {});
            ensureAllParticipantsPlaced(canonical.allocations[type], canonical.participants);
        });
        canonical.activeAllocationType = raw.activeAllocationType === 'team' ? 'team' : 'car';
        canonical.settlement = normalizeCanonicalSettlement(raw.settlement || {}, canonical.participants);
        return canonical;
    }

    const canonical = emptyCanonicalRoom();
    canonical.roomName = String(raw.roomName || '');
    canonical.trayMinimized = raw.trayMinimized === true;
    canonical.editLockEnabled = raw.editLockEnabled === true;
    canonical.editLockPassphrase = String(raw.editLockPassphrase || '');
    canonical.editLockScopes = raw.editLockScopes && typeof raw.editLockScopes === 'object'
        ? { allocation: !!raw.editLockScopes.allocation, settlement: !!raw.editLockScopes.settlement }
        : { allocation: !!raw.editLockEnabled, settlement: !!raw.editLockEnabled };
    canonical.overview = cloneCanonical(raw.overview || {});
    canonical.meta = { ...(cloneCanonical(raw.meta || {}) || {}), migratedFrom: Number(raw.schemaVersion || 1), migratedAt: new Date().toISOString() };
    canonical.lastUpdatedAt = Number(raw.lastUpdatedAt || 0);
    canonical.lastUpdatedBy = String(raw.lastUpdatedBy || '');
    canonical.revision = Number(raw.revision || 0);

    const plans = getLegacyPlansForMigration(raw);
    const sourceByType = { car: null, team: null };
    plans.forEach(plan => {
        const type = normalizeLegacyPlanType(plan, 'car');
        if (!sourceByType[type]) sourceByType[type] = plan;
        if (String(plan.id || '') === String(raw.activeCarPlanId || '')) sourceByType[type] = plan;
    });
    if (!sourceByType.car) sourceByType.car = { name: '車割', templateType: 'car', waiting: raw.waiting || [], cars: raw.cars || [] };
    if (!sourceByType.team) sourceByType.team = { name: '班割', templateType: 'team', waiting: [], cars: [] };

    migrateLegacyPlanIntoAllocation(sourceByType.car, canonical.allocations.car, canonical.participants);
    migrateLegacyPlanIntoAllocation(sourceByType.team, canonical.allocations.team, canonical.participants);
    ALLOCATION_TYPES.forEach(type => ensureAllParticipantsPlaced(canonical.allocations[type], canonical.participants));

    const activeLegacyPlan = plans.find(plan => String(plan.id || '') === String(raw.activeCarPlanId || ''));
    canonical.activeAllocationType = normalizeLegacyPlanType(activeLegacyPlan || sourceByType.car, 'car');
    canonical.settlement = canonicalizeSettlementForStorage(raw.settlement || {}, canonical.participants);
    return canonical;
}

function projectCanonicalAllocation(room = canonicalRoomState, type = room?.activeAllocationType || 'car') {
    const canonical = room || emptyCanonicalRoom();
    const participants = canonical.participants || {};
    const allocation = canonical.allocations?.[type] || emptyCanonicalAllocation(type);
    const groups = Object.values(allocation.groups || {})
        .filter(group => group && participants[group.ownerId])
        .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));

    const cars = groups.map(group => {
        const driver = participants[group.ownerId];
        const members = Object.entries(allocation.placements || {})
            .filter(([id, placement]) => id !== group.ownerId && participants[id] && placement?.kind === 'member' && placement.groupId === group.id)
            .sort((a, b) => (Number(a[1].order) || 0) - (Number(b[1].order) || 0))
            .map(([id]) => ({ ...cloneCanonical(participants[id]), participantId: id }));
        return {
            name: driver.name,
            participantId: group.ownerId,
            groupId: group.id,
            capacity: group.capacity,
            driverMemo: driver.memo || '',
            driverGender: driver.gender || 'unknown',
            driverGrade: driver.grade || 0,
            driverFlag: driver.flag || 'none',
            members
        };
    });

    const used = new Set();
    cars.forEach(car => {
        used.add(car.participantId);
        car.members.forEach(member => used.add(member.participantId));
    });
    const waiting = Object.entries(allocation.placements || {})
        .filter(([id, placement]) => participants[id] && !used.has(id) && placement?.kind === 'waiting')
        .sort((a, b) => (Number(a[1].order) || 0) - (Number(b[1].order) || 0))
        .map(([id]) => ({ ...cloneCanonical(participants[id]), participantId: id }));

    Object.keys(participants).forEach(id => {
        if (!used.has(id) && !waiting.some(member => member.participantId === id)) {
            waiting.push({ ...cloneCanonical(participants[id]), participantId: id });
        }
    });

    return {
        id: type === 'team' ? 'plan-team' : 'plan-car',
        name: allocation.name || (type === 'team' ? '班割' : '車割'),
        templateType: type,
        waiting,
        cars,
        lastAutoAssignLabel: String(allocation.lastAutoAssignLabel || ''),
        createdAt: Number(allocation.createdAt || canonicalNow()),
        updatedAt: Number(allocation.updatedAt || canonicalNow())
    };
}

function projectCanonicalCarPlans(room = canonicalRoomState) {
    return [projectCanonicalAllocation(room, 'car'), projectCanonicalAllocation(room, 'team')];
}

function participantFromDomRecord(record = {}, fallback = {}) {
    return normalizeCanonicalParticipant({
        name: record.name || fallback.name,
        memo: record.memo ?? fallback.memo ?? '',
        gender: record.gender ?? fallback.gender ?? 'unknown',
        grade: record.grade ?? fallback.grade ?? 0,
        locked: record.locked ?? fallback.locked ?? false,
        flag: record.flag ?? fallback.flag ?? 'none'
    });
}

function reconcileSettlementParticipantNames(room, oldParticipants = {}) {
    if (!room) return;
    // Storage is id-keyed, so a rename needs no key migration. Remove entities whose participant was deleted.
    const settlement = normalizeCanonicalSettlement(room.settlement || {}, room.participants || {});
    const ids = new Set(Object.keys(room.participants || {}));
    ['carsByParticipantId', 'paidByParticipantId', 'paidCollectorByParticipantId', 'driverPaidByParticipantId'].forEach(field => {
        const map = settlement[field] || {};
        Object.keys(map).forEach(id => { if (!ids.has(id)) delete map[id]; });
    });
    if (settlement.organizerParticipantId && !ids.has(settlement.organizerParticipantId)) {
        settlement.organizerParticipantId = '';
    }
    room.settlement = settlement;
}

function updateCanonicalFromActiveDom(room, domAllocation, activeType = room?.activeAllocationType || 'car') {
    const canonical = room || emptyCanonicalRoom();
    const previousRoomUpdatedAt = Number(canonical.lastUpdatedAt || 0);
    const oldParticipants = cloneCanonical(canonical.participants || {});
    const participants = canonical.participants || (canonical.participants = {});
    const tombstones = canonical.participantTombstones || (canonical.participantTombstones = {});
    const allocation = canonical.allocations?.[activeType] || emptyCanonicalAllocation(activeType);
    if (!canonical.allocations) canonical.allocations = { car: emptyCanonicalAllocation('car'), team: emptyCanonicalAllocation('team') };
    canonical.allocations[activeType] = allocation;

    const previousGroups = cloneCanonical(allocation.groups || {}) || {};
    const previousPlacements = cloneCanonical(allocation.placements || {}) || {};
    const previousAllocationUpdatedAt = Number(allocation.updatedAt || 0);
    const newGroups = {};
    const newPlacements = {};
    const existingNameIndex = new Map(Object.entries(participants).map(([id, p]) => [canonicalNameKey(p.name), id]));
    const participantFields = ['name', 'memo', 'gender', 'grade', 'locked', 'flag'];
    const participantEqual = (a, b) => !!a && !!b && participantFields.every(field => {
        if (field === 'grade') return Number(a[field] || 0) === Number(b[field] || 0);
        if (field === 'locked') return !!a[field] === !!b[field];
        return String(a[field] ?? '') === String(b[field] ?? '');
    });
    const placementEqual = (a, b) => !!a && !!b
        && String(a.kind || '') === String(b.kind || '')
        && String(a.groupId || '') === String(b.groupId || '')
        && Number(a.order || 0) === Number(b.order || 0);
    const groupEqual = (a, b) => !!a && !!b
        && String(a.ownerId || '') === String(b.ownerId || '')
        && Number(a.capacity || 0) === Number(b.capacity || 0)
        && Number(a.order || 0) === Number(b.order || 0);
    const entityMapEqual = (a = {}, b = {}, recordEqual) => {
        const aKeys = Object.keys(a || {}).sort();
        const bKeys = Object.keys(b || {}).sort();
        return aKeys.length === bKeys.length
            && aKeys.every((key, index) => key === bKeys[index] && recordEqual(a[key], b[key]));
    };

    const resolveId = raw => {
        const preferred = String(raw?.participantId || raw?.id || '').trim();
        const name = normalizeCanonicalName(raw?.name || '');
        // An explicit ID on a DOM card is identity, not a suggestion. If that ID
        // has a tombstone this is a stale projection left behind by an interrupted
        // render. Never mint a new participant from it under a suffix ID.
        if (preferred && tombstones[preferred]) return '';
        let id = preferred && participants[preferred] && !tombstones[preferred]
            ? preferred
            : existingNameIndex.get(canonicalNameKey(name));
        if (id && tombstones[id]) id = '';
        if (!id) {
            const reserved = { ...participants };
            Object.keys(tombstones).forEach(tombstoneId => {
                if (!reserved[tombstoneId]) reserved[tombstoneId] = { name: '__deleted__' };
            });
            id = (preferred && !tombstones[preferred]) ? preferred : makeCanonicalParticipantId(name, reserved);
        }
        const next = participantFromDomRecord(raw, participants[id]);
        if (!next) return '';
        const previous = participants[id];
        participants[id] = participantEqual(previous, next)
            ? { ...previous, id }
            : { ...next, id, updatedAt: canonicalNow() };
        existingNameIndex.set(canonicalNameKey(participants[id].name), id);
        return id;
    };

    const setPlacement = (id, shape) => {
        const previous = allocation.placements?.[id];
        newPlacements[id] = placementEqual(previous, shape)
            ? { ...previous, kind: shape.kind, groupId: shape.groupId, order: shape.order }
            : { ...shape, updatedAt: canonicalNow() };
    };

    (Array.isArray(domAllocation?.cars) ? domAllocation.cars : []).forEach((car, groupIndex) => {
        const ownerId = resolveId({
            participantId: car.participantId,
            name: car.name,
            memo: car.driverMemo,
            gender: car.driverGender,
            grade: car.driverGrade,
            flag: car.driverFlag,
            locked: false
        });
        if (!ownerId) return;
        let groupId = String(car.groupId || '').trim();
        if (!groupId || newGroups[groupId]) groupId = makeCanonicalGroupId(activeType, ownerId, { ...(allocation.groups || {}), ...newGroups });
        const previousGroup = allocation.groups?.[groupId] || {};
        const groupShape = {
            id: groupId,
            ownerId,
            capacity: Math.max(1, parseInt(car.capacity) || (activeType === 'team' ? 5 : 3)),
            order: groupIndex
        };
        newGroups[groupId] = groupEqual(previousGroup, groupShape)
            ? { ...previousGroup, ...groupShape, createdAt: Number(previousGroup.createdAt || canonicalNow()) }
            : { ...groupShape, updatedAt: canonicalNow(), createdAt: Number(previousGroup.createdAt || canonicalNow()) };
        setPlacement(ownerId, { kind: 'driver', groupId, order: groupIndex });
        (Array.isArray(car.members) ? car.members : []).forEach((member, memberIndex) => {
            const id = resolveId(member || {});
            if (!id || newPlacements[id]) return;
            setPlacement(id, { kind: 'member', groupId, order: memberIndex });
        });
    });

    (Array.isArray(domAllocation?.waiting) ? domAllocation.waiting : []).forEach((member, waitingIndex) => {
        const id = resolveId(member || {});
        if (!id || newPlacements[id]) return;
        setPlacement(id, { kind: 'waiting', groupId: '', order: waitingIndex });
    });

    // DOM is a projection, never the participant master. A card can be temporarily absent
    // during drag, Carbon modal editing, remote repaint, or a partial mobile render. Absence
    // must therefore NEVER mean deletion. Deletion is an explicit canonical mutation which
    // creates a participant tombstone.
    allocation.groups = newGroups;
    allocation.placements = newPlacements;
    ensureAllParticipantsPlaced(allocation, participants);

    ALLOCATION_TYPES.filter(type => type !== activeType).forEach(type => {
        const other = canonical.allocations[type] || emptyCanonicalAllocation(type);
        canonical.allocations[type] = other;
        ensureAllParticipantsPlaced(other, participants);
    });

    // A generic save (for example settlement settings) must not rewrite every participant,
    // group and placement just because getData() sampled the DOM. Preserve entity timestamps
    // unless semantic content actually changed so Firebase patches stay narrowly scoped.
    // Maps are rebuilt in visual order. JSON string comparison made key insertion order look
    // like a collaborative edit, causing every unrelated save to rewrite allocation timestamps.
    const allocationChanged = !entityMapEqual(previousPlacements, allocation.placements || {}, placementEqual)
        || !entityMapEqual(previousGroups, allocation.groups || {}, groupEqual);
    const participantsChanged = !entityMapEqual(oldParticipants, participants, participantEqual);
    allocation.updatedAt = allocationChanged ? canonicalNow() : previousAllocationUpdatedAt;

    reconcileSettlementParticipantNames(canonical, oldParticipants);
    canonical.schemaVersion = CANONICAL_SCHEMA_VERSION;
    canonical.activeAllocationType = activeType;
    canonical.lastUpdatedAt = (allocationChanged || participantsChanged)
        ? canonicalNow()
        : previousRoomUpdatedAt;
    return canonical;
}

function resolveParticipantIdForSettlement(participants = {}, name = '') {
    return findCanonicalParticipantIdByName(participants, name);
}

function canonicalizeSettlementForStorage(uiState = {}, participants = {}) {
    const source = cloneCanonical(uiState || {}) || {};
    if (source.carsByParticipantId || source.paidByParticipantId || source.driverPaidByParticipantId) {
        return normalizeCanonicalSettlement(source, participants);
    }
    const next = { ...source };
    const carsByParticipantId = {};
    const carsByName = {};
    Object.entries(source.cars || {}).forEach(([name, value]) => {
        const id = resolveParticipantIdForSettlement(participants, name);
        if (id) carsByParticipantId[id] = cloneCanonical(value);
        else carsByName[name] = cloneCanonical(value);
    });
    const mapNamesToIds = sourceMap => {
        const byId = {};
        const byName = {};
        Object.entries(sourceMap || {}).forEach(([name, value]) => {
            const id = resolveParticipantIdForSettlement(participants, name);
            if (id) byId[id] = cloneCanonical(value);
            else byName[name] = cloneCanonical(value);
        });
        return { byId, byName };
    };
    const paid = mapNamesToIds(source.paid);
    const paidBy = mapNamesToIds(source.paidBy);
    const driverPaid = mapNamesToIds(source.driverPaid);
    next.carsByParticipantId = carsByParticipantId;
    next.carsByName = carsByName;
    next.paidByParticipantId = paid.byId;
    next.paidByName = paid.byName;
    next.paidCollectorByParticipantId = paidBy.byId;
    next.paidCollectorByName = paidBy.byName;
    next.driverPaidByParticipantId = driverPaid.byId;
    next.driverPaidByName = driverPaid.byName;
    const organizerId = resolveParticipantIdForSettlement(participants, source.organizerName || '');
    if (organizerId) {
        next.organizerParticipantId = organizerId;
        next.organizerNameFallback = '';
    } else {
        next.organizerParticipantId = '';
        next.organizerNameFallback = String(source.organizerName || '');
    }
    delete next.cars;
    delete next.paid;
    delete next.paidBy;
    delete next.driverPaid;
    delete next.organizerName;
    return normalizeCanonicalSettlement(next, participants);
}

function normalizeCanonicalSettlement(raw = {}, participants = {}) {
    const source = cloneCanonical(raw || {}) || {};
    if (!source.carsByParticipantId && source.cars) return canonicalizeSettlementForStorage(source, participants);
    source.carsByParticipantId = cloneCanonical(source.carsByParticipantId || {});
    source.carsByName = cloneCanonical(source.carsByName || {});
    source.paidByParticipantId = cloneCanonical(source.paidByParticipantId || {});
    source.paidByName = cloneCanonical(source.paidByName || {});
    source.paidCollectorByParticipantId = cloneCanonical(source.paidCollectorByParticipantId || {});
    source.paidCollectorByName = cloneCanonical(source.paidCollectorByName || {});
    source.driverPaidByParticipantId = cloneCanonical(source.driverPaidByParticipantId || {});
    source.driverPaidByName = cloneCanonical(source.driverPaidByName || {});

    Object.entries(source.carsByParticipantId).forEach(([id, car]) => {
        source.carsByParticipantId[id] = normalizeCanonicalSettlementCar(car, `participant:${id}`);
    });
    Object.entries(source.carsByName).forEach(([name, car]) => {
        source.carsByName[name] = normalizeCanonicalSettlementCar(car, `name:${name}`);
    });

    // ID-keyed settlement entries are dependent entities of participants. A stale
    // device can finish a settlement edit after another device deleted that person;
    // the Firebase paths are disjoint, so the stale write may arrive later. Prune
    // every orphan on every canonicalization so deleted participants cannot leave
    // hidden settlement state behind or become visible again through future code.
    const validIds = new Set(Object.keys(participants || {}));
    ['carsByParticipantId', 'paidByParticipantId', 'paidCollectorByParticipantId', 'driverPaidByParticipantId'].forEach(field => {
        Object.keys(source[field] || {}).forEach(id => {
            if (!validIds.has(id)) delete source[field][id];
        });
    });
    if (source.organizerParticipantId && !validIds.has(source.organizerParticipantId)) source.organizerParticipantId = '';
    return source;
}

function materializeSettlementForUi(storageState = {}, participants = {}) {
    const source = normalizeCanonicalSettlement(storageState || {}, participants);
    const next = cloneCanonical(source) || {};
    const names = participants || {};
    const materializeMap = (byId = {}, byName = {}) => {
        const result = cloneCanonical(byName || {}) || {};
        Object.entries(byId || {}).forEach(([id, value]) => {
            const name = names[id]?.name;
            if (name) result[name] = cloneCanonical(value);
        });
        return result;
    };
    next.cars = materializeMap(source.carsByParticipantId, source.carsByName);
    next.paid = materializeMap(source.paidByParticipantId, source.paidByName);
    next.paidBy = materializeMap(source.paidCollectorByParticipantId, source.paidCollectorByName);
    next.driverPaid = materializeMap(source.driverPaidByParticipantId, source.driverPaidByName);
    next.organizerName = source.organizerParticipantId && names[source.organizerParticipantId]
        ? names[source.organizerParticipantId].name
        : String(source.organizerNameFallback || '');
    ['carsByParticipantId', 'carsByName', 'paidByParticipantId', 'paidByName', 'paidCollectorByParticipantId', 'paidCollectorByName', 'driverPaidByParticipantId', 'driverPaidByName', 'organizerParticipantId', 'organizerNameFallback']
        .forEach(key => delete next[key]);
    return next;
}

function setCanonicalSettlementFromUi(uiState) {
    if (!canonicalRoomState) canonicalRoomState = emptyCanonicalRoom();
    canonicalRoomState.settlement = canonicalizeSettlementForStorage(uiState || {}, canonicalRoomState.participants || {});
    return canonicalRoomState.settlement;
}

function getCanonicalRoomState() {
    return canonicalRoomState;
}

function setCanonicalRoomState(raw) {
    canonicalRoomState = migrateToCanonicalRoom(raw || {});
    return canonicalRoomState;
}

function createCanonicalSnapshotFromUi({ roomName = '', trayMinimized = false, editLockEnabled = false, editLockPassphrase = '', editLockScopes = {}, settlement = {}, overview = {}, activeType = 'car', domAllocation = null, lastAutoAssignLabel = '' } = {}) {
    if (!canonicalRoomState) canonicalRoomState = emptyCanonicalRoom();
    canonicalRoomState.roomName = String(roomName || '');
    canonicalRoomState.trayMinimized = !!trayMinimized;
    canonicalRoomState.editLockEnabled = !!editLockEnabled;
    canonicalRoomState.editLockPassphrase = String(editLockPassphrase || '');
    canonicalRoomState.editLockScopes = { allocation: !!editLockScopes.allocation, settlement: !!editLockScopes.settlement };
    canonicalRoomState.overview = cloneCanonical(overview || {});
    canonicalRoomState.activeAllocationType = activeType === 'team' ? 'team' : 'car';
    if (domAllocation) updateCanonicalFromActiveDom(canonicalRoomState, domAllocation, canonicalRoomState.activeAllocationType);
    const activeAllocation = canonicalRoomState.allocations[canonicalRoomState.activeAllocationType];
    if (activeAllocation) activeAllocation.lastAutoAssignLabel = String(lastAutoAssignLabel || activeAllocation.lastAutoAssignLabel || '');
    canonicalRoomState.settlement = canonicalizeSettlementForStorage(settlement || {}, canonicalRoomState.participants || {});
    canonicalRoomState.schemaVersion = CANONICAL_SCHEMA_VERSION;
    canonicalRoomState.lastUpdatedAt = canonicalNow();
    return cloneCanonical(canonicalRoomState);
}


function applyProjectedPlanToCanonical(room, plan = {}, type = 'car') {
    const canonical = room || canonicalRoomState || emptyCanonicalRoom();
    const normalizedType = type === 'team' ? 'team' : 'car';
    const allocation = canonical.allocations?.[normalizedType] || emptyCanonicalAllocation(normalizedType);
    if (!canonical.allocations) canonical.allocations = { car: emptyCanonicalAllocation('car'), team: emptyCanonicalAllocation('team') };
    canonical.allocations[normalizedType] = allocation;
    allocation.name = normalizeCanonicalName(plan.name || allocation.name) || allocation.name;
    allocation.lastAutoAssignLabel = String(plan.lastAutoAssignLabel || allocation.lastAutoAssignLabel || '');
    const nextGroups = {};
    const nextPlacements = {};
    const resolve = raw => {
        const preferred = String(raw?.participantId || raw?.id || '').trim();
        const name = normalizeCanonicalName(raw?.name || '');
        const tombstones = canonical.participantTombstones || (canonical.participantTombstones = {});
        // A projected plan carrying a deleted explicit participant ID is stale.
        // Skipping it is required so an old phone cannot resurrect the person as
        // a newly generated participant after a tombstone has already won.
        if (preferred && tombstones[preferred]) return '';
        let id = preferred && canonical.participants?.[preferred] && !tombstones[preferred]
            ? preferred
            : findCanonicalParticipantIdByName(canonical.participants || {}, name);
        if (id && tombstones[id]) id = '';
        if (!id) {
            const record = participantRecordFromLegacy(raw || {});
            if (!record) return '';
            const reserved = { ...(canonical.participants || {}) };
            Object.keys(tombstones).forEach(tombstoneId => { if (!reserved[tombstoneId]) reserved[tombstoneId] = { name: '__deleted__' }; });
            id = (preferred && !tombstones[preferred]) ? preferred : makeCanonicalParticipantId(record.name, reserved);
            canonical.participants[id] = mergeParticipantRecord(canonical.participants[id], { ...record, id }, id);
        }
        return id;
    };
    (Array.isArray(plan.cars) ? plan.cars : []).forEach((car, groupIndex) => {
        const ownerId = resolve({ participantId: car.participantId, name: car.name, memo: car.driverMemo, gender: car.driverGender, grade: car.driverGrade, flag: car.driverFlag });
        if (!ownerId) return;
        let groupId = String(car.groupId || '').trim();
        if (!groupId || nextGroups[groupId]) groupId = Object.values(allocation.groups || {}).find(group => group?.ownerId === ownerId)?.id || makeCanonicalGroupId(normalizedType, ownerId, { ...(allocation.groups || {}), ...nextGroups });
        const previous = allocation.groups?.[groupId] || {};
        nextGroups[groupId] = { id: groupId, ownerId, capacity: Math.max(1, parseInt(car.capacity) || (normalizedType === 'team' ? 5 : 3)), order: groupIndex, createdAt: Number(previous.createdAt || canonicalNow()), updatedAt: canonicalNow() };
        nextPlacements[ownerId] = { kind: 'driver', groupId, order: groupIndex, updatedAt: canonicalNow() };
        (Array.isArray(car.members) ? car.members : []).filter(Boolean).forEach((member, memberIndex) => {
            const id = resolve(member);
            if (!id || nextPlacements[id]) return;
            nextPlacements[id] = { kind: 'member', groupId, order: memberIndex, updatedAt: canonicalNow() };
        });
    });
    (Array.isArray(plan.waiting) ? plan.waiting : []).filter(Boolean).forEach((member, waitingIndex) => {
        const id = resolve(member);
        if (!id || nextPlacements[id]) return;
        nextPlacements[id] = { kind: 'waiting', groupId: '', order: waitingIndex, updatedAt: canonicalNow() };
    });
    allocation.groups = nextGroups;
    allocation.placements = nextPlacements;
    allocation.updatedAt = canonicalNow();
    ensureAllParticipantsPlaced(allocation, canonical.participants || {});
    return allocation;
}

function deleteCanonicalParticipant(participantIdOrName, { deletedAt = canonicalNow() } = {}) {
    if (!canonicalRoomState) return false;
    const participants = canonicalRoomState.participants || (canonicalRoomState.participants = {});
    const raw = String(participantIdOrName || '').trim();
    const id = participants[raw] ? raw : findCanonicalParticipantIdByName(participants, raw);
    if (!id || !participants[id]) return false;

    canonicalRoomState.participantTombstones = canonicalRoomState.participantTombstones || {};
    canonicalRoomState.participantTombstones[id] = {
        ...(canonicalRoomState.participantTombstones[id] || {}),
        deletedAt: Math.max(Number(canonicalRoomState.participantTombstones[id]?.deletedAt || 0), Number(deletedAt || canonicalNow()))
    };
    delete participants[id];

    ALLOCATION_TYPES.forEach(type => {
        const allocation = canonicalRoomState.allocations?.[type];
        if (!allocation) return;
        delete allocation.placements?.[id];
        const ownedGroups = Object.entries(allocation.groups || {})
            .filter(([, group]) => group?.ownerId === id)
            .map(([groupId]) => groupId);
        ownedGroups.forEach(groupId => {
            delete allocation.groups[groupId];
            Object.entries(allocation.placements || {}).forEach(([memberId, placement]) => {
                if (placement?.groupId !== groupId) return;
                allocation.placements[memberId] = {
                    kind: 'waiting',
                    groupId: '',
                    order: Number.MAX_SAFE_INTEGER,
                    updatedAt: Number(deletedAt || canonicalNow())
                };
            });
        });
        ensureAllParticipantsPlaced(allocation, participants);
        allocation.updatedAt = Number(deletedAt || canonicalNow());
    });

    reconcileSettlementParticipantNames(canonicalRoomState, {});
    canonicalRoomState.lastUpdatedAt = Number(deletedAt || canonicalNow());
    canonicalRoomState.schemaVersion = CANONICAL_SCHEMA_VERSION;
    return true;
}

window.SanpoCanonicalState = Object.freeze({
    SCHEMA_VERSION: CANONICAL_SCHEMA_VERSION,
    emptyRoom: emptyCanonicalRoom,
    migrate: migrateToCanonicalRoom,
    get: getCanonicalRoomState,
    set: setCanonicalRoomState,
    projectAllocation: projectCanonicalAllocation,
    projectPlans: projectCanonicalCarPlans,
    captureFromDom: updateCanonicalFromActiveDom,
    createSnapshotFromUi: createCanonicalSnapshotFromUi,
    settlementToStorage: canonicalizeSettlementForStorage,
    settlementToUi: materializeSettlementForUi,
    setSettlementFromUi: setCanonicalSettlementFromUi,
    findParticipantIdByName: findCanonicalParticipantIdByName,
    ensureParticipant: ensureCanonicalParticipant,
    deleteParticipant: deleteCanonicalParticipant,
    ensureAllParticipantsPlaced,
    applyProjectedPlan: applyProjectedPlanToCanonical,
    normalizeNameKey: canonicalNameKey
});
