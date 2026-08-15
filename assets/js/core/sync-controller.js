// Schema v5 persistence and collaborative sync.
//
// The remote room is an entity tree, not a whole-page snapshot:
//   participants/{participantId}
//   allocations/{car|team}/groups/{groupId}
//   allocations/{car|team}/placements/{participantId}
//   settlement/carsByParticipantId/{participantId}
//   settlement/paidByParticipantId/{participantId}
//
// UI projections (waiting/cars/carPlans) never cross the persistence boundary. This makes
// participant deletion authoritative and prevents a stale phone from resurrecting somebody
// simply because it still holds an older card array.

const ROOM_META_FIELDS = [
    'roomName',
    'editLockEnabled',
    'editLockPassphrase',
    'editLockScopes',
    'overview',
    'resetGeneration',
    'schemaVersion'
];
const MAX_SYNC_OPERATION_JOURNAL = 256;
const MAX_SYNC_OUTBOX_AGE_MS = 24 * 60 * 60 * 1000;
const SETTLEMENT_ENTITY_MAPS = [
    'carsByParticipantId',
    'carsByName',
    'paidByParticipantId',
    'paidByName',
    'paidCollectorByParticipantId',
    'paidCollectorByName',
    'driverPaidByParticipantId',
    'driverPaidByName'
];
const SETTLEMENT_SCALAR_OR_OBJECT_FIELDS = [
    'rounding', 'organizerFree', 'organizerParticipantId', 'organizerNameFallback',
    'driverCollectionOffset', 'driverCollectionFree', 'driverReward', 'driverRewardType',
    'standalone', 'routeStops', 'routePlaceCatalog'
];
const LEGACY_REMOTE_FIELDS = ['waiting', 'cars', 'carPlans', 'activeCarPlanId', 'lastAutoAssignLabel', 'activeAllocationType', 'trayMinimized'];

let pendingRemoteRoomData = null;


function isRemoteUiBlocked() {
    const guardBusy = window.SanpoRemoteGuard?.isBusy?.() === true;
    return guardBusy
        || isSettlementInputProtected()
        || syncWriteInFlight
        || !!saveTimer
        || !!isDraggingCards
        || !!manualCardDrag
        || !!manualSheetDrag
        || !!isProcessingQueue;
}

function captureRemotePaintViewport() {
    const topArea = byId('top-area');
    const waitingScroller = byId('waiting-list-container');
    return {
        currentView: typeof currentView === 'string' ? currentView : '',
        windowX: Number(window.scrollX || 0),
        windowY: Number(window.scrollY || 0),
        topScrollTop: Number(topArea?.scrollTop || 0),
        topScrollLeft: Number(topArea?.scrollLeft || 0),
        waitingScrollTop: Number(waitingScroller?.scrollTop || 0)
    };
}

function restoreRemotePaintViewport(snapshot) {
    if (!snapshot || snapshot.currentView !== (typeof currentView === 'string' ? currentView : '')) return;
    const apply = () => {
        const topArea = byId('top-area');
        const waitingScroller = byId('waiting-list-container');
        if (topArea?.isConnected) {
            topArea.scrollTop = snapshot.topScrollTop;
            topArea.scrollLeft = snapshot.topScrollLeft;
        }
        if (waitingScroller?.isConnected) waitingScroller.scrollTop = snapshot.waitingScrollTop;
        if (Number.isFinite(snapshot.windowX) && Number.isFinite(snapshot.windowY)) {
            window.scrollTo(snapshot.windowX, snapshot.windowY);
        }
    };
    apply();
    requestAnimationFrame(() => {
        apply();
        requestAnimationFrame(apply);
    });
    // WebKit scroll anchoring can run after paint; own the position through that phase too.
    setTimeout(apply, 90);
}

function canonicalDomainSnapshot(value) {
    const room = migrateAppData(value || {});
    return {
        schemaVersion: room.schemaVersion,
        roomName: room.roomName,
        participants: room.participants,
        participantTombstones: room.participantTombstones,
        allocations: room.allocations,
        editLockEnabled: room.editLockEnabled,
        editLockPassphrase: room.editLockPassphrase,
        editLockScopes: room.editLockScopes,
        settlement: room.settlement,
        overview: room.overview,
        resetGeneration: Number(room.resetGeneration || 0)
    };
}

function currentCanonicalMatchesRemote(remote) {
    const current = window.SanpoCanonicalState?.get?.();
    if (!current) return false;
    return syncValuesEqual(canonicalDomainSnapshot(current), canonicalDomainSnapshot(remote));
}

function cloneSyncValue(value) {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
}

function createSyncOperationId(requestVersion = 0) {
    const client = String(myClientId || 'local').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 48) || 'local';
    return `op_${client}_${Number(requestVersion || 0)}_${Date.now().toString(36)}`;
}

function isSyncOperationApplied(room, operationId = '') {
    return !!operationId && !!room?.syncOperations?.[operationId];
}

function rememberAppliedSyncOperation(room, operationId = '', clock = 0) {
    if (!operationId || !room || typeof room !== 'object') return;
    const operations = room.syncOperations && typeof room.syncOperations === 'object'
        ? room.syncOperations
        : (room.syncOperations = {});
    operations[operationId] = { clock: Number(clock || 0), clientId: String(myClientId || ''), appliedAt: Date.now() };
    const retained = Object.entries(operations)
        .sort(([, a], [, b]) => Number(a?.clock || 0) - Number(b?.clock || 0) || Number(a?.appliedAt || 0) - Number(b?.appliedAt || 0));
    while (retained.length > MAX_SYNC_OPERATION_JOURNAL) {
        const [oldest] = retained.shift();
        delete operations[oldest];
    }
}

function isUnsupportedRemoteSchema(room) {
    return Number(room?.schemaVersion || 0) > Number(APP_SCHEMA_VERSION || 0);
}

function syncValuesEqual(a, b) {
    if (a === b) return true;
    if (a === undefined || b === undefined) return false;
    try { return JSON.stringify(a) === JSON.stringify(b); }
    catch (_) { return false; }
}

function getSyncBaseStorageKey() {
    return `${CFG.STORE}_sync_base_${roomId}`;
}

function readStoredSyncBase() {
    try {
        const value = safeJsonParse(L.getItem(getSyncBaseStorageKey()), null);
        return value ? migrateAppData(value) : null;
    } catch (_) {
        return null;
    }
}

function getSyncOutboxStorageKey() {
    return `${CFG.STORE}_sync_outbox_${roomId}`;
}

function readStoredSyncOutbox() {
    try {
        const value = safeJsonParse(L.getItem(getSyncOutboxStorageKey()), null);
        if (!value || typeof value !== 'object' || !value.snapshot || !value.patch) return null;
        return value;
    } catch (_) {
        return null;
    }
}

function isExpiredSyncOutbox(outbox, now = Date.now()) {
    const createdAt = Number(outbox?.createdAt || 0);
    return !!createdAt && Number(now) - createdAt > MAX_SYNC_OUTBOX_AGE_MS;
}

function isPermanentSyncError(error) {
    const code = String(error?.code || '').toLowerCase();
    const message = String(error?.message || error || '').toLowerCase();
    return code.includes('permission_denied')
        || code.includes('permission-denied')
        || message.includes('permission_denied')
        || message.includes('permission denied')
        || message.includes('remote schema')
        || message.includes('transaction support is required');
}

function rememberSyncOutbox(snapshot, baseSnapshot, patch, requestVersion, options = {}) {
    if (!patchHasDomainChanges(patch) && options.forceCanonical !== true) return '';
    const id = String(options.operationId || createSyncOperationId(requestVersion));
    const payload = {
        id,
        operationId: id,
        requestVersion: Number(requestVersion || 0),
        snapshot: cloneSyncValue(snapshot),
        baseSnapshot: cloneSyncValue(baseSnapshot || {}),
        patch: cloneSyncValue(patch || {}),
        forceCanonical: options.forceCanonical === true,
        createdAt: Date.now()
    };
    try { L.setItem(getSyncOutboxStorageKey(), J.stringify(payload)); }
    catch (error) { console.warn('Failed to persist sync outbox:', error); }
    return id;
}

function clearSyncOutbox(id = '') {
    const current = readStoredSyncOutbox();
    if (!current || (id && current.id !== id)) return;
    L.removeItem(getSyncOutboxStorageKey());
}

function rememberSyncedData(data) {
    if (!data || typeof data !== 'object') return;
    const canonical = migrateAppData(data);
    lastSyncedData = cloneSyncValue(canonical);
    lastSyncedRevision = Number(canonical.revision || 0);
    try { L.setItem(getSyncBaseStorageKey(), J.stringify(lastSyncedData)); }
    catch (error) { console.warn('Failed to persist sync base:', error); }
}

function rememberSyncedDataInMemory(data) {
    if (!data || typeof data !== 'object') return;
    const canonical = migrateAppData(data);
    lastSyncedData = cloneSyncValue(canonical);
    lastSyncedRevision = Number(canonical.revision || 0);
}

function setPatchValue(patch, path, value) {
    patch[path] = value === undefined ? null : cloneSyncValue(value);
}

function diffEntityMap(patch, prefix, baseMap = {}, localMap = {}) {
    const base = baseMap && typeof baseMap === 'object' ? baseMap : {};
    const local = localMap && typeof localMap === 'object' ? localMap : {};
    const ids = new Set([...Object.keys(base), ...Object.keys(local)]);
    ids.forEach(id => {
        const baseHas = Object.prototype.hasOwnProperty.call(base, id);
        const localHas = Object.prototype.hasOwnProperty.call(local, id);
        const path = `${prefix}/${id}`;
        if (!localHas && baseHas) setPatchValue(patch, path, null);
        else if (localHas && (!baseHas || !syncValuesEqual(base[id], local[id]))) setPatchValue(patch, path, local[id]);
    });
}

function diffObjectFields(patch, prefix, baseValue = {}, localValue = {}) {
    const base = baseValue && typeof baseValue === 'object' && !Array.isArray(baseValue) ? baseValue : {};
    const local = localValue && typeof localValue === 'object' && !Array.isArray(localValue) ? localValue : {};
    const keys = new Set([...Object.keys(base), ...Object.keys(local)]);
    keys.forEach(key => {
        const baseHas = Object.prototype.hasOwnProperty.call(base, key);
        const localHas = Object.prototype.hasOwnProperty.call(local, key);
        const path = `${prefix}/${key}`;
        if (!localHas && baseHas) {
            setPatchValue(patch, path, null);
            return;
        }
        if (!localHas) return;
        const b = base[key];
        const l = local[key];
        if (b && l && typeof b === 'object' && typeof l === 'object' && !Array.isArray(b) && !Array.isArray(l)) {
            diffObjectFields(patch, path, b, l);
        } else if (!baseHas || !syncValuesEqual(b, l)) {
            setPatchValue(patch, path, l);
        }
    });
}

function diffParticipantMap(patch, baseMap = {}, localMap = {}) {
    const base = baseMap && typeof baseMap === 'object' ? baseMap : {};
    const local = localMap && typeof localMap === 'object' ? localMap : {};
    const ids = new Set([...Object.keys(base), ...Object.keys(local)]);
    ids.forEach(id => {
        const baseHas = Object.prototype.hasOwnProperty.call(base, id);
        const localHas = Object.prototype.hasOwnProperty.call(local, id);
        const prefix = `participants/${id}`;
        if (!localHas && baseHas) setPatchValue(patch, prefix, null);
        else if (localHas && !baseHas) setPatchValue(patch, prefix, local[id]);
        else if (localHas) diffObjectFields(patch, prefix, base[id], local[id]);
    });
}

function diffSettlementCars(patch, baseMap = {}, localMap = {}) {
    const base = baseMap && typeof baseMap === 'object' ? baseMap : {};
    const local = localMap && typeof localMap === 'object' ? localMap : {};
    const ids = new Set([...Object.keys(base), ...Object.keys(local)]);
    ids.forEach(id => {
        const baseHas = Object.prototype.hasOwnProperty.call(base, id);
        const localHas = Object.prototype.hasOwnProperty.call(local, id);
        const prefix = `settlement/carsByParticipantId/${id}`;
        if (!localHas && baseHas) setPatchValue(patch, prefix, null);
        else if (localHas && !baseHas) setPatchValue(patch, prefix, local[id]);
        else if (localHas) diffObjectFields(patch, prefix, base[id], local[id]);
    });
}

function diffAllocation(patch, type, baseAllocation = {}, localAllocation = {}) {
    const prefix = `allocations/${type}`;
    ['id', 'type', 'name', 'lastAutoAssignLabel', 'updatedAt'].forEach(field => {
        if (!syncValuesEqual(baseAllocation?.[field], localAllocation?.[field])) {
            setPatchValue(patch, `${prefix}/${field}`, localAllocation?.[field]);
        }
    });
    diffEntityMap(patch, `${prefix}/groups`, baseAllocation?.groups, localAllocation?.groups);
    diffEntityMap(patch, `${prefix}/placements`, baseAllocation?.placements, localAllocation?.placements);
}

function diffSettlement(patch, baseSettlement = {}, localSettlement = {}) {
    const base = baseSettlement && typeof baseSettlement === 'object' ? baseSettlement : {};
    const local = localSettlement && typeof localSettlement === 'object' ? localSettlement : {};
    SETTLEMENT_SCALAR_OR_OBJECT_FIELDS.forEach(field => {
        if (!syncValuesEqual(base[field], local[field])) setPatchValue(patch, `settlement/${field}`, local[field]);
    });
    SETTLEMENT_ENTITY_MAPS.forEach(field => {
        if (field === 'carsByParticipantId') diffSettlementCars(patch, base[field], local[field]);
        else diffEntityMap(patch, `settlement/${field}`, base[field], local[field]);
    });

    // Future settlement fields remain forward compatible. Unknown keys are treated as a
    // single field, but the collaborative entity maps above stay independently writable.
    const known = new Set([...SETTLEMENT_SCALAR_OR_OBJECT_FIELDS, ...SETTLEMENT_ENTITY_MAPS]);
    const extraFields = new Set([...Object.keys(base), ...Object.keys(local)]);
    extraFields.forEach(field => {
        if (known.has(field)) return;
        if (!syncValuesEqual(base[field], local[field])) setPatchValue(patch, `settlement/${field}`, local[field]);
    });
}

function buildEntityPatch(baseRaw = {}, localRaw = {}, { forceCanonical = false } = {}) {
    const local = migrateAppData(localRaw || {});
    const patch = {};

    if (forceCanonical) {
        // Firebase multi-location updates cannot contain an ancestor and descendant path
        // in the same request. A one-time v4 -> v5 migration therefore writes canonical
        // roots as whole values, then removes all legacy mirror roots atomically.
        ROOM_META_FIELDS.forEach(field => setPatchValue(patch, field, local[field]));
        setPatchValue(patch, 'participants', local.participants || {});
        setPatchValue(patch, 'participantTombstones', local.participantTombstones || {});
        setPatchValue(patch, 'allocations', local.allocations || {});
        setPatchValue(patch, 'settlement', local.settlement || {});
        LEGACY_REMOTE_FIELDS.forEach(field => setPatchValue(patch, field, null));
        setPatchValue(patch, 'lastUpdatedAt', Number(local.lastUpdatedAt || (window.SanpoClock?.now?.() ?? Date.now())));
        setPatchValue(patch, 'lastUpdatedBy', local.lastUpdatedBy || myClientId);
        setPatchValue(patch, 'revision', Number(local.revision || 0));
        return patch;
    }

    const base = migrateAppData(baseRaw || {});
    ROOM_META_FIELDS.forEach(field => {
        if (!syncValuesEqual(base[field], local[field])) setPatchValue(patch, field, local[field]);
    });
    diffParticipantMap(patch, base.participants, local.participants);
    diffEntityMap(patch, 'participantTombstones', base.participantTombstones, local.participantTombstones);
    diffAllocation(patch, 'car', base.allocations?.car, local.allocations?.car);
    diffAllocation(patch, 'team', base.allocations?.team, local.allocations?.team);
    diffSettlement(patch, base.settlement, local.settlement);

    setPatchValue(patch, 'lastUpdatedAt', Number(local.lastUpdatedAt || (window.SanpoClock?.now?.() ?? Date.now())));
    setPatchValue(patch, 'lastUpdatedBy', local.lastUpdatedBy || myClientId);
    setPatchValue(patch, 'revision', Number(local.revision || 0));
    return patch;
}

function patchHasDomainChanges(patch = {}) {
    return Object.keys(patch).some(path => !['lastUpdatedAt', 'lastUpdatedBy', 'revision'].includes(path));
}

function syncDiagnosticPathLabel(path = '') {
    const value = String(path || '');
    if (value.includes('/placements/')) return '車割・班割の配置';
    if (value.includes('/groups/')) return '車・班の設定';
    if (value.includes('/extras')) return '精算の追加費目';
    if (value.startsWith('settlement/')) return '精算';
    if (value.startsWith('participants/')) return '参加者情報';
    return '共有データ';
}

function normalizeComparableSyncValue(value) {
    return value === null ? undefined : value;
}

function summarizeSyncOutcome(patch = {}, intended = {}, committed = {}) {
    const changedPaths = Object.keys(patch).filter(path => !['lastUpdatedAt', 'lastUpdatedBy', 'revision'].includes(path));
    const adjustedPaths = changedPaths.filter(path => !syncValuesEqual(
        normalizeComparableSyncValue(patch[path]),
        normalizeComparableSyncValue(getSyncPathValue(committed, path))
    ));
    return {
        changedPaths,
        adjustedPaths,
        labels: [...new Set(adjustedPaths.map(syncDiagnosticPathLabel))]
    };
}

function hasLocalChangesSinceBase(localData, baseData = lastSyncedData) {
    if (!localData || !baseData) return true;
    return patchHasDomainChanges(buildEntityPatch(baseData, localData));
}

// Compatibility/testing helper. It applies the same entity patch semantics in-memory.
function applyEntityPatchToObject(baseRaw = {}, patch = {}) {
    const result = cloneSyncValue(baseRaw || {}) || {};
    Object.entries(patch).forEach(([path, value]) => {
        const parts = path.split('/').filter(Boolean);
        if (!parts.length) return;
        let cursor = result;
        for (let i = 0; i < parts.length - 1; i += 1) {
            const key = parts[i];
            if (!cursor[key] || typeof cursor[key] !== 'object') cursor[key] = {};
            cursor = cursor[key];
        }
        const key = parts[parts.length - 1];
        if (value === null) delete cursor[key];
        else cursor[key] = cloneSyncValue(value);
    });
    return result;
}


function getSyncPathValue(root, path) {
    return String(path || '').split('/').filter(Boolean).reduce((value, key) => value == null ? undefined : value[key], root);
}

function isSettlementExtrasPath(path) {
    const parts = String(path || '').split('/').filter(Boolean);
    return parts[0] === 'settlement'
        && (parts[1] === 'carsByParticipantId' || parts[1] === 'carsByName')
        && parts[3] === 'extras';
}

function settlementExtraMergeId(extra, index, baseExtras = [], scope = '', used = new Set()) {
    const preferred = String(extra?.id || '').trim();
    if (preferred && !used.has(preferred)) {
        used.add(preferred);
        return preferred;
    }
    const baseId = String(baseExtras[index]?.id || '').trim();
    if (baseId && !used.has(baseId)) {
        used.add(baseId);
        return baseId;
    }
    const fingerprint = JSON.stringify({
        name: String(extra?.name ?? ''), amount: String(extra?.amount ?? ''),
        type: String(extra?.type ?? ''), timesFeeKind: String(extra?.timesFeeKind ?? '')
    });
    const compactScope = String(scope || 'extra').replace(/[^a-zA-Z0-9_-]/g, '_');
    let id = `x_${compactScope}_${index}_${fingerprint.length.toString(36)}`;
    let suffix = 2;
    while (used.has(id)) id = `x_${compactScope}_${index}_${fingerprint.length.toString(36)}_${suffix++}`;
    used.add(id);
    return id;
}

function normalizeSettlementExtrasForMerge(value, baseValue = [], scope = '') {
    const baseExtras = Array.isArray(baseValue) ? baseValue : [];
    const extras = Array.isArray(value) ? value : [];
    const used = new Set();
    return extras.map((raw, index) => {
        const extra = cloneSyncValue(raw || {}) || {};
        extra.id = settlementExtraMergeId(extra, index, baseExtras, scope, used);
        return extra;
    });
}

function mergeConcurrentSettlementExtra(before, remoteExtra, localExtra, preferLocal) {
    if (!before || !remoteExtra || !localExtra) return preferLocal ? localExtra : remoteExtra;
    const merged = {};
    const keys = new Set([...Object.keys(before), ...Object.keys(remoteExtra), ...Object.keys(localExtra)]);
    keys.forEach(key => {
        const baseValue = before[key];
        const remoteValue = remoteExtra[key];
        const localValue = localExtra[key];
        const remoteChanged = !syncValuesEqual(remoteValue, baseValue);
        const localChanged = !syncValuesEqual(localValue, baseValue);
        if (remoteChanged && localChanged && !syncValuesEqual(remoteValue, localValue)) {
            merged[key] = cloneSyncValue(preferLocal ? localValue : remoteValue);
        } else if (localChanged) merged[key] = cloneSyncValue(localValue);
        else if (remoteChanged) merged[key] = cloneSyncValue(remoteValue);
        else merged[key] = cloneSyncValue(baseValue);
    });
    return merged;
}

function mergeConcurrentSettlementExtras(baseValue, remoteValue, localValue, preferLocal, scope = '') {
    const base = normalizeSettlementExtrasForMerge(baseValue, [], scope);
    const remote = normalizeSettlementExtrasForMerge(remoteValue, base, scope);
    const local = normalizeSettlementExtrasForMerge(localValue, base, scope);
    const toMap = extras => new Map(extras.map(extra => [extra.id, extra]));
    const baseMap = toMap(base);
    const remoteMap = toMap(remote);
    const localMap = toMap(local);
    const ids = [
        ...base.map(extra => extra.id),
        ...local.map(extra => extra.id).filter(id => !baseMap.has(id)),
        ...remote.map(extra => extra.id).filter(id => !baseMap.has(id) && !localMap.has(id))
    ];
    const merged = [];
    ids.forEach(id => {
        const before = baseMap.get(id);
        const remoteExtra = remoteMap.get(id);
        const localExtra = localMap.get(id);
        let selected;
        if (!before) {
            selected = remoteExtra && localExtra
                ? (syncValuesEqual(remoteExtra, localExtra) ? localExtra : (preferLocal ? localExtra : remoteExtra))
                : (localExtra || remoteExtra);
        } else {
            const remoteChanged = !syncValuesEqual(remoteExtra, before);
            const localChanged = !syncValuesEqual(localExtra, before);
            if (remoteChanged && localChanged) {
                selected = syncValuesEqual(remoteExtra, localExtra)
                    ? localExtra
                    : mergeConcurrentSettlementExtra(before, remoteExtra, localExtra, preferLocal);
            } else if (localChanged) selected = localExtra;
            else if (remoteChanged) selected = remoteExtra;
            else selected = before;
        }
        if (selected) merged.push(cloneSyncValue(selected));
    });
    return merged;
}

function syncPathVersionKey(path) {
    return encodeURIComponent(String(path || '')).replace(/\./g, '%2E');
}

function syncVersionsEqual(a, b) {
    if (!a && !b) return true;
    if (!a || !b) return false;
    return Number(a.clock || 0) === Number(b.clock || 0)
        && Number(a.time || 0) === Number(b.time || 0)
        && String(a.clientId || '') === String(b.clientId || '')
        && Number(a.seq || 0) === Number(b.seq || 0);
}

function compareSyncVersions(a, b) {
    if (!b) return 1;
    if (!a) return -1;
    // Same-path edits need two properties at once:
    // 1) a genuinely older delayed packet must not revert a newer edit;
    // 2) a device with a bad wall clock must not dominate collaboration forever.
    // Firebase `.info/serverTimeOffset` aligns action timestamps across devices. Use those
    // timestamps only when *both* versions explicitly confirm server alignment; otherwise
    // fall back to the RTDB-serialized Lamport clock.
    const sameClient = String(a.clientId || '') && String(a.clientId || '') === String(b.clientId || '');
    if (sameClient) {
        const seqDiff = Number(a.seq || 0) - Number(b.seq || 0);
        if (seqDiff) return seqDiff > 0 ? 1 : -1;
    }
    const bothServerAligned = a.serverAligned === true && b.serverAligned === true;
    if (bothServerAligned) {
        const timeDiff = Number(a.time || 0) - Number(b.time || 0);
        if (timeDiff) return timeDiff > 0 ? 1 : -1;
    }
    const clockDiff = Number(a.clock || 0) - Number(b.clock || 0);
    if (clockDiff) return clockDiff > 0 ? 1 : -1;
    const clientDiff = String(a.clientId || '').localeCompare(String(b.clientId || ''));
    if (clientDiff) return clientDiff > 0 ? 1 : -1;
    const seqDiff = Number(a.seq || 0) - Number(b.seq || 0);
    return seqDiff === 0 ? 0 : (seqDiff > 0 ? 1 : -1);
}

function syncEntityTimeForPath(local, path) {
    const parts = String(path || '').split('/').filter(Boolean);
    if (parts[0] === 'participants' && parts[1]) return Number(local?.participants?.[parts[1]]?.updatedAt || local?.lastUpdatedAt || 0);
    if (parts[0] === 'participantTombstones' && parts[1]) return Number(local?.participantTombstones?.[parts[1]]?.deletedAt || local?.lastUpdatedAt || 0);
    if (parts[0] === 'allocations' && parts[1]) {
        if (parts[2] === 'groups' && parts[3]) return Number(local?.allocations?.[parts[1]]?.groups?.[parts[3]]?.updatedAt || local?.lastUpdatedAt || 0);
        if (parts[2] === 'placements' && parts[3]) return Number(local?.allocations?.[parts[1]]?.placements?.[parts[3]]?.updatedAt || local?.lastUpdatedAt || 0);
        return Number(local?.allocations?.[parts[1]]?.updatedAt || local?.lastUpdatedAt || 0);
    }
    if (parts[0] === 'settlement' && parts[1] === 'carsByParticipantId' && parts[2]) {
        return Number(local?.settlement?.carsByParticipantId?.[parts[2]]?.updatedAt || local?.lastUpdatedAt || 0);
    }
    return Number(local?.lastUpdatedAt || 0);
}

function applyPatchPathInPlace(result, path, value) {
    const parts = String(path || '').split('/').filter(Boolean);
    if (!parts.length) return;
    let cursor = result;
    for (let i = 0; i < parts.length - 1; i += 1) {
        const key = parts[i];
        if (!cursor[key] || typeof cursor[key] !== 'object') cursor[key] = {};
        cursor = cursor[key];
    }
    const key = parts[parts.length - 1];
    if (value === null) delete cursor[key];
    else cursor[key] = cloneSyncValue(value);
}

function applyVersionedEntityPatch(remoteRaw = {}, baseRaw = {}, localRaw = {}, patch = {}, requestVersion = 0, operationId = '') {
    // A user can act before the first empty-room onValue/cleanup transaction finishes.
    // Applying entity paths to a raw `{}` and only then migrating loses those paths because
    // the legacy migrator has no schema marker. Start a genuinely empty remote as a v5 room.
    const hasRemoteRoom = remoteRaw && typeof remoteRaw === 'object' && Object.keys(remoteRaw).length > 0;
    const remote = hasRemoteRoom
        ? (cloneSyncValue(remoteRaw) || {})
        : migrateAppData({});
    const base = cloneSyncValue(baseRaw || {}) || {};
    const local = cloneSyncValue(localRaw || {}) || {};
    // A reset keeps an empty canonical room instead of deleting its root. Any packet
    // based on an earlier generation is stale by definition and must not recreate data.
    if (Number(remote.resetGeneration || 0) !== Number(base.resetGeneration || 0)) return migrateAppData(remote);
    if (isSyncOperationApplied(remote, operationId)) return migrateAppData(remote);
    remote.pathVersions = cloneSyncValue(remote.pathVersions || {}) || {};
    const baseVersions = base.pathVersions || {};
    const remoteVersions = remote.pathVersions || {};
    const baseClock = Math.max(Number(base.syncClock || 0), ...Object.values(baseVersions).map(v => Number(v?.clock || 0)), 0);
    // A stale client must still be able to make a *new* edit.  The previous code derived
    // the candidate clock only from its stale base, so any path changed by another phone
    // after that base could reject this user's later action forever.  The RTDB transaction
    // serializes commits; allocate the next Lamport clock from the current remote tree.
    const remoteClock = Math.max(Number(remote.syncClock || 0), ...Object.values(remoteVersions).map(v => Number(v?.clock || 0)), 0);
    const candidateClock = Math.max(baseClock, remoteClock) + 1;
    let applied = 0;

    Object.entries(patch).forEach(([path, value]) => {
        if (['lastUpdatedAt', 'lastUpdatedBy', 'revision'].includes(path)) return;
        const key = syncPathVersionKey(path);
        const remoteVersion = remote.pathVersions[key] || null;
        const baseVersion = baseVersions[key] || null;
        const candidate = {
            clock: candidateClock,
            time: syncEntityTimeForPath(local, path),
            serverAligned: window.SanpoClock?.isServerAligned?.() === true,
            clientId: String(local.lastUpdatedBy || myClientId || ''),
            seq: Number(requestVersion || 0)
        };
        const concurrent = !syncVersionsEqual(remoteVersion, baseVersion);
        const candidateWins = compareSyncVersions(candidate, remoteVersion) > 0;
        if (concurrent && !candidateWins) return;
        const nextValue = concurrent && isSettlementExtrasPath(path)
            ? mergeConcurrentSettlementExtras(
                getSyncPathValue(base, path),
                getSyncPathValue(remote, path),
                value,
                candidateWins,
                path
            )
            : value;
        applyPatchPathInPlace(remote, path, nextValue);
        remote.pathVersions[key] = candidate;
        applied += 1;
    });

    if (!applied) {
        rememberAppliedSyncOperation(remote, operationId, remoteClock);
        return migrateAppData(remote);
    }
    remote.syncClock = Math.max(Number(remote.syncClock || 0), candidateClock);
    remote.lastUpdatedAt = Number(local.lastUpdatedAt || (window.SanpoClock?.now?.() ?? Date.now()));
    remote.lastUpdatedBy = String(local.lastUpdatedBy || myClientId || '');
    remote.revision = Math.max(0, Number(remote.revision || 0)) + 1;
    rememberAppliedSyncOperation(remote, operationId, remote.syncClock);
    // Canonicalization enforces participant tombstones, orphan cleanup and capacity.
    const normalized = migrateAppData(remote);
    normalized.pathVersions = remote.pathVersions;
    normalized.syncOperations = remote.syncOperations;
    normalized.syncClock = remote.syncClock;
    normalized.lastUpdatedAt = remote.lastUpdatedAt;
    normalized.lastUpdatedBy = remote.lastUpdatedBy;
    normalized.revision = remote.revision;
    return normalized;
}

function buildConcurrentRoomMerge(remoteRaw, baseRaw, localRaw) {
    const patch = buildEntityPatch(baseRaw, localRaw);
    return migrateAppData(applyEntityPatchToObject(migrateAppData(remoteRaw || {}), patch));
}

function applyAuthoritativeRemoteData(data, { rememberLocal = true, preserveViewport = true } = {}) {
    if (!data || typeof data !== 'object') return;
    const migrated = migrateAppData(data);

    // If the in-memory canonical model already equals the remote domain, only advance the
    // sync base.  Avoiding a redundant DOM rebuild is important on iOS because reparenting
    // every card can trigger scroll anchoring even when the data did not actually change.
    if (currentCanonicalMatchesRemote(migrated)) {
        rememberSyncedData(migrated);
        if (rememberLocal) L.setItem(CFG.STORE + '_' + roomId, J.stringify(migrated));
        return;
    }

    const viewport = preserveViewport ? captureRemotePaintViewport() : null;
    isRemoteUpdate = true;
    restore(migrated);
    isRemoteUpdate = false;
    rememberSyncedData(migrated);
    if (rememberLocal) L.setItem(CFG.STORE + '_' + roomId, J.stringify(migrated));
    if (viewport) restoreRemotePaintViewport(viewport);
}

function rememberPendingRemoteData(data) {
    if (!data || typeof data !== 'object') return;
    const next = migrateAppData(data);
    const currentRevision = Number(pendingRemoteRoomData?.revision || 0);
    const nextRevision = Number(next.revision || 0);
    const currentClock = Number(pendingRemoteRoomData?.syncClock || 0);
    const nextClock = Number(next.syncClock || 0);
    const newer = !pendingRemoteRoomData
        || nextRevision > currentRevision
        || (nextRevision === currentRevision && nextClock >= currentClock);
    if (newer) {
        pendingRemoteRoomData = cloneSyncValue(next);
        pendingRemoteSettlementData = pendingRemoteRoomData;
    }
}

async function commitSnapshotToRemote(snapshot, requestVersion = saveRequestVersion, capturedBase = null, options = {}) {
    if (isRemoteUpdate || !dbRef) return null;
    const localSnapshot = migrateAppData(snapshot || {});
    const baseAtWrite = migrateAppData(capturedBase || lastSyncedData || readStoredSyncBase() || {});
    const operationId = String(options.operationId || options.outboxId || createSyncOperationId(requestVersion));
    const patch = options.patchOverride && typeof options.patchOverride === 'object'
        ? cloneSyncValue(options.patchOverride)
        : buildEntityPatch(baseAtWrite, localSnapshot, { forceCanonical: options.forceCanonical === true });
        if (!patchHasDomainChanges(patch) && options.forceCanonical !== true) {
            if (options.outboxId) clearSyncOutbox(options.outboxId);
            updateStatus('connected', '同期完了');
            return localSnapshot;
    }

    syncWriteInFlight = true;
    try {
        let committed;
        if (typeof runTransaction === 'function') {
            let duplicateOperation = false;
            let resetInvalidated = false;
            const result = await runTransaction(dbRef, currentRemote => {
                if (isUnsupportedRemoteSchema(currentRemote)) {
                    throw new Error(`Remote schema ${currentRemote.schemaVersion} is newer than this client`);
                }
                if (Number(currentRemote?.resetGeneration || 0) !== Number(baseAtWrite?.resetGeneration || 0)) {
                    resetInvalidated = true;
                    return;
                }
                if (isSyncOperationApplied(currentRemote, operationId)) {
                    duplicateOperation = true;
                    return;
                }
                if (options.forceCanonical === true) {
                    // Canonical cleanup is derived from the value currently locked by
                    // RTDB. A captured blank-device snapshot must never replace data
                    // registered by another device while this transaction was queued.
                    const hasCurrentRemote = currentRemote && typeof currentRemote === 'object'
                        && Object.keys(currentRemote).length > 0;
                    const canonicalCurrent = migrateAppData(hasCurrentRemote ? currentRemote : localSnapshot);
                    LEGACY_REMOTE_FIELDS.forEach(field => { delete canonicalCurrent[field]; });
                    canonicalCurrent.lastUpdatedAt = Number(canonicalCurrent.lastUpdatedAt || (window.SanpoClock?.now?.() ?? Date.now()));
                    canonicalCurrent.lastUpdatedBy = String(canonicalCurrent.lastUpdatedBy || myClientId || '');
                    canonicalCurrent.revision = Math.max(0, Number(currentRemote?.revision || canonicalCurrent.revision || 0)) + 1;
                    rememberAppliedSyncOperation(canonicalCurrent, operationId, Number(canonicalCurrent.syncClock || 0));
                    return canonicalCurrent;
                }
                return applyVersionedEntityPatch(currentRemote || {}, baseAtWrite, localSnapshot, patch, requestVersion, operationId);
            }, { applyLocally: false });
            if (!result.committed && !duplicateOperation && !resetInvalidated) throw new Error('Firebase entity transaction was not committed');
            committed = migrateAppData(result.snapshot.val() || {});
            if (resetInvalidated) {
                if (options.outboxId) clearSyncOutbox(options.outboxId);
                applyAuthoritativeRemoteData(committed);
                window.SanpoSyncDiagnostics?.record?.({
                    kind: 'adjusted', message: 'リセット後の古い保存を破棄', paths: Object.keys(patch || {}), revision: Number(committed.revision || 0)
                });
                return committed;
            }
        } else {
            // Entity sync relies on a serializable transaction for operation-id
            // idempotency, reset generations and monotonic revisions. A blind update
            // would reintroduce duplicate/reordered write bugs, so fail closed.
            throw new Error('Firebase Realtime Database transaction support is required for shared sync');
        }
        rememberSyncedData(committed);
        L.setItem(CFG.STORE + '_' + roomId, J.stringify(committed));
        if (options.outboxId) clearSyncOutbox(options.outboxId);

        const outcome = summarizeSyncOutcome(patch, localSnapshot, committed);
        if (outcome.adjustedPaths.length) {
            const message = `同時編集を調整: ${outcome.labels.join('・') || '共有データ'}`;
            window.SanpoSyncDiagnostics?.record?.({
                kind: 'adjusted', message, paths: outcome.adjustedPaths, revision: committed.revision
            });
            // A successful transaction can legitimately merge a newer remote value.
            // Keep this in diagnostics for auditability, but do not interrupt every
            // normal save with a notice; actionable failures still notify the user.
        } else if (outcome.changedPaths.length) {
            window.SanpoSyncDiagnostics?.record?.({
                kind: 'saved', message: '共有データを保存', paths: outcome.changedPaths, revision: committed.revision
            });
        }

        const pendingRevision = Number(pendingRemoteRoomData?.revision || 0);
        const committedRevision = Number(committed.revision || 0);
        if (pendingRemoteRoomData && pendingRevision <= committedRevision) {
            pendingRemoteRoomData = null;
            pendingRemoteSettlementData = null;
        }

        // The transaction result contains both this client's patch and any concurrent remote
        // entities.  Repaint only after the write surface is idle; otherwise queue the merged
        // authoritative state so a second edit cannot be based on a stale model.
        if (isRemoteUiBlocked()) {
            rememberPendingRemoteData(committed);
            window.SanpoRemoteGuard?.requestPendingApply?.(0);
        } else {
            applyAuthoritativeRemoteData(committed);
        }
        updateStatus('connected', '同期完了');
        return committed;
    } catch (error) {
        console.error(error);
        const rejected = isPermanentSyncError(error);
        if (rejected && options.outboxId) {
            clearSyncOutbox(options.outboxId);
            window.SanpoSyncDiagnostics?.record?.({
                kind: 'rejected', message: '共有保存を拒否されたため再送を停止', paths: Object.keys(patch || {}), revision: Number(lastSyncedRevision || 0)
            });
            window.showAppNotice?.('共有保存を拒否されました。古い再送データを破棄しました。アプリを更新して再確認してください。', true);
        }
        window.SanpoSyncDiagnostics?.record?.({
            kind: rejected ? 'rejected' : 'failed', message: rejected ? '共有保存を拒否、再送停止' : '共有データの保存に失敗', paths: Object.keys(patch || {}), revision: Number(lastSyncedRevision || 0)
        });
        updateStatus('error', rejected ? '保存を拒否、再送停止' : '保存失敗');
        return null;
    } finally {
        syncWriteInFlight = false;
        window.SanpoRemoteGuard?.requestPendingApply?.(0);
        if (!window.SanpoRemoteGuard && !isSettlementInputProtected()) queueMicrotask(applyPendingRemoteRoomData);
    }
}

function queueRemoteSnapshotSave(snapshot, delay = 180, options = {}) {
    if (isRemoteUpdate || !dbRef) return;
    clearTimeout(saveTimer);
    const requestVersion = ++saveRequestVersion;
    const capturedBase = cloneSyncValue(lastSyncedData || readStoredSyncBase() || {});
    const patch = options.patchOverride && typeof options.patchOverride === 'object'
        ? cloneSyncValue(options.patchOverride)
        : buildEntityPatch(capturedBase, snapshot, { forceCanonical: options.forceCanonical === true });
    const operationId = String(options.operationId || createSyncOperationId(requestVersion));
    const outboxId = rememberSyncOutbox(snapshot, capturedBase, patch, requestVersion, { ...options, operationId });
    saveTimer = setTimeout(() => {
        saveTimer = null;
        void commitSnapshotToRemote(snapshot, requestVersion, capturedBase, {
            ...options,
            patchOverride: patch,
            outboxId,
            operationId
        });
    }, Math.max(0, Number(delay) || 0));
}

function buildSettlementIntentPatch(baseRaw = {}, localRaw = {}) {
    const fullPatch = buildEntityPatch(baseRaw, localRaw);
    const settlementPatch = {};
    Object.entries(fullPatch).forEach(([path, value]) => {
        if (String(path).startsWith('settlement/')) settlementPatch[path] = cloneSyncValue(value);
    });
    return settlementPatch;
}

const SETTLEMENT_SETTINGS_PATH_PREFIXES = [
    'settlement/rounding',
    'settlement/organizerFree',
    'settlement/organizerParticipantId',
    'settlement/organizerNameFallback',
    'settlement/driverCollectionOffset',
    'settlement/driverCollectionFree',
    'settlement/driverReward',
    'settlement/driverRewardType',
    'settlement/standalone'
];

function syncPathMatchesPrefix(path, prefix) {
    const value = String(path || '');
    const root = String(prefix || '');
    return value === root || value.startsWith(`${root}/`);
}

function buildSettlementCarIntentPatch(baseRaw = {}, localRaw = {}, { participantId = '', name = '' } = {}) {
    const fullPatch = buildSettlementIntentPatch(baseRaw, localRaw);
    const prefixes = [];
    if (participantId) prefixes.push(`settlement/carsByParticipantId/${participantId}`);
    if (name) prefixes.push(`settlement/carsByName/${name}`);
    return Object.fromEntries(Object.entries(fullPatch).filter(([path]) => prefixes.some(prefix => syncPathMatchesPrefix(path, prefix))));
}

function buildSettlementSettingsIntentPatch(baseRaw = {}, localRaw = {}) {
    const fullPatch = buildSettlementIntentPatch(baseRaw, localRaw);
    return Object.fromEntries(Object.entries(fullPatch).filter(([path]) => SETTLEMENT_SETTINGS_PATH_PREFIXES.some(prefix => syncPathMatchesPrefix(path, prefix))));
}

async function saveImmediate({ snapshot = null, baseSnapshot = null, patchOverride = null, operationId: requestedOperationId = '' } = {}) {
    updateStatus('saving', '保存中...');
    lastUpdatedAt = (window.SanpoClock?.now?.() ?? Date.now());
    const d = migrateAppData(snapshot || getData({ skipDomSync: !!window.__suspendActiveDomPlanSync }) || {});
    d.lastUpdatedBy = myClientId;
    d.lastUpdatedAt = lastUpdatedAt;
    d.revision = Math.max(Number(lastSyncedData?.revision || 0), Number(d.revision || 0)) + 1;
    const canonical = window.SanpoCanonicalState?.set?.(d) || d;
    L.setItem(CFG.STORE + '_' + roomId, J.stringify(canonical));

    if (isRemoteUpdate || !dbRef) {
        if (!isRemoteUpdate) updateStatus('local', 'ローカル保存済み');
        return canonical;
    }

    clearTimeout(saveTimer);
    saveTimer = null;
    const requestVersion = ++saveRequestVersion;
    const capturedBase = cloneSyncValue(baseSnapshot || lastSyncedData || readStoredSyncBase() || {});
    const patch = patchOverride && typeof patchOverride === 'object'
        ? cloneSyncValue(patchOverride)
        : buildEntityPatch(capturedBase, canonical);
    // Callers normally omit this. Keeping an explicit ID through a retry lets the
    // transaction journal make a transport duplicate a no-op instead of a second edit.
    const operationId = String(requestedOperationId || createSyncOperationId(requestVersion));
    const outboxId = rememberSyncOutbox(canonical, capturedBase, patch, requestVersion, { operationId });
    return await commitSnapshotToRemote(canonical, requestVersion, capturedBase, {
        patchOverride: patch,
        outboxId,
        operationId
    });
}

function save() {
    updateStatus('saving', '保存中...');
    lastUpdatedAt = (window.SanpoClock?.now?.() ?? Date.now());
    const d = getData({ skipDomSync: !!window.__suspendActiveDomPlanSync });
    d.lastUpdatedBy = myClientId;
    d.lastUpdatedAt = lastUpdatedAt;
    d.revision = Math.max(Number(lastSyncedData?.revision || 0), Number(d.revision || 0)) + 1;
    const canonical = window.SanpoCanonicalState?.set?.(d) || d;
    L.setItem(CFG.STORE + '_' + roomId, J.stringify(canonical));

    if (!isRemoteUpdate && dbRef) queueRemoteSnapshotSave(canonical, 180);
    else if (!isRemoteUpdate) setTimeout(() => updateStatus('local', 'ローカル保存済み'), 120);
}

function resetEmptyLocalRoom() {
    const empty = window.SanpoCanonicalState?.set?.({ schemaVersion: APP_SCHEMA_VERSION }) || {};
    isRemoteUpdate = true;
    restore(empty);
    isRemoteUpdate = false;
    rememberTrustedDevice('');
    updateEditLockButton();
    refreshRoomTitle();
    updateUI();
    L.removeItem(CFG.STORE + '_' + roomId);
}

function load() {
    const localDataStr = L.getItem(CFG.STORE + '_' + roomId);
    const localData = localDataStr ? migrateAppData(safeJsonParse(localDataStr, {})) : null;

    if (!dbRef) {
        if (localData) {
            isRemoteUpdate = true;
            restore(localData);
            isRemoteUpdate = false;
            rememberSyncedData(localData);
        } else resetEmptyLocalRoom();
        updateStatus('local', 'ローカル保存');
        hideAppLoadingSkeleton?.();
        return;
    }

    onValue(dbRef, snapshot => {
        hideAppLoadingSkeleton?.();
        const raw = snapshot.val();
        if (!raw) {
            if (localDataStr) {
                const canonicalLocal = migrateAppData(safeJsonParse(localDataStr, {}));
                isRemoteUpdate = true;
                restore(canonicalLocal);
                isRemoteUpdate = false;
                rememberSyncedData({});
                queueRemoteSnapshotSave(canonicalLocal, 0, { forceCanonical: true });
            } else resetEmptyLocalRoom();
            return;
        }

        // Never down-migrate or write a room made by a future client. Rules block old
        // writers as well, but this local gate prevents an unsafe queued outbox replay.
        if (isUnsupportedRemoteSchema(raw)) {
            updateStatus('error', 'この端末は共有データの新版に未対応です');
            window.showAppNotice?.('共有データが新しい版へ更新されています。アプリを更新してから再接続してください。', true);
            return;
        }

        // RTDB omits empty maps, so a missing participants property is a valid
        // zero-participant v5 room and must not trigger whole-root migration.
        const wasLegacy = Number(raw.schemaVersion || 1) < APP_SCHEMA_VERSION
            || !raw.allocations?.car
            || !raw.allocations?.team;
        const hasSharedPresentationLegacy = Object.prototype.hasOwnProperty.call(raw, 'activeAllocationType')
            || Object.prototype.hasOwnProperty.call(raw, 'trayMinimized');
        const remote = migrateAppData(raw);
        if (!lastSyncedData) rememberSyncedData(remote);

        // Only an explicitly saved operation enters the durable outbox. On reconnect/reload,
        // replay that original narrow intent against the latest transaction state; never infer
        // intent by diffing a rendered/localStorage snapshot against Firebase.
        const outbox = readStoredSyncOutbox();
        if (outbox && !syncWriteInFlight && !saveTimer) {
            if (isExpiredSyncOutbox(outbox)) {
                clearSyncOutbox(outbox.id);
                window.SanpoSyncDiagnostics?.record?.({
                    kind: 'rejected', message: '期限切れの未送信データを破棄', paths: Object.keys(outbox.patch || {}), revision: Number(remote.revision || 0)
                });
                window.showAppNotice?.('24時間を超えた未送信データを安全のため破棄しました。', true);
                applyAuthoritativeRemoteData(remote);
                return;
            }
            if (Number(outbox.baseSnapshot?.resetGeneration || 0) !== Number(remote.resetGeneration || 0)) {
                clearSyncOutbox(outbox.id);
                window.SanpoSyncDiagnostics?.record?.({
                    kind: 'adjusted', message: 'リセット後の古い保存を破棄', paths: Object.keys(outbox.patch || {}), revision: Number(remote.revision || 0)
                });
                applyAuthoritativeRemoteData(remote);
                return;
            }
            saveRequestVersion = Math.max(saveRequestVersion, Number(outbox.requestVersion || 0));
            isRemoteUpdate = true;
            restore(migrateAppData(outbox.snapshot));
            isRemoteUpdate = false;
            rememberSyncedDataInMemory(remote);
            void commitSnapshotToRemote(
                outbox.snapshot,
                Number(outbox.requestVersion || saveRequestVersion),
                outbox.baseSnapshot || {},
                {
                    patchOverride: outbox.patch,
                    forceCanonical: outbox.forceCanonical === true,
                    outboxId: outbox.id,
                    operationId: outbox.operationId || outbox.id
                }
            );
            return;
        }

        // The editor DOM owns the draft until its UI transaction ends. Remote snapshots are
        // queued as complete authoritative rooms; the save path emits a narrow intent patch,
        // so disjoint edits still merge without rebuilding an open Carbon surface.
        if (isRemoteUiBlocked()) {
            rememberPendingRemoteData(remote);
            updateStatus('local', window.SanpoRemoteGuard?.isModalOpen?.() ? '編集中のため同期保留' : (isSettlementInputProtected() ? '入力中のため同期保留' : '変更を同期中...'));
            return;
        }

        applyAuthoritativeRemoteData(remote);
        if (wasLegacy || hasSharedPresentationLegacy) {
            // One-time canonical cleanup. Entity data is written and duplicated v4 mirrors plus
            // device-only presentation fields are removed from Firebase.
            queueRemoteSnapshotSave(remote, 0, { forceCanonical: true });
        }
    });
}

function applyPendingRemoteRoomData() {
    const pending = pendingRemoteRoomData || pendingRemoteSettlementData;
    if (!pending || isRemoteUiBlocked()) return;

    // Debounced and in-flight local writes are part of isRemoteUiBlocked(). Once this
    // boundary is idle, the newest pending transaction result/onValue snapshot is already
    // authoritative. Never infer another write from rendered DOM or localStorage here;
    // that feedback loop repeatedly re-saved stale projections after remote notifications.
    pendingRemoteRoomData = null;
    pendingRemoteSettlementData = null;
    applyAuthoritativeRemoteData(pending);
}

function applyPendingRemoteSettlementData() {
    applyPendingRemoteRoomData();
}

window.resetData = async () => {
    const input = await requestPassphrasePanel('共有データを全消去します。実行するには「リセット」と入力してください。', false);
    if (input !== 'リセット') return;
    L.removeItem(CFG.STORE + '_' + roomId);
    L.removeItem(getSyncBaseStorageKey());
    L.removeItem(getSyncOutboxStorageKey());
    L.removeItem('syawari_history_' + roomId);
    window.SanpoSyncDiagnostics?.clear?.();
    L.removeItem('sanpoOverviewDraft:v1:' + roomId);
    if (window.SanpoDeviceRoomUi) L.removeItem(`sanpoRoomUi:v1:${roomId}`);
    L.removeItem(getTrustedDeviceKey());
    if (dbRef) {
        const resetOperationId = createSyncOperationId(++saveRequestVersion);
        runTransaction(dbRef, currentRemote => {
            if (isUnsupportedRemoteSchema(currentRemote)) throw new Error('Remote schema is newer than this client');
            const empty = migrateAppData({});
            empty.resetGeneration = Math.max(0, Number(currentRemote?.resetGeneration || 0)) + 1;
            empty.lastUpdatedBy = myClientId;
            empty.lastUpdatedAt = (window.SanpoClock?.now?.() ?? Date.now());
            empty.revision = Math.max(0, Number(currentRemote?.revision || 0)) + 1;
            rememberAppliedSyncOperation(empty, resetOperationId, Number(currentRemote?.syncClock || 0) + 1);
            return empty;
        }, { applyLocally: false }).then(() => { location.reload(); }).catch(err => { console.error(err); showAppNotice('リセットに失敗しました。', true); });
    } else location.reload();
};

window.SanpoEntitySyncTest = Object.freeze({ buildEntityPatch, buildSettlementIntentPatch, buildSettlementCarIntentPatch, buildSettlementSettingsIntentPatch, applyEntityPatchToObject, applyVersionedEntityPatch, compareSyncVersions, syncPathVersionKey, mergeConcurrentSettlementExtras, summarizeSyncOutcome, isUnsupportedRemoteSchema, isExpiredSyncOutbox, isPermanentSyncError });
window.SanpoSync = Object.freeze({ saveImmediate, buildSettlementIntentPatch, buildSettlementCarIntentPatch, buildSettlementSettingsIntentPatch });
