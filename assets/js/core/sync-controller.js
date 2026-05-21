// App persistence and remote sync controller.
// Split from app.js during S-4 cleanup.

function save() {
    updateStatus('saving', '保存中...');

    lastUpdatedAt = Date.now();
    const d = getData();
    d.lastUpdatedBy = myClientId;
    d.lastUpdatedAt = lastUpdatedAt;

    L.setItem(CFG.STORE + '_' + roomId, J.stringify(d));
    
    if (!isRemoteUpdate && dbRef) {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => { 
            update(dbRef, {
                roomName: d.roomName,
                waiting: d.waiting,
                cars: d.cars,
                activeCarPlanId: d.activeCarPlanId,
                carPlans: d.carPlans,
                trayMinimized: d.trayMinimized,
                editLockEnabled: d.editLockEnabled,
                editLockPassphrase: d.editLockPassphrase,
                settlement: d.settlement,
                overview: d.overview,
                lastAutoAssignLabel: d.lastAutoAssignLabel,
                schemaVersion: d.schemaVersion,
                lastUpdatedBy: d.lastUpdatedBy,
                lastUpdatedAt: d.lastUpdatedAt
            }).then(() => {
                updateStatus('connected', '同期完了');
            }).catch(e => {
                console.error(e);
                updateStatus('error', '保存失敗');
            }); 
        }, 500);
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
        loadLocalOnly();
        updateStatus('local', 'ローカル保存');
        return;
    }

    onValue(dbRef, (snapshot) => {
        if (isProcessingQueue) return;

        const val = snapshot.val();
        if (val) {
            if (val.lastUpdatedBy === myClientId) {
                return;
            }

            const migrated = migrateAppData(val);
            if (currentView === 'seisan' && isSettlementInputProtected()) {
                pendingRemoteSettlementData = migrated;
                updateStatus('local', '入力中のため同期保留');
                return;
            }

            isRemoteUpdate = true; 
            restore(migrated); 
            isRemoteUpdate = false;
            showMiniToast('他の人が更新しました', 'neutral');
            L.setItem(CFG.STORE + '_' + roomId, J.stringify(val));
        } else {
            const localDataStr = L.getItem(CFG.STORE + '_' + roomId);
            if (localDataStr) {
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
    if (!pendingRemoteSettlementData || isSettlementInputProtected()) return;
    const data = pendingRemoteSettlementData;
    pendingRemoteSettlementData = null;

    const remoteTime = Number(data.lastUpdatedAt || 0);
    const localTime = Number(lastUpdatedAt || 0);
    if (remoteTime && localTime && remoteTime <= localTime) return;

    isRemoteUpdate = true;
    restore(data);
    isRemoteUpdate = false;
    showMiniToast('保留中の同期を反映しました', 'neutral');
    L.setItem(CFG.STORE + '_' + roomId, J.stringify(data));
}

window.resetData = async () => {
    const input = await requestPassphrasePanel('共有データを全消去します。実行するには「リセット」と入力してください。', false);
    if (input !== 'リセット') return;
    L.removeItem(CFG.STORE + '_' + roomId);
    L.removeItem('syawari_history_' + roomId);
    L.removeItem('sanpoOverviewDraft:v1:' + roomId);
    L.removeItem(getTrustedDeviceKey());
    if (dbRef) {
        set(dbRef, null).then(() => { location.reload(); }).catch(err => { console.error(err); showAppNotice('リセットに失敗しました。', true); });
    } else {
        location.reload();
    }
};
