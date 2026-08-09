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
    'activeAllocationType',
    'trayMinimized',
    'editLockEnabled',
    'editLockPassphrase',
    'editLockScopes',
    'overview',
    'schemaVersion'
];
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
const LEGACY_REMOTE_FIELDS = ['waiting', 'cars', 'carPlans', 'activeCarPlanId', 'lastAutoAssignLabel'];

let pendingRemoteRoomData = null;

function cloneSyncValue(value) {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
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

function rememberSyncedData(data) {
    if (!data || typeof data !== 'object') return;
    const canonical = migrateAppData(data);
    lastSyncedData = cloneSyncValue(canonical);
    lastSyncedRevision = Number(canonical.revision || 0);
    try { L.setItem(getSyncBaseStorageKey(), J.stringify(lastSyncedData)); }
    catch (error) { console.warn('Failed to persist sync base:', error); }
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
        setPatchValue(patch, 'lastUpdatedAt', Number(local.lastUpdatedAt || Date.now()));
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

    setPatchValue(patch, 'lastUpdatedAt', Number(local.lastUpdatedAt || Date.now()));
    setPatchValue(patch, 'lastUpdatedBy', local.lastUpdatedBy || myClientId);
    setPatchValue(patch, 'revision', Number(local.revision || 0));
    return patch;
}

function patchHasDomainChanges(patch = {}) {
    return Object.keys(patch).some(path => !['lastUpdatedAt', 'lastUpdatedBy', 'revision'].includes(path));
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

function buildConcurrentRoomMerge(remoteRaw, baseRaw, localRaw) {
    const patch = buildEntityPatch(baseRaw, localRaw);
    return migrateAppData(applyEntityPatchToObject(migrateAppData(remoteRaw || {}), patch));
}

function applyAuthoritativeRemoteData(data, { rememberLocal = true } = {}) {
    if (!data || typeof data !== 'object') return;
    const migrated = migrateAppData(data);
    isRemoteUpdate = true;
    restore(migrated);
    isRemoteUpdate = false;
    rememberSyncedData(migrated);
    if (rememberLocal) L.setItem(CFG.STORE + '_' + roomId, J.stringify(migrated));
}

function rememberPendingRemoteData(data) {
    if (!data || typeof data !== 'object') return;
    const next = migrateAppData(data);
    const currentTime = Number(pendingRemoteRoomData?.lastUpdatedAt || 0);
    const nextTime = Number(next.lastUpdatedAt || 0);
    if (!pendingRemoteRoomData || nextTime >= currentTime) {
        pendingRemoteRoomData = cloneSyncValue(next);
        pendingRemoteSettlementData = pendingRemoteRoomData;
    }
}

async function commitSnapshotToRemote(snapshot, requestVersion = saveRequestVersion, capturedBase = null, options = {}) {
    if (isRemoteUpdate || !dbRef) return null;
    const localSnapshot = migrateAppData(snapshot || {});
    const baseAtWrite = migrateAppData(capturedBase || lastSyncedData || readStoredSyncBase() || {});
    const patch = buildEntityPatch(baseAtWrite, localSnapshot, { forceCanonical: options.forceCanonical === true });
    if (!patchHasDomainChanges(patch) && options.forceCanonical !== true) {
        updateStatus('connected', '同期完了');
        return localSnapshot;
    }

    syncWriteInFlight = true;
    try {
        await update(dbRef, patch);
        // Preserve untouched server entities from our last base while immediately advancing
        // the paths we wrote. The onValue snapshot that follows becomes the authoritative base.
        const optimistic = migrateAppData(applyEntityPatchToObject(baseAtWrite, patch));
        rememberSyncedData(optimistic);
        L.setItem(CFG.STORE + '_' + roomId, J.stringify(optimistic));

        const pendingTime = Number(pendingRemoteRoomData?.lastUpdatedAt || 0);
        const localTime = Number(localSnapshot.lastUpdatedAt || 0);
        if (pendingRemoteRoomData && pendingTime && pendingTime <= localTime) {
            pendingRemoteRoomData = null;
            pendingRemoteSettlementData = null;
        }
        updateStatus('connected', '同期完了');
        return optimistic;
    } catch (error) {
        console.error(error);
        updateStatus('error', '保存失敗');
        return null;
    } finally {
        syncWriteInFlight = false;
        if (!isSettlementInputProtected()) queueMicrotask(applyPendingRemoteRoomData);
    }
}

function queueRemoteSnapshotSave(snapshot, delay = 180, options = {}) {
    if (isRemoteUpdate || !dbRef) return;
    clearTimeout(saveTimer);
    const requestVersion = ++saveRequestVersion;
    const capturedBase = cloneSyncValue(lastSyncedData || readStoredSyncBase() || {});
    saveTimer = setTimeout(() => {
        saveTimer = null;
        void commitSnapshotToRemote(snapshot, requestVersion, capturedBase, options);
    }, Math.max(0, Number(delay) || 0));
}

function save() {
    updateStatus('saving', '保存中...');
    lastUpdatedAt = Date.now();
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
        if (isProcessingQueue) return;
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

        const wasLegacy = Number(raw.schemaVersion || 1) < APP_SCHEMA_VERSION || !raw.participants || !raw.allocations;
        const remote = migrateAppData(raw);
        if (!lastSyncedData) rememberSyncedData(remote);

        // A local edit in progress owns the visible UI. Incoming snapshots are queued until
        // the local entity patch has been written; they are never painted over the gesture/input.
        if (saveTimer || syncWriteInFlight || isSettlementInputProtected() || isDraggingCards || manualCardDrag) {
            rememberPendingRemoteData(remote);
            updateStatus('local', isSettlementInputProtected() ? '入力中のため同期保留' : '変更を同期中...');
            return;
        }

        const storedLocal = safeJsonParse(L.getItem(CFG.STORE + '_' + roomId), null);
        if (storedLocal && hasLocalChangesSinceBase(migrateAppData(storedLocal), lastSyncedData)) {
            rememberPendingRemoteData(remote);
            isRemoteUpdate = true;
            restore(migrateAppData(storedLocal));
            isRemoteUpdate = false;
            save();
            return;
        }

        applyAuthoritativeRemoteData(remote);
        if (wasLegacy) {
            // One-time schema migration. Canonical entities are written and all duplicated
            // v4 allocation mirrors are deleted from Firebase in the same multi-location update.
            queueRemoteSnapshotSave(remote, 0, { forceCanonical: true });
        }
    });
}

function applyPendingRemoteRoomData() {
    const pending = pendingRemoteRoomData || pendingRemoteSettlementData;
    if (!pending || isSettlementInputProtected() || syncWriteInFlight || saveTimer || isDraggingCards || manualCardDrag) return;
    const local = getData({ skipDomSync: !!window.__suspendActiveDomPlanSync });
    if (hasLocalChangesSinceBase(local)) {
        save();
        return;
    }
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
    L.removeItem('syawari_history_' + roomId);
    L.removeItem('sanpoOverviewDraft:v1:' + roomId);
    L.removeItem(getTrustedDeviceKey());
    if (dbRef) {
        set(dbRef, null).then(() => { location.reload(); }).catch(err => { console.error(err); showAppNotice('リセットに失敗しました。', true); });
    } else location.reload();
};
