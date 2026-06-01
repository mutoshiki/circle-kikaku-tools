// Sheet quick-edit snapshot persistence and visible-plan synchronization.

function buildSheetCommittedSnapshot() {
    const snapshot = getData({ skipDomSync: true });
    lastUpdatedAt = Date.now();
    snapshot.lastUpdatedBy = myClientId;
    snapshot.lastUpdatedAt = lastUpdatedAt;
    window.SanpoApp?.state?.setSnapshot?.(snapshot);
    return snapshot;
}

function writeSheetSnapshotToLocal(snapshot) {
    try {
        L.setItem(CFG.STORE + '_' + roomId, J.stringify(snapshot));
    } catch (error) {
        console.warn('Failed to persist sheet quick edit locally:', error);
    }
}

function scheduleSheetSnapshotRemoteSave(snapshot) {
    if (isRemoteUpdate || !dbRef || typeof update !== 'function') return;
    clearTimeout(saveTimer);
    const payload = {
        roomName: snapshot.roomName,
        waiting: snapshot.waiting,
        cars: snapshot.cars,
        activeCarPlanId: snapshot.activeCarPlanId,
        carPlans: snapshot.carPlans,
        trayMinimized: snapshot.trayMinimized,
        editLockEnabled: snapshot.editLockEnabled,
        editLockPassphrase: snapshot.editLockPassphrase,
        settlement: snapshot.settlement,
        overview: snapshot.overview,
        lastAutoAssignLabel: snapshot.lastAutoAssignLabel,
        schemaVersion: snapshot.schemaVersion,
        lastUpdatedBy: snapshot.lastUpdatedBy,
        lastUpdatedAt: snapshot.lastUpdatedAt
    };
    updateStatus('saving', '保存中...');
    saveTimer = setTimeout(() => {
        update(dbRef, payload).then(() => {
            updateStatus('connected', '同期完了');
        }).catch(error => {
            console.error(error);
            updateStatus('error', '保存失敗');
        });
    }, 80);
}

function persistSheetCommittedSnapshot() {
    const previousSuspend = !!window.__suspendActiveDomPlanSync;
    window.__suspendActiveDomPlanSync = true;
    try {
        const snapshot = buildSheetCommittedSnapshot();
        writeSheetSnapshotToLocal(snapshot);
        scheduleSheetSnapshotRemoteSave(snapshot);
        return snapshot;
    } finally {
        window.__suspendActiveDomPlanSync = previousSuspend;
    }
}

function clearSheetSortables() {
    activeSheetSortable.forEach(instance => {
        try { instance.destroy(); } catch (e) {}
    });
    activeSheetSortable = [];
}

function findMemberCardByName(name) {
    return Array.from($$('.member-card')).find(card => card.dataset.name === name);
}

function moveCardToSheetLocation(card, zone) {
    if (!card || !zone) return;
    const type = zone.dataset.zoneType;
    if (type === 'waiting') {
        $('#waiting-list').appendChild(card);
        return;
    }
    const carName = zone.dataset.carName;
    const slotIndex = parseInt(zone.dataset.slotIndex, 10);
    const targetCar = Array.from($$('.car-box')).find(box => $('.driver-name-disp', box)?.innerText === carName);
    if (!targetCar) return;
    const slots = $$('.seat-slot', targetCar);
    const targetSlot = slots[slotIndex];
    if (!targetSlot) return;

    const existing = Array.from(targetSlot.children).find(child => child !== card);
    if (existing) {
        if (card.parentElement && card.parentElement.id === 'waiting-list') {
            $('#waiting-list').appendChild(existing);
        } else if (card.parentElement && card.parentElement.classList.contains('seat-slot')) {
            card.parentElement.appendChild(existing);
        } else {
            $('#waiting-list').appendChild(existing);
        }
    }
    targetSlot.appendChild(card);
}

function syncSheetSectionToActiveDom(section) {
    if (!section) return;
    const names = new Set();
    section.querySelectorAll('.sheet-dropzone .sheet-chip, .sheet-waiting-list .sheet-chip').forEach(chip => {
        const name = chip.dataset.name;
        if (!name || names.has(name)) return;
        names.add(name);
        const card = findMemberCardByName(name);
        if (card && card.dataset.locked !== 'true') {
            moveCardToSheetLocation(card, chip.parentElement);
        }
    });
}

function getSheetPlanMemberRegistry(plan = {}) {
    const registry = new Map();
    const put = member => {
        const name = String(member?.name || '').trim();
        if (!name || registry.has(name)) return;
        registry.set(name, {
            name,
            memo: member.memo || '',
            gender: member.gender || 'unknown',
            grade: parseInt(member.grade) || 0,
            locked: !!member.locked
        });
    };
    (plan.cars || []).forEach(car => {
        put({
            name: car.name,
            memo: car.driverMemo || '',
            gender: car.driverGender || 'unknown',
            grade: car.driverGrade || 0,
            locked: false
        });
        (car.members || []).forEach(put);
    });
    (plan.waiting || []).forEach(put);
    return registry;
}

function getMemberFromSheetChip(chip, registry) {
    const name = String(chip?.dataset?.name || '').trim();
    if (!name) return null;
    const base = registry.get(name) || {};
    return {
        name,
        memo: base.memo || '',
        gender: base.gender || chip.dataset.gender || 'unknown',
        grade: parseInt(base.grade) || 0,
        locked: base.locked || chip.dataset.locked === 'true'
    };
}

function syncSheetSectionToPlan(section) {
    const planId = section?.dataset?.planId;
    if (!planId || !Array.isArray(carPlans)) return;
    const plan = carPlans.find(item => item.id === planId);
    if (!plan) return;
    const registry = getSheetPlanMemberRegistry(plan);

    const columns = Array.from(section.querySelectorAll('.sheet-plan-table > .sheet-car-col'));
    const nextCars = (plan.cars || []).map((car, index) => {
        const column = columns[index];
        const members = [];
        if (column) {
            column.querySelectorAll('.sheet-dropzone[data-zone-type="seat"]').forEach(zone => {
                const chip = getSheetZoneChip(zone);
                members.push(chip ? getMemberFromSheetChip(chip, registry) : null);
            });
        } else {
            (car.members || []).forEach(member => members.push(member || null));
        }
        return {
            ...car,
            capacity: parseInt(car.capacity) || members.length || 0,
            members
        };
    });

    const waitZone = section.querySelector('.sheet-waiting-list[data-zone-type="waiting"]');
    const nextWaiting = waitZone
        ? Array.from(waitZone.querySelectorAll(':scope > .sheet-chip'))
            .map(chip => getMemberFromSheetChip(chip, registry))
            .filter(Boolean)
        : (plan.waiting || []);

    plan.cars = cloneData(nextCars);
    plan.waiting = cloneData(nextWaiting);
    plan.updatedAt = Date.now();
}

function hasSheetPlanContent(plans = carPlans) {
    return Array.isArray(plans) && plans.some(plan =>
        (Array.isArray(plan?.cars) && plan.cars.length > 0) ||
        (Array.isArray(plan?.waiting) && plan.waiting.length > 0)
    );
}

function hasRenderedSheetPlanContent(root = byId('sheet-canvas')) {
    if (!root) return false;
    const sections = Array.from(root.querySelectorAll('.sheet-plan-section[data-plan-id]:not(.sheet-timetable-section)'));
    return sections.some(section =>
        !!section.querySelector('.sheet-plan-table > .sheet-car-col, .sheet-wait-block .sheet-chip, .sheet-wait-block .sheet-wait-item')
    );
}

function syncSheetToMainData({ refresh = true, persist = true } = {}) {
    const options = arguments[0] || {};
    const syncHiddenDom = options.syncHiddenDom !== false;
    const previousPlans = cloneData(carPlans || []);
    const previousOverview = window.SanpoOverview?.getSnapshot?.() || window.SanpoApp?.state?.getSnapshot?.()?.overview || {};
    const hadPlanContent = hasSheetPlanContent(previousPlans);
    const canvas = byId('sheet-canvas');
    const sectionRoot = canvas || document;
    const sections = Array.from(sectionRoot.querySelectorAll('.sheet-plan-section[data-plan-id]:not(.sheet-timetable-section)'));

    if (currentView === 'sheet' && hadPlanContent && !sections.length) {
        throw new Error('Sheet quick edit commit skipped: no plan sections were found.');
    }

    try {
        // 発表ビュー上の並びを唯一の正として、車割・班割の両方を carPlans に直接反映する。
        // 非表示の通常編集画面DOMは古いことがあるため、先に発表ビューDOMを carPlans へ確定する。
        sections.forEach(syncSheetSectionToPlan);
        syncSheetTimetableToOverview();

        if (hadPlanContent && !hasSheetPlanContent(carPlans)) {
            throw new Error('Sheet quick edit commit produced an empty plan set.');
        }
    } catch (error) {
        carPlans = cloneData(previousPlans);
        window.SanpoOverview?.applySnapshot?.(previousOverview, { skipRender: true });
        throw error;
    }

    const previousSuspend = !!window.__suspendActiveDomPlanSync;
    window.__suspendActiveDomPlanSync = true;
    try {
        if (persist) persistSheetCommittedSnapshot();
        if (syncHiddenDom && typeof renderActiveCarPlanToDom === 'function') {
            renderActiveCarPlanToDom({ skipUpdate: true });
        }
        if (refresh) updateUI();
    } finally {
        window.__suspendActiveDomPlanSync = previousSuspend;
    }
}
