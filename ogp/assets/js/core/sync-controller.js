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
const LEGACY_REMOTE_FIELDS = ['waiting', 'cars', 'carPlans', 'activeCarPlanId', 'lastAutoAssignLabel', 'activeAllocationType', 'trayMinimized'];

let pendingRemoteRoomData = null;
let pendingRemoteAcknowledgedRequestVersion = 0;


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
        overview: room.overview
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

function applyVersionedEntityPatch(remoteRaw = {}, baseRaw = {}, localRaw = {}, patch = {}, requestVersion = 0) {
    const remote = cloneSyncValue(remoteRaw || {}) || {};
    const base = cloneSyncValue(baseRaw || {}) || {};
    const local = cloneSyncValue(localRaw || {}) || {};
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
        if (concurrent && compareSyncVersions(candidate, remoteVersion) <= 0) return;
        applyPatchPathInPlace(remote, path, value);
        remote.pathVersions[key] = candidate;
        applied += 1;
    });

    if (!applied) return migrateAppData(remote);
    remote.syncClock = Math.max(Number(remote.syncClock || 0), candidateClock);
    remote.lastUpdatedAt = Number(local.lastUpdatedAt || (window.SanpoClock?.now?.() ?? Date.now()));
    remote.lastUpdatedBy = String(local.lastUpdatedBy || myClientId || '');
    remote.revision = Math.max(0, Number(remote.revision || 0)) + 1;
    // Canonicalization enforces participant tombstones, orphan cleanup and capacity.
    const normalized = migrateAppData(remote);
    normalized.pathVersions = remote.pathVersions;
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

function rememberPendingRemoteData(data, { acknowledgedRequestVersion = 0 } = {}) {
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
    // A transaction result produced by this client already contains that local request.
    // Keep this acknowledgement even if a slightly newer onValue snapshot replaces the
    // pending payload: the newer room necessarily descends from the committed revision.
    pendingRemoteAcknowledgedRequestVersion = Math.max(
        pendingRemoteAcknowledgedRequestVersion,
        Number(acknowledgedRequestVersion || 0)
    );
}

async function commitSnapshotToRemote(snapshot, requestVersion = saveRequestVersion, capturedBase = null, options = {}) {
    if (isRemoteUpdate || !dbRef) return null;
    const localSnapshot = migrateAppData(snapshot || {});
    const baseAtWrite = migrateAppData(capturedBase || lastSyncedData || readStoredSyncBase() || {});
    const patch = options.patchOverride && typeof options.patchOverride === 'object'
        ? cloneSyncValue(options.patchOverride)
        : buildEntityPatch(baseAtWrite, localSnapshot, { forceCanonical: options.forceCanonical === true });
    if (!patchHasDomainChanges(patch) && options.forceCanonical !== true) {
        updateStatus('connected', '同期完了');
        return localSnapshot;
    }

    syncWriteInFlight = true;
    try {
        let committed;
        if (typeof runTransaction === 'function') {
            const result = await runTransaction(dbRef, currentRemote => {
                return applyVersionedEntityPatch(currentRemote || {}, baseAtWrite, localSnapshot, patch, requestVersion);
            }, { applyLocally: false });
            if (!result.committed) throw new Error('Firebase entity transaction was not committed');
            committed = migrateAppData(result.snapshot.val() || {});
        } else {
            // Compatibility fallback for environments without RTDB transactions.
            await update(dbRef, patch);
            committed = migrateAppData(applyEntityPatchToObject(baseAtWrite, patch));
        }
        rememberSyncedData(committed);
        L.setItem(CFG.STORE + '_' + roomId, J.stringify(committed));

        const pendingRevision = Number(pendingRemoteRoomData?.revision || 0);
        const committedRevision = Number(committed.revision || 0);
        if (pendingRemoteRoomData && pendingRevision <= committedRevision) {
            pendingRemoteRoomData = null;
            pendingRemoteSettlementData = null;
            pendingRemoteAcknowledgedRequestVersion = 0;
        }

        // The transaction result contains both this client's patch and any concurrent remote
        // entities.  Repaint only after the write surface is idle; otherwise queue the merged
        // authoritative state so a second edit cannot be based on a stale model.
        if (isRemoteUiBlocked()) {
            rememberPendingRemoteData(committed, { acknowledgedRequestVersion: requestVersion });
            window.SanpoRemoteGuard?.requestPendingApply?.(0);
        } else {
            applyAuthoritativeRemoteData(committed);
        }
        updateStatus('connected', '同期完了');
        return committed;
    } catch (error) {
        console.error(error);
        updateStatus('error', '保存失敗');
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
    saveTimer = setTimeout(() => {
        saveTimer = null;
        void commitSnapshotToRemote(snapshot, requestVersion, capturedBase, options);
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

function getActiveSettlementRemoteProtection() {
    if (typeof document === 'undefined') return null;
    const carModal = document.getElementById('settlementCarEditModal');
    if (carModal?.open || carModal?.hasAttribute?.('open')) {
        const name = String(typeof activeSettlementCarEditName === 'string' ? activeSettlementCarEditName : '').trim();
        const canonical = window.SanpoCanonicalState?.get?.();
        const participantId = name
            ? (window.SanpoCanonicalState?.findParticipantIdByName?.(canonical?.participants || {}, name) || '')
            : '';
        const prefixes = [];
        if (participantId) prefixes.push(`settlement/carsByParticipantId/${participantId}`);
        if (name) prefixes.push(`settlement/carsByName/${name}`);
        return { kind: 'car', name, participantId, prefixes };
    }

    const settingsModal = document.getElementById('settlementSettingsModal');
    if (settingsModal?.open || settingsModal?.hasAttribute?.('open')) {
        return { kind: 'settings', prefixes: [...SETTLEMENT_SETTINGS_PATH_PREFIXES] };
    }

    const focusedRow = document.activeElement?.closest?.('.seisan-car-row');
    const name = String(focusedRow?.dataset?.driverName || '').trim();
    if (name && isSettlementInputProtected()) {
        const canonical = window.SanpoCanonicalState?.get?.();
        const participantId = window.SanpoCanonicalState?.findParticipantIdByName?.(canonical?.participants || {}, name) || '';
        const prefixes = [];
        if (participantId) prefixes.push(`settlement/carsByParticipantId/${participantId}`);
        prefixes.push(`settlement/carsByName/${name}`);
        return { kind: 'car', name, participantId, prefixes };
    }
    return null;
}

function copyAcceptedPathVersions(target, remote, acceptedPaths = []) {
    if (!target || !remote || !acceptedPaths.length) return target;
    target.pathVersions = cloneSyncValue(target.pathVersions || {}) || {};
    const remoteVersions = remote.pathVersions || {};
    acceptedPaths.forEach(path => {
        const key = syncPathVersionKey(path);
        if (Object.prototype.hasOwnProperty.call(remoteVersions, key)) {
            target.pathVersions[key] = cloneSyncValue(remoteVersions[key]);
        }
    });
    target.syncClock = Math.max(Number(target.syncClock || 0), Number(remote.syncClock || 0));
    target.revision = Math.max(Number(target.revision || 0), Number(remote.revision || 0));
    target.lastUpdatedAt = Math.max(Number(target.lastUpdatedAt || 0), Number(remote.lastUpdatedAt || 0));
    if (Number(remote.lastUpdatedAt || 0) >= Number(target.lastUpdatedAt || 0)) target.lastUpdatedBy = String(remote.lastUpdatedBy || target.lastUpdatedBy || '');
    return target;
}

function applyRemoteSettlementWhileEditing(remoteRaw) {
    const protection = getActiveSettlementRemoteProtection();
    if (!protection) return false;
    const base = migrateAppData(lastSyncedData || readStoredSyncBase() || {});
    const remote = migrateAppData(remoteRaw || {});
    // Capture the live Carbon values before touching the canonical background state.
    const local = migrateAppData(getData({ skipDomSync: true }));
    const remotePatch = buildSettlementIntentPatch(base, remote);
    const acceptedPatch = {};
    Object.entries(remotePatch).forEach(([path, value]) => {
        const conflictsWithActiveEditor = protection.prefixes.some(prefix => syncPathMatchesPrefix(path, prefix));
        if (!conflictsWithActiveEditor) acceptedPatch[path] = cloneSyncValue(value);
    });
    const acceptedPaths = Object.keys(acceptedPatch);
    if (!acceptedPaths.length) return false;

    // Rebase only non-conflicting settlement paths. The active A-car/settings draft stays local,
    // while a B-car save becomes authoritative immediately instead of waiting for A to close.
    const rebasedLocal = migrateAppData(applyEntityPatchToObject(local, acceptedPatch));
    const hybridBase = migrateAppData(applyEntityPatchToObject(base, acceptedPatch));
    copyAcceptedPathVersions(rebasedLocal, remote, acceptedPaths);
    copyAcceptedPathVersions(hybridBase, remote, acceptedPaths);

    window.SanpoCanonicalState?.set?.(rebasedLocal);
    settlementState = normalizeSettlementState(
        window.SanpoCanonicalState?.settlementToUi?.(rebasedLocal.settlement || {}, rebasedLocal.participants || {})
        || rebasedLocal.settlement || {}
    );
    window.SanpoApp?.state?.setSnapshot?.(rebasedLocal);
    rememberSyncedDataInMemory(hybridBase);
    L.setItem(CFG.STORE + '_' + roomId, J.stringify(rebasedLocal));

    // Keep the complete remote room queued because participant/allocation changes are still
    // deferred until the modal closes. Only settlement paths unrelated to the active editor
    // are painted now.
    rememberPendingRemoteData(remote);
    if (typeof currentView === 'string' && currentView === 'seisan') {
        renderSettlementView({ force: true, preserveSettingsControls: protection.kind === 'settings' });
    }
    updateStatus('connected', protection.kind === 'car' ? '他の車の変更を同期しました' : '他の精算変更を同期しました');
    return true;
}

async function saveImmediate({ snapshot = null, baseSnapshot = null, patchOverride = null } = {}) {
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
    return await commitSnapshotToRemote(canonical, requestVersion, capturedBase, {
        patchOverride: patchOverride && typeof patchOverride === 'object' ? patchOverride : undefined
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

        const wasLegacy = Number(raw.schemaVersion || 1) < APP_SCHEMA_VERSION || !raw.participants || !raw.allocations;
        const hasSharedPresentationLegacy = Object.prototype.hasOwnProperty.call(raw, 'activeAllocationType')
            || Object.prototype.hasOwnProperty.call(raw, 'trayMinimized');
        const remote = migrateAppData(raw);
        if (!lastSyncedData) rememberSyncedData(remote);

        // Settlement editing protects only the path being edited. A different car must keep
        // receiving saves in real time; otherwise A-car input makes B-car saves look lost and
        // leaves the local canonical model stale until A closes the modal.
        if (!syncWriteInFlight && applyRemoteSettlementWhileEditing(remote)) return;

        // Other local interactions still own the visible UI. Queue their remote paint until
        // the interaction completes.
        if (isRemoteUiBlocked()) {
            rememberPendingRemoteData(remote);
            updateStatus('local', window.SanpoRemoteGuard?.isModalOpen?.() ? '編集中のため同期保留' : (isSettlementInputProtected() ? '入力中のため同期保留' : '変更を同期中...'));
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

    // If this pending room came from (or descends from) our own completed request and no
    // newer local save was queued, it already contains the local modal/drag action. Applying
    // it is a rebase, not a conflict. The previous code compared the still-unpainted local UI
    // against the newly advanced sync base, misclassified missing remote fields as local edits,
    // and immediately wrote stale UI back over other phones.
    const pendingAcknowledgesCurrentLocal = pendingRemoteAcknowledgedRequestVersion > 0
        && saveRequestVersion <= pendingRemoteAcknowledgedRequestVersion;
    if (pendingAcknowledgesCurrentLocal) {
        pendingRemoteRoomData = null;
        pendingRemoteSettlementData = null;
        pendingRemoteAcknowledgedRequestVersion = 0;
        applyAuthoritativeRemoteData(pending);
        return;
    }

    const local = getData({ skipDomSync: !!window.__suspendActiveDomPlanSync });
    if (hasLocalChangesSinceBase(local)) {
        save();
        return;
    }
    pendingRemoteRoomData = null;
    pendingRemoteSettlementData = null;
    pendingRemoteAcknowledgedRequestVersion = 0;
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
    if (window.SanpoDeviceRoomUi) L.removeItem(`sanpoRoomUi:v1:${roomId}`);
    L.removeItem(getTrustedDeviceKey());
    if (dbRef) {
        set(dbRef, null).then(() => { location.reload(); }).catch(err => { console.error(err); showAppNotice('リセットに失敗しました。', true); });
    } else location.reload();
};

window.SanpoEntitySyncTest = Object.freeze({ buildEntityPatch, buildSettlementIntentPatch, buildSettlementCarIntentPatch, buildSettlementSettingsIntentPatch, applyEntityPatchToObject, applyVersionedEntityPatch, compareSyncVersions, syncPathVersionKey });
window.SanpoSync = Object.freeze({ saveImmediate, buildSettlementIntentPatch, buildSettlementCarIntentPatch, buildSettlementSettingsIntentPatch });
