// Sheet view feature
// Owns view switching, announcement sheet rendering, quick edit drag, pan and zoom.

let currentView = 'sheet';
async function switchView(view) {
    if (view !== 'sheet' && editLockEnabled && !hasTrustedEditAccess()) {
        const label = view === 'seisan' ? '精算' : '編集';
        if (!(await verifyEditPassphrase(`${label}を開くには合言葉を入力してください`))) return;
    }
    currentView = view;
    const listArea = byId('top-area');
    const sheetArea = byId('sheet-view-area');
    const bottomTray = byId('bottom-tray');
    const tabList = byId('tab-list');
    const tabSheet = byId('tab-sheet');
    const tabSeisan = byId('tab-seisan');
    const seisanArea = byId('seisan-view-area');

    if (view === 'seisan') {
        document.body.classList.remove('sheet-mode');
        listArea.style.display = 'none';
        bottomTray.style.display = 'none';
        sheetArea.classList.remove('active');
        seisanArea.classList.add('active');
        tabList.classList.remove('active');
        tabSheet.classList.remove('active');
        tabSeisan.classList.add('active');
        updateQuickEditButton();
        renderSettlementView();
        return;
    }

    seisanArea.classList.remove('active');
    tabSeisan.classList.remove('active');

    if (view === 'sheet') {
        document.body.classList.add('sheet-mode');
        listArea.style.display = 'none';
        bottomTray.style.display = 'none';
        sheetArea.classList.add('active');
        tabList.classList.remove('active');
        tabSheet.classList.add('active');
        updateQuickEditButton();
        renderSheetView();
        showSheetHint();
    } else {
        document.body.classList.remove('sheet-mode');
        listArea.style.display = '';
        bottomTray.style.display = '';
        sheetArea.classList.remove('active');
        tabList.classList.add('active');
        tabSheet.classList.remove('active');
        updateQuickEditButton();
    }
}
window.switchView = switchView;

function showSheetHint() {
    const hint = byId('sheet-hint');
    hint.classList.add('visible');
    setTimeout(() => hint.classList.remove('visible'), 3000);
}

function isSheetDragHandle(target) {
    return quickEditMode && hasTrustedEditAccess() && !!target.closest('.sheet-chip.draggable, .sheet-dropzone, .sheet-waiting-list');
}

function isSheetInteractiveTarget(target) {
    return !!target?.closest?.('button, a, input, textarea, select, [role="button"]');
}

function renderSheetPlain(member) {
    return window.SanpoApp.templates.sheet.plainMember(member, { escapeHtml, renderGradeBadge });
}

function renderSheetChip(member) {
    return window.SanpoApp.templates.sheet.memberChip(member, {
        escapeHtml,
        renderGradeBadge,
        isDraggable: currentMember => !currentMember.locked && hasTrustedEditAccess() && quickEditMode
    });
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

function syncSheetToMainData() {
    const sections = Array.from(document.querySelectorAll('.sheet-plan-section[data-plan-id]'))
        .filter(section => !section.classList.contains('sheet-timetable-section'));
    const activeSection = sections.find(section => section.dataset.planId === activeCarPlanId);
    if (activeSection) {
        syncSheetSectionToActiveDom(activeSection);
        syncActiveCarPlanFromDom();
    }
    sections
        .filter(section => section.dataset.planId !== activeCarPlanId)
        .forEach(syncSheetSectionToPlan);
    updateUI();
    save();
}

function getSheetZoneChip(zone, excluded = []) {
    return Array.from(zone?.children || []).find(child =>
        child.classList?.contains('sheet-chip') &&
        !child.classList.contains('manual-sheet-drag-float') &&
        !excluded.includes(child)
    ) || null;
}

function clearSheetZoneText(zone) {
    if (!zone || zone.dataset.zoneType !== 'seat') return;
    Array.from(zone.childNodes).forEach(node => {
        if (node.nodeType === Node.TEXT_NODE) node.remove();
    });
}

function getManualSheetDropZone(clientX, clientY) {
    const el = document.elementFromPoint(clientX, clientY);
    if (!el) return null;
    return el.closest('.sheet-dropzone, .sheet-waiting-list');
}

function moveManualSheetChipTo(zone) {
    if (!manualSheetDrag) return;
    if ((zone || null) === (manualSheetDrag.dropZone || null)) return;
    document.querySelectorAll('.drop-target').forEach(el => el.classList.remove('drop-target'));
    manualSheetDrag.dropZone = null;
    if (!zone || !zone.isConnected) return;
    const zonePlanId = zone.closest('.sheet-plan-section')?.dataset?.planId || '';
    if (manualSheetDrag.planId && zonePlanId !== manualSheetDrag.planId) return;
    if (zone.dataset.acceptDrop === 'false') return;
    manualSheetDrag.dropZone = zone;
    zone.closest('.sheet-seat-row, .sheet-driver-row')?.classList.add('drop-target');
}

function commitManualSheetDrop() {
    if (!manualSheetDrag) return;
    const chip = manualSheetDrag.chip;
    const zone = manualSheetDrag.dropZone;
    if (!zone || !zone.isConnected) return;
    if (zone.dataset.acceptDrop === 'false') return;
    if (zone === manualSheetDrag.currentZone) return;

    if (zone.dataset.zoneType === 'waiting') {
        zone.appendChild(chip);
        manualSheetDrag.currentZone = zone;
        return;
    }

    if (zone.dataset.zoneType !== 'seat') return;
    const current = manualSheetDrag.currentZone;
    const occupant = getSheetZoneChip(zone, [chip]);
    clearSheetZoneText(zone);

    if (occupant) {
        if (current?.dataset?.zoneType === 'seat') {
            clearSheetZoneText(current);
            current.appendChild(occupant);
        } else if (current?.dataset?.zoneType === 'waiting') {
            current.appendChild(occupant);
        }
    }

    zone.appendChild(chip);
    manualSheetDrag.currentZone = zone;
}

function updateManualSheetFloat(clientX, clientY) {
    if (!manualSheetDrag?.floating) return;
    const left = clientX - manualSheetDrag.offsetX;
    const top = clientY - manualSheetDrag.offsetY;
    if (!Number.isFinite(left) || !Number.isFinite(top)) return;
    manualSheetDrag.floating.style.left = `${left}px`;
    manualSheetDrag.floating.style.top = `${top}px`;
    manualSheetDrag.floating.style.transform = 'scale(1.03)';
}

function finishManualSheetDrag(commit = true) {
    if (!manualSheetDrag) return;
    const { chip, floating } = manualSheetDrag;
    if (commit) commitManualSheetDrop();
    floating?.remove();
    chip.classList.remove('manual-sheet-drag-source');
    D.body.classList.remove('manual-sheet-dragging');
    manualSheetDrag = null;
    isDraggingCards = false;
    document.querySelectorAll('.drop-target').forEach(el => el.classList.remove('drop-target'));
    syncSheetToMainData();
}

function startManualSheetDrag(chip, point) {
    if (manualSheetDrag || !chip?.isConnected) return;
    const currentZone = chip.parentElement;
    if (!(currentZone?.classList?.contains('sheet-dropzone') || currentZone?.classList?.contains('sheet-waiting-list'))) return;

    const rect = chip.getBoundingClientRect();
    const clientX = getFinitePointerCoord(point, 'clientX', rect.left + rect.width / 2);
    const clientY = getFinitePointerCoord(point, 'clientY', rect.top + rect.height / 2);
    const floating = chip.cloneNode(true);
    floating.classList.add('manual-sheet-drag-float');
    floating.style.width = `${rect.width}px`;
    floating.style.height = `${rect.height}px`;
    D.body.appendChild(floating);

    manualSheetDrag = {
        chip,
        floating,
        currentZone,
        planId: currentZone.closest('.sheet-plan-section')?.dataset?.planId || '',
        pointerId: point?.pointerId ?? null,
        pointerType: point?.pointerType || (point?.touchIdentifier != null ? 'touch' : 'mouse'),
        touchIdentifier: point?.touchIdentifier ?? null,
        offsetX: clampDragOffset(clientX - rect.left, rect.width, 6),
        offsetY: clampDragOffset(clientY - rect.top, rect.height, 6)
    };

    try { if (manualSheetDrag.pointerId != null) chip.setPointerCapture?.(manualSheetDrag.pointerId); } catch (_) {}
    chip.classList.add('manual-sheet-drag-source');
    D.body.classList.add('manual-sheet-dragging');
    isDraggingCards = true;
    updateManualSheetFloat(clientX, clientY);
}

function setupManualSheetDrag() {
    let pending = null;
    const touchDelay = 260;
    const mouseDelay = 55;
    const touchMoveCancel = 22;

    const canStartFromTarget = target => {
        if (currentView !== 'sheet' || !quickEditMode || !hasTrustedEditAccess()) return null;
        const chip = target.closest?.('.sheet-chip.draggable');
        if (!chip || chip.classList.contains('manual-sheet-drag-float')) return null;
        const zone = chip.parentElement;
        if (!(zone?.classList?.contains('sheet-dropzone') || zone?.classList?.contains('sheet-waiting-list'))) return null;
        return chip;
    };

    const clearPending = () => {
        clearTimeout(pending?.timer);
        pending = null;
    };

    const findTouch = (touchList, identifier) => Array.from(touchList || []).find(t => t.identifier === identifier) || null;

    D.addEventListener('pointerdown', e => {
        if (e.pointerType === 'touch') return;
        if (e.button !== undefined && e.button !== 0) return;
        const chip = canStartFromTarget(e.target);
        if (!chip) return;

        e.preventDefault();
        e.stopPropagation();
        chip.setPointerCapture?.(e.pointerId);
        clearPending();
        const nextPending = {
            chip,
            pointerId: e.pointerId,
            touchIdentifier: null,
            startX: e.clientX,
            startY: e.clientY,
            clientX: e.clientX,
            clientY: e.clientY,
            pointerType: e.pointerType,
            timer: null
        };
        nextPending.timer = setTimeout(() => startManualSheetDrag(chip, nextPending), mouseDelay);
        pending = nextPending;
    }, { passive: false });

    D.addEventListener('pointermove', e => {
        if (e.pointerType === 'touch') return;
        if (pending && pending.pointerId === e.pointerId && !manualSheetDrag) {
            pending.clientX = e.clientX;
            pending.clientY = e.clientY;
            const moved = window.SanpoDrag?.distance?.(pending.startX, pending.startY, e.clientX, e.clientY) ?? Math.hypot(e.clientX - pending.startX, e.clientY - pending.startY);
            if (moved > 8) startManualSheetDrag(pending.chip, pending);
        }
        if (!manualSheetDrag || manualSheetDrag.pointerId !== e.pointerId) return;
        e.preventDefault();
        updateManualSheetFloat(e.clientX, e.clientY);
        const zone = getManualSheetDropZone(e.clientX, e.clientY);
        moveManualSheetChipTo(zone);
    }, { passive: false });

    const cancelPointerPending = e => {
        if (pending && pending.pointerId === e.pointerId) clearPending();
    };

    D.addEventListener('pointerup', e => {
        if (e.pointerType === 'touch') return;
        cancelPointerPending(e);
        if (manualSheetDrag && manualSheetDrag.pointerId === e.pointerId) finishManualSheetDrag(true);
    }, { passive: true });
    D.addEventListener('pointercancel', e => {
        if (e.pointerType === 'touch') return;
        cancelPointerPending(e);
        if (manualSheetDrag && manualSheetDrag.pointerId === e.pointerId) finishManualSheetDrag(false);
    }, { passive: true });

    D.addEventListener('touchstart', e => {
        if (e.touches.length !== 1) return;
        const touch = e.changedTouches?.[0];
        if (!touch) return;
        const chip = canStartFromTarget(e.target);
        if (!chip) return;

        clearPending();
        const nextPending = {
            chip,
            pointerId: null,
            touchIdentifier: touch.identifier,
            startX: touch.clientX,
            startY: touch.clientY,
            clientX: touch.clientX,
            clientY: touch.clientY,
            pointerType: 'touch',
            timer: null
        };
        nextPending.timer = setTimeout(() => startManualSheetDrag(chip, nextPending), touchDelay);
        pending = nextPending;
    }, { passive: false });

    D.addEventListener('touchmove', e => {
        if (pending && pending.pointerType === 'touch' && !manualSheetDrag) {
            const touch = findTouch(e.touches, pending.touchIdentifier);
            if (!touch) return;
            pending.clientX = touch.clientX;
            pending.clientY = touch.clientY;
            const moved = window.SanpoDrag?.distance?.(pending.startX, pending.startY, touch.clientX, touch.clientY) ?? Math.hypot(touch.clientX - pending.startX, touch.clientY - pending.startY);
            if (moved > touchMoveCancel) {
                clearPending();
                return;
            }
        }

        if (!manualSheetDrag || manualSheetDrag.pointerType !== 'touch') return;
        const touch = findTouch(e.touches, manualSheetDrag.touchIdentifier);
        if (!touch) return;
        e.preventDefault();
        e.stopPropagation();
        updateManualSheetFloat(touch.clientX, touch.clientY);
        const zone = getManualSheetDropZone(touch.clientX, touch.clientY);
        moveManualSheetChipTo(zone);
    }, { passive: false });

    D.addEventListener('touchend', e => {
        if (pending && pending.pointerType === 'touch' && findTouch(e.changedTouches, pending.touchIdentifier)) clearPending();
        if (manualSheetDrag?.pointerType === 'touch' && findTouch(e.changedTouches, manualSheetDrag.touchIdentifier)) finishManualSheetDrag(true);
    }, { passive: true });

    D.addEventListener('touchcancel', e => {
        if (pending && pending.pointerType === 'touch' && findTouch(e.changedTouches, pending.touchIdentifier)) clearPending();
        if (manualSheetDrag?.pointerType === 'touch' && findTouch(e.changedTouches, manualSheetDrag.touchIdentifier)) finishManualSheetDrag(false);
    }, { passive: true });
}

function setupSheetSortables() {
    clearSheetSortables();
    // 発表ビューのクイック編集も setupManualSheetDrag() に一本化しています。
    // 旧 Sortable 実装はスクロール・ピンチ操作と競合するため、ここでは初期化しません。
    return null;
}


function renderSheetEmptyHtml() {
    return window.SanpoApp.templates.sheet.empty();
}

function createSheetLabelColumn(maxSeats, template) {
    const labelCol = document.createElement('div');
    labelCol.className = 'sheet-car-col sheet-label-col';
    labelCol.innerHTML = window.SanpoApp.templates.sheet.labelColumn(maxSeats, template);
    return labelCol;
}

function renderSheetCarColumnHtml(car, maxSeats, template, isEditablePlan, groupIndex = 0) {
    return window.SanpoApp.templates.sheet.carColumn({
        car,
        maxSeats,
        template,
        groupIndex,
        quickEditMode: quickEditMode && isEditablePlan,
        helpers: {
            escapeHtml,
            renderGradeBadge,
            isDraggable: currentMember => !currentMember.locked && hasTrustedEditAccess() && quickEditMode
        }
    });
}

function createSheetCarColumn(car, maxSeats, template, isEditablePlan, groupIndex = 0) {
    const col = document.createElement('div');
    col.className = 'sheet-car-col';
    col.innerHTML = renderSheetCarColumnHtml(car, maxSeats, template, isEditablePlan, groupIndex);
    return col;
}

function renderSheetWaitingHtml(data, isEditablePlan) {
    return window.SanpoApp.templates.sheet.waitingColumn({
        data,
        quickEditMode: quickEditMode && isEditablePlan,
        helpers: {
            escapeHtml,
            renderGradeBadge,
            isDraggable: currentMember => !currentMember.locked && hasTrustedEditAccess() && quickEditMode
        }
    });
}

function createSheetWaitingColumn(data, isEditablePlan) {
    const waitCol = document.createElement('div');
    waitCol.className = 'sheet-wait-block';
    waitCol.innerHTML = renderSheetWaitingHtml(data, isEditablePlan);
    return waitCol;
}

function createSheetPlanSection(plan, index) {
    const template = typeof getCarPlanTemplateConfig === 'function'
        ? getCarPlanTemplateConfig(plan)
        : { sectionTitle: '車割', ownerLabel: '車出し', memberLabel: '席', groupSuffix: '車', ownerIcon: 'fa-car' };
    const section = document.createElement('section');
    section.className = 'sheet-plan-section';
    section.dataset.planId = plan.id || `plan-${index}`;

    const displayName = String(plan.name || template.sectionTitle || '').trim() || template.sectionTitle;
    const heading = document.createElement('div');
    heading.className = 'sheet-plan-heading';
    heading.textContent = template.sectionTitle;
    section.appendChild(heading);

    const cars = Array.isArray(plan.cars) ? plan.cars : [];
    const waiting = Array.isArray(plan.waiting) ? plan.waiting : [];
    const isEditablePlan = true;

    if (cars.length) {
        const maxSeats = Math.max(1, ...cars.map(c => parseInt(c.capacity) || 0));
        const table = document.createElement('div');
        table.className = 'sheet-plan-table';
        // 発表ビューでは左端の行見出し列（車割 / 車出し / 席1...、班 / 班員1...）を出さず、
        // 各カード列を左端から並べる。
        cars.forEach((car, carIndex) => table.appendChild(createSheetCarColumn(car, maxSeats, template, isEditablePlan, carIndex)));
        section.appendChild(table);
    }

    if (waiting.length) {
        section.appendChild(createSheetWaitingColumn({ waiting }, isEditablePlan));
    }

    if (!cars.length && !waiting.length) {
        const empty = document.createElement('div');
        empty.className = 'sheet-plan-empty';
        empty.textContent = 'まだ配置がありません';
        section.appendChild(empty);
    }

    return section;
}


function getSheetTimetableItems() {
    const snapshot = window.SanpoOverview?.getSnapshot?.() || window.SanpoApp?.state?.getSnapshot?.()?.overview || {};
    const items = Array.isArray(snapshot.timetableItems) ? snapshot.timetableItems : [];
    return items
        .map(item => ({
            time: String(item?.time || '').trim(),
            title: String(item?.title || '').trim()
        }))
        .filter(item => item.time || item.title);
}

function linkifySheetTimetableText(value = '') {
    const text = String(value || '');
    const urlPattern = /https?:\/\/[^\s<>"]+/gi;
    let html = '';
    let lastIndex = 0;
    for (const match of text.matchAll(urlPattern)) {
        const url = match[0];
        const index = match.index || 0;
        html += escapeHtml(text.slice(lastIndex, index));
        try {
            const parsed = new URL(url);
            if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
                const safeUrl = escapeHtml(url);
                html += `<a class="sheet-timetable-link" href="${safeUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a>`;
            } else {
                html += escapeHtml(url);
            }
        } catch {
            html += escapeHtml(url);
        }
        lastIndex = index + url.length;
    }
    html += escapeHtml(text.slice(lastIndex));
    return html;
}

function createSheetTimetableSection() {
    const items = getSheetTimetableItems();
    if (!items.length) return null;
    const section = document.createElement('section');
    section.className = 'sheet-plan-section sheet-timetable-section';
    section.innerHTML = `
        <div class="sheet-plan-heading sheet-timetable-heading">タイムテーブル</div>
        <div class="sheet-timetable-card">
            ${items.map(item => `
                <div class="sheet-timetable-row">
                    <div class="sheet-timetable-time">${item.time ? escapeHtml(item.time) : '—'}</div>
                    <div class="sheet-timetable-title">${linkifySheetTimetableText(item.title)}</div>
                </div>
            `).join('')}
        </div>`;
    return section;
}

function syncSheetPlanWidths() {
    let widestPlanWidth = 0;
    document.querySelectorAll('.sheet-plan-section:not(.sheet-timetable-section)').forEach(section => {
        const table = section.querySelector('.sheet-plan-table');
        const waitBlock = section.querySelector('.sheet-wait-block');
        if (!table || !waitBlock) return;
        const width = Math.ceil(table.scrollWidth || table.offsetWidth || 0);
        if (width > 0) {
            widestPlanWidth = Math.max(widestPlanWidth, width);
            section.style.setProperty('--sheet-plan-width', `${width}px`);
            waitBlock.style.width = `${width}px`;
        }
    });
    const canvas = byId('sheet-canvas');
    if (canvas && widestPlanWidth > 0) {
        canvas.style.setProperty('--sheet-plan-content-width', `${widestPlanWidth}px`);
    }
}

function renderSheetView() {
    // createSheetPlanSection() keeps using createSheetCarColumn and createSheetWaitingColumn.
    const canvas = byId('sheet-canvas');
    if (!canvas) return;
    clearSheetSortables();
    canvas.innerHTML = '';
    updateQuickEditButton();
    const data = getData();
    updateSheetSummary(data);

    const plans = typeof getCarPlansSnapshot === 'function' ? getCarPlansSnapshot() : [data];
    const visiblePlans = plans.filter(plan => (plan.cars || []).length || (plan.waiting || []).length);

    if (!visiblePlans.length) {
        canvas.innerHTML = renderSheetEmptyHtml();
        return;
    }

    visiblePlans
        .sort((a, b) => {
            const typeA = typeof normalizeCarPlanTemplateType === 'function' ? normalizeCarPlanTemplateType(a.templateType) : 'car';
            const typeB = typeof normalizeCarPlanTemplateType === 'function' ? normalizeCarPlanTemplateType(b.templateType) : 'car';
            return (typeA === 'car' ? 0 : 1) - (typeB === 'car' ? 0 : 1);
        })
        .forEach((plan, index) => canvas.appendChild(createSheetPlanSection(plan, index)));
    const timetableSection = createSheetTimetableSection();
    if (timetableSection) canvas.appendChild(timetableSection);
    syncSheetPlanWidths();
    requestAnimationFrame(syncSheetPlanWidths);
    requestAnimationFrame(fitInitialSheetScale);

    setupSheetSortables();
}


let sheetScale = 1, sheetX = 0, sheetY = 0;
let isPanning = false, panStartX = 0, panStartY = 0, panOriginX = 0, panOriginY = 0;
let lastPinchDist = 0;
let sheetUserAdjusted = false;

function applySheetTransform() {
    const canvas = byId('sheet-canvas');
    if (canvas) canvas.style.transform = `translate(${sheetX}px,${sheetY}px) scale(${sheetScale})`;
}

function fitInitialSheetScale() {
    if (sheetUserAdjusted) return;
    const area = byId('sheet-view-area');
    const canvas = byId('sheet-canvas');
    if (!area || !canvas || !canvas.children.length) return;
    const contentWidth = Math.max(
        ...Array.from(canvas.children).map(child => child.scrollWidth || child.offsetWidth || 0),
        canvas.scrollWidth || 0
    );
    const availableWidth = Math.max(0, area.clientWidth - 20);
    if (!contentWidth || !availableWidth) return;
    const isCompact = area.clientWidth <= 640;
    const minScale = isCompact ? 0.74 : 0.92;
    const maxScale = isCompact ? 0.88 : 1;
    sheetScale = Math.min(1, Math.min(maxScale, Math.max(minScale, availableWidth / contentWidth)));
    sheetX = 0;
    sheetY = 0;
    applySheetTransform();
}

function markSheetAdjusted() {
    sheetUserAdjusted = true;
}

function zoomIn() { markSheetAdjusted(); sheetScale = Math.min(sheetScale * 1.25, 4); applySheetTransform(); }
function zoomOut() { markSheetAdjusted(); sheetScale = Math.max(sheetScale / 1.25, 0.3); applySheetTransform(); }
function resetZoom() { markSheetAdjusted(); sheetScale=1; sheetX=0; sheetY=0; applySheetTransform(); }
window.zoomIn = zoomIn; window.zoomOut = zoomOut; window.resetZoom = resetZoom;

D.addEventListener('DOMContentLoaded', () => {
    const area = byId('sheet-view-area');
    if (!area) return;
    const preventSheetTextSelection = e => {
        if (isSheetDragHandle(e.target)) e.preventDefault();
    };

    area.addEventListener('contextmenu', preventSheetTextSelection);
    area.addEventListener('selectstart', preventSheetTextSelection);
    area.addEventListener('touchstart', () => {
        if (quickEditMode && currentView === 'sheet' && window.getSelection) {
            window.getSelection()?.removeAllRanges();
        }
    }, { passive: true });

    area.addEventListener('mousedown', e => {
        if (isSheetInteractiveTarget(e.target) || isSheetDragHandle(e.target)) return;
        markSheetAdjusted();
        isPanning = true; panStartX = e.clientX; panStartY = e.clientY;
        panOriginX = sheetX; panOriginY = sheetY;
        area.style.cursor = 'grabbing';
    });
    D.addEventListener('mousemove', e => {
        if (!isPanning) return;
        sheetX = panOriginX + (e.clientX - panStartX);
        sheetY = panOriginY + (e.clientY - panStartY);
        applySheetTransform();
    });
    D.addEventListener('mouseup', () => { isPanning = false; area.style.cursor = ''; });

    area.addEventListener('wheel', e => {
        e.preventDefault();
        markSheetAdjusted();
        const factor = e.deltaY < 0 ? 1.1 : 0.9;
        const rect = area.getBoundingClientRect();
        const mx = e.clientX - rect.left, my = e.clientY - rect.top;
        sheetX = mx - (mx - sheetX) * factor;
        sheetY = my - (my - sheetY) * factor;
        sheetScale = Math.max(0.3, Math.min(4, sheetScale * factor));
        applySheetTransform();
    }, { passive: false });

    area.addEventListener('touchstart', e => {
        if (isSheetInteractiveTarget(e.target) || isSheetDragHandle(e.target)) return;
        markSheetAdjusted();
        if (e.touches.length === 1) {
            isPanning = true;
            panStartX = e.touches[0].clientX; panStartY = e.touches[0].clientY;
            panOriginX = sheetX; panOriginY = sheetY;
        } else if (e.touches.length === 2) {
            isPanning = false;
            lastPinchDist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
        }
    }, { passive: true });

    area.addEventListener('touchmove', e => {
        e.preventDefault();
        if (e.touches.length === 1 && isPanning) {
            sheetX = panOriginX + (e.touches[0].clientX - panStartX);
            sheetY = panOriginY + (e.touches[0].clientY - panStartY);
            applySheetTransform();
        } else if (e.touches.length === 2) {
            const dist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            if (lastPinchDist > 0) {
                const factor = dist / lastPinchDist;
                const rect = area.getBoundingClientRect();
                const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
                const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
                sheetX = cx - (cx - sheetX) * factor;
                sheetY = cy - (cy - sheetY) * factor;
                sheetScale = Math.max(0.3, Math.min(4, sheetScale * factor));
                applySheetTransform();
            }
            lastPinchDist = dist;
        }
    }, { passive: false });

    area.addEventListener('touchend', () => { isPanning = false; lastPinchDist = 0; });
});
