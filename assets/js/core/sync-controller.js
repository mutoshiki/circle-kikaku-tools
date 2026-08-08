// App persistence and remote sync controller.
// Split from app.js during S-4 cleanup.
//
// Multi-user rule:
// - A client must never write fields it did not actually change since its last synced snapshot.
// - Settlement is merged recursively inside a Firebase RTDB transaction so edits to different
//   cars / payment checks can coexist instead of the last writer replacing the whole settlement.
// - Remote updates received while a settlement field is focused are queued and folded into the
//   next transaction, then painted after the local edit is committed.

const ROOM_SYNC_FIELDS = [
    'roomName',
    'waiting',
    'cars',
    'activeCarPlanId',
    'carPlans',
    'trayMinimized',
    'editLockEnabled',
    'editLockPassphrase',
    'editLockScopes',
    'settlement',
    'overview',
    'lastAutoAssignLabel',
    'schemaVersion'
];

const ROOM_DEEP_MERGE_FIELDS = new Set(['settlement', 'overview', 'editLockScopes']);

function cloneSyncValue(value) {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
}

function isPlainSyncObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function syncValuesEqual(a, b) {
    if (a === b) return true;
    if (a === undefined || b === undefined) return false;
    try { return JSON.stringify(a) === JSON.stringify(b); }
    catch (_) { return false; }
}

// Three-way merge: remote is authoritative for paths untouched on this client;
// local wins only for paths that changed from base -> local.
function mergeConcurrentValue(remoteValue, baseValue, localValue) {
    if (syncValuesEqual(localValue, baseValue)) return cloneSyncValue(remoteValue);

    if (isPlainSyncObject(localValue) && isPlainSyncObject(baseValue)) {
        const remoteObject = isPlainSyncObject(remoteValue) ? remoteValue : {};
        const result = cloneSyncValue(remoteObject) || {};
        const keys = new Set([...Object.keys(baseValue), ...Object.keys(localValue)]);

        keys.forEach(key => {
            const localHas = Object.prototype.hasOwnProperty.call(localValue, key);
            const baseHas = Object.prototype.hasOwnProperty.call(baseValue, key);

            if (!localHas && baseHas) {
                delete result[key];
                return;
            }
            if (!localHas) return;
            if (!baseHas) {
                result[key] = cloneSyncValue(localValue[key]);
                return;
            }
            result[key] = mergeConcurrentValue(remoteObject[key], baseValue[key], localValue[key]);
        });
        return result;
    }

    // Arrays are treated as one logical value. This is intentional for an individual
    // car's extras and route stops. Different cars still merge independently one level up.
    return cloneSyncValue(localValue);
}

function getSyncBaseStorageKey() {
    return `${CFG.STORE}_sync_base_${roomId}`;
}

function readStoredSyncBase() {
    try {
        return safeJsonParse(L.getItem(getSyncBaseStorageKey()), null);
    } catch (_) {
        return null;
    }
}

function rememberSyncedData(data) {
    if (!data || typeof data !== 'object') return;
    lastSyncedData = cloneSyncValue(data);
    lastSyncedRevision = Number(data.revision || 0);
    try { L.setItem(getSyncBaseStorageKey(), J.stringify(lastSyncedData)); }
    catch (error) { console.warn('Failed to persist sync base:', error); }
}

function hasLocalChangesSinceBase(localData, baseData = lastSyncedData) {
    if (!localData || !baseData) return true;
    return ROOM_SYNC_FIELDS.some(field => !syncValuesEqual(localData[field], baseData[field]));
}

function buildConcurrentRoomMerge(remoteRaw, baseRaw, localRaw) {
    const remote = remoteRaw && typeof remoteRaw === 'object' ? remoteRaw : {};
    const base = baseRaw && typeof baseRaw === 'object' ? baseRaw : {};
    const local = localRaw && typeof localRaw === 'object' ? localRaw : {};
    const merged = cloneSyncValue(remote) || {};

    ROOM_SYNC_FIELDS.forEach(field => {
        const localValue = local[field];
        const baseValue = base[field];
        if (ROOM_DEEP_MERGE_FIELDS.has(field)) {
            const next = mergeConcurrentValue(remote[field], baseValue, localValue);
            if (next === undefined) delete merged[field];
            else merged[field] = next;
            return;
        }
        if (!syncValuesEqual(localValue, baseValue)) {
            if (localValue === undefined) delete merged[field];
            else merged[field] = cloneSyncValue(localValue);
        }
    });

    merged.schemaVersion = Number(local.schemaVersion || merged.schemaVersion || APP_SCHEMA_VERSION);
    merged.lastUpdatedBy = local.lastUpdatedBy || myClientId;
    merged.lastUpdatedAt = Number(local.lastUpdatedAt || Date.now());
    merged.revision = Math.max(0, Number(remote.revision || 0)) + 1;
    return merged;
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

async function commitSnapshotToRemote(snapshot, requestVersion = saveRequestVersion, capturedBase = null) {
    if (isRemoteUpdate || !dbRef) return null;

    const localSnapshot = cloneSyncValue(snapshot);
    const baseAtWrite = cloneSyncValue(capturedBase || lastSyncedData || readStoredSyncBase() || {});
    syncWriteInFlight = true;

    try {
        let committed;
        if (typeof runTransaction === 'function') {
            const result = await runTransaction(dbRef, currentRemote => {
                return buildConcurrentRoomMerge(currentRemote || {}, baseAtWrite, localSnapshot);
            }, { applyLocally: false });
            if (!result.committed) throw new Error('Firebase transaction was not committed');
            committed = migrateAppData(result.snapshot.val() || {});
        } else {
            // Compatibility fallback. Firebase 10.7.1 exposes runTransaction, so this should
            // normally never be used. It still avoids writing untouched top-level fields.
            const patch = {};
            ROOM_SYNC_FIELDS.forEach(field => {
                if (!syncValuesEqual(localSnapshot[field], baseAtWrite[field])) {
                    patch[field] = cloneSyncValue(localSnapshot[field]);
                }
            });
            patch.lastUpdatedBy = localSnapshot.lastUpdatedBy || myClientId;
            patch.lastUpdatedAt = localSnapshot.lastUpdatedAt || Date.now();
            await update(dbRef, patch);
            committed = { ...(lastSyncedData || {}), ...patch };
        }

        rememberSyncedData(committed);

        const committedRevision = Number(committed.revision || 0);
        const pendingRevision = Number(pendingRemoteSettlementData?.revision || 0);
        const pendingTime = Number(pendingRemoteSettlementData?.lastUpdatedAt || 0);
        const committedTime = Number(committed.lastUpdatedAt || 0);
        if (pendingRemoteSettlementData
            && pendingRevision <= committedRevision
            && (!pendingTime || !committedTime || pendingTime <= committedTime)) {
            pendingRemoteSettlementData = null;
        }

        const isLatestRequest = requestVersion === saveRequestVersion;
        if (isLatestRequest && !isSettlementInputProtected()) {
            // If the transaction merged another person's concurrent work, paint that merged
            // state now. When nothing else changed remotely, avoid an unnecessary full render.
            if (!syncValuesEqual(
                ROOM_SYNC_FIELDS.reduce((acc, field) => { acc[field] = committed[field]; return acc; }, {}),
                ROOM_SYNC_FIELDS.reduce((acc, field) => { acc[field] = localSnapshot[field]; return acc; }, {})
            )) {
                applyAuthoritativeRemoteData(committed);
            } else {
                L.setItem(CFG.STORE + '_' + roomId, J.stringify(committed));
            }
        }

        updateStatus('connected', '同期完了');
        return committed;
    } catch (error) {
        console.error(error);
        updateStatus('error', '保存失敗');
        return null;
    } finally {
        syncWriteInFlight = false;
        if (!isSettlementInputProtected()) queueMicrotask(applyPendingRemoteSettlementData);
    }
}

function queueRemoteSnapshotSave(snapshot, delay = 500) {
    if (isRemoteUpdate || !dbRef) return;
    clearTimeout(saveTimer);
    const requestVersion = ++saveRequestVersion;
    // Capture the base at the moment the local action is made. A remote update may arrive
    // during the debounce window; using a newer base would misclassify that remote change as
    // a local change and could overwrite it.
    const capturedBase = cloneSyncValue(lastSyncedData || readStoredSyncBase() || {});
    saveTimer = setTimeout(() => {
        saveTimer = null;
        void commitSnapshotToRemote(snapshot, requestVersion, capturedBase);
    }, Math.max(0, Number(delay) || 0));
}

function save() {
    updateStatus('saving', '保存中...');

    lastUpdatedAt = Date.now();
    const d = getData({ skipDomSync: !!window.__suspendActiveDomPlanSync });
    d.lastUpdatedBy = myClientId;
    d.lastUpdatedAt = lastUpdatedAt;

    L.setItem(CFG.STORE + '_' + roomId, J.stringify(d));

    if (!isRemoteUpdate && dbRef) {
        queueRemoteSnapshotSave(d, 500);
    } else if (!isRemoteUpdate) {
        setTimeout(() => updateStatus('local', 'ローカル保存済み'), 180);
    }
}

function load() {
    const loadLocalOnly = () => {
        const localDataStr = L.getItem(CFG.STORE + '_' + roomId);
        if (localDataStr) {
            isRemoteUpdate = true;
            restore(migrateAppData(JSON.parse(localDataStr)));
            isRemoteUpdate = false;
        } else {
            $('#roomNameInput').value = '';
            $('#waiting-list').innerHTML = '';
            $('#cars-container').innerHTML = '';
            editLockEnabled = false;
            editLockPassphrase = '';
            editLockScopes = { allocation: false, settlement: false };
            carPlans = [];
            activeCarPlanId = 'plan-1';
            lastAutoAssignLabel = '';
            renderCarPlanSwitcher?.();
            rememberTrustedDevice('');
            updateEditLockButton();
            refreshRoomTitle();
            updateUI();
            L.removeItem(CFG.STORE + '_' + roomId);
        }
    };

    if (!dbRef) {
        if (!lastSyncedData) lastSyncedData = readStoredSyncBase();
        loadLocalOnly();
        updateStatus('local', 'ローカル保存');
        hideAppLoadingSkeleton?.();
        return;
    }

    onValue(dbRef, (snapshot) => {
        if (isProcessingQueue) return;
        hideAppLoadingSkeleton?.();

        const val = snapshot.val();
        if (val) {
            const migrated = migrateAppData(val);
            const localDataStr = L.getItem(CFG.STORE + '_' + roomId);
            const localData = localDataStr ? safeJsonParse(localDataStr, null) : null;
            const localTime = Number(localData?.lastUpdatedAt || 0);
            const remoteTime = Number(migrated.lastUpdatedAt || 0);

            // If this tab has an unsynced local draft after a reload, compare it to the
            // *previous synced base*, not the newest remote snapshot. This lets the transaction
            // send only the actual draft changes and preserves changes made by other devices.
            if (!lastSyncedData) lastSyncedData = cloneSyncValue(readStoredSyncBase() || migrated);
            if (!lastSyncedRevision) lastSyncedRevision = Number(lastSyncedData?.revision || 0);

            if (localData && localTime > remoteTime && !syncWriteInFlight) {
                isRemoteUpdate = true;
                restore(migrateAppData(localData));
                isRemoteUpdate = false;
                updateStatus('saving', 'ローカル変更を同期中...');
                save();
                return;
            }

            if (migrated.lastUpdatedBy === myClientId) {
                rememberSyncedData(migrated);
                return;
            }

            if (currentView === 'seisan' && isSettlementInputProtected()) {
                pendingRemoteSettlementData = migrated;
                updateStatus('local', '入力中のため同期保留');
                return;
            }

            applyAuthoritativeRemoteData(migrated);
        } else {
            const localDataStr = L.getItem(CFG.STORE + '_' + roomId);
            if (localDataStr) {
                if (!lastSyncedData) lastSyncedData = readStoredSyncBase() || {};
                isRemoteUpdate = true;
                restore(migrateAppData(JSON.parse(localDataStr)));
                isRemoteUpdate = false;
                save();
            } else {
                $('#roomNameInput').value = '';
                $('#waiting-list').innerHTML = '';
                $('#cars-container').innerHTML = '';
                editLockEnabled = false;
                editLockPassphrase = '';
                editLockScopes = { allocation: false, settlement: false };
                carPlans = [];
                activeCarPlanId = 'plan-1';
                lastAutoAssignLabel = '';
                renderCarPlanSwitcher?.();
                updateLastAutoAssignCondition();
                rememberTrustedDevice('');
                updateEditLockButton();
                refreshRoomTitle();
                updateUI();
                L.removeItem(CFG.STORE + '_' + roomId);
            }
        }
    });
}

function applyPendingRemoteSettlementData() {
    if (!pendingRemoteSettlementData || isSettlementInputProtected() || syncWriteInFlight || saveTimer) return;

    const pending = pendingRemoteSettlementData;
    const pendingRevision = Number(pending.revision || 0);
    const pendingTime = Number(pending.lastUpdatedAt || 0);
    const baseTime = Number(lastSyncedData?.lastUpdatedAt || 0);
    if (pendingRevision < lastSyncedRevision
        || (pendingRevision === lastSyncedRevision && pendingTime && baseTime && pendingTime <= baseTime)) {
        pendingRemoteSettlementData = null;
        return;
    }

    const local = getData({ skipDomSync: !!window.__suspendActiveDomPlanSync });
    if (hasLocalChangesSinceBase(local)) {
        // Do not choose between local and remote here. The transaction is the merge point.
        save();
        return;
    }

    pendingRemoteSettlementData = null;
    applyAuthoritativeRemoteData(pending);
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
    } else {
        location.reload();
    }
};
