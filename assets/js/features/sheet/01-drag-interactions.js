// Sheet quick-edit pointer and touch drag interactions.

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
    cleanupSheetEditArtifacts();
    syncSheetToMainData({ refresh: false, persist: true });
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
