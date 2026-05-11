// Data/state feature
// Owns app snapshot serialization, restoration, and small card state toggles.

function getData() {
    const snapshot = {
        schemaVersion: APP_SCHEMA_VERSION,
        roomName: $('#roomNameInput').value,
        trayMinimized: byId("bottom-tray")
                           .classList.contains("minimized"),
        editLockEnabled,
        editLockPassphrase,
        lastAutoAssignLabel,

        waiting: Array.from($$('#waiting-list .member-card')).map(getMemData),
        cars: Array.from($$('.car-box')).map(c => ({
            name: $('.driver-name-disp', c).innerText,
            capacity: c.dataset.capacity,
            driverMemo: $('.driver-memo-text', c).innerText,
            driverGender: $('.driver-seat', c).dataset.gender,
            driverGrade: parseInt($('.driver-seat', c).dataset.grade)||0,
            members: Array.from($$('.seat-slot', c)).flatMap(s => getRealSeatCards(s).map(getMemData))
        })),
        settlement: getSettlementSnapshot(),
        lastUpdatedAt
    };
    window.SanpoApp?.state?.setSnapshot?.(snapshot);
    return snapshot;
}
function getMemData(el) {
    return {
        name: el.dataset.name, memo: $('.memo-popup', el).innerText,
        gender: el.dataset.gender, grade: parseInt(el.dataset.grade)||0, locked: el.dataset.locked === 'true'
    };
}

function restore(d) {
    window.SanpoApp?.state?.setSnapshot?.(d);
    lastUpdatedAt = Number(d.lastUpdatedAt || 0) || lastUpdatedAt;
    settlementState = normalizeSettlementState(d.settlement || settlementState || {});
    $('#roomNameInput').value = d.roomName || '';
    editLockEnabled = !!d.editLockEnabled;
    editLockPassphrase = d.editLockPassphrase || '';
    lastAutoAssignLabel = d.lastAutoAssignLabel || '';
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

    $('#waiting-list').innerHTML = '';
    $('#cars-container').innerHTML = '';
    (d.waiting||[]).forEach(m => addMember(m.name, m.memo, m.gender, m.grade||0, $('#waiting-list'), m.locked));
    (d.cars||[]).forEach(c => addCar(c.name, c.capacity, c.members, c.driverMemo, c.driverGender, c.driverGrade || 0));
    updateUI();
    if (currentView === 'seisan') renderSettlementView();
}

async function clearAll() {
    if(!await appConfirm('配置済みのメンバーを未割り当てメンバーに戻します。固定済みの人は残します。実行しますか？', { title: '全員を未割り当てへ', okText: '実行' })) return;
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


window.SanpoApp?.registerRenderers?.({
    restoreAppState: restore,
    captureAppState: getData
});
