// Edit-view manual drag feature
// Owns seat preview, drag/drop, and edit-view auto-scroll behavior.

function clearSeatDropPreview() {
    document.querySelectorAll('.seat-slot.drop-preview, .seat-slot.shift-target, .seat-slot.swap-target, .seat-slot.swap-origin, .seat-slot.escape-target').forEach(slot => {
        slot.classList.remove('drop-preview', 'shift-target', 'swap-target', 'swap-origin', 'escape-target');
    });
    document.querySelectorAll('#waiting-list.return-preview-target').forEach(list => list.classList.remove('return-preview-target'));
    document.querySelectorAll('#cars-container.car-create-drop-target').forEach(container => container.classList.remove('car-create-drop-target'));
    document.querySelectorAll('.swap-preview-card, .drag-preview-card').forEach(card => card.remove());
    document.querySelectorAll('.seat-card-will-move').forEach(card => card.classList.remove('seat-card-will-move'));
}

function clearDragHoverState() {
    dragHoverSlot = null;
    dragHoverOccupant = null;
    dragHoverEscapeSlot = null;
}

function findOpenSeatInSameCar(slot, excluded = []) {
    const carBox = slot?.closest?.('.car-box');
    if (!carBox) return null;
    return Array.from(carBox.querySelectorAll('.seat-slot')).find(seat => {
        if (seat === slot || excluded.includes(seat)) return false;
        return !Array.from(seat.children).some(child =>
            child.classList?.contains('member-card') &&
            !child.classList.contains('sortable-fallback') &&
            !child.classList.contains('swap-preview-card') &&
            !child.classList.contains('drag-preview-card')
        );
    }) || null;
}

function getRealSeatCard(slot, excluded = []) {
    return Array.from(slot?.children || []).find(child =>
        child.classList?.contains('member-card') &&
        !child.classList.contains('sortable-fallback') &&
        !child.classList.contains('swap-preview-card') &&
        !child.classList.contains('drag-preview-card') &&
        !excluded.includes(child)
    ) || null;
}

function getRealSeatCards(slot, excluded = []) {
    return Array.from(slot?.children || []).filter(child =>
        child.classList?.contains('member-card') &&
        !child.classList.contains('sortable-fallback') &&
        !child.classList.contains('swap-preview-card') &&
        !child.classList.contains('drag-preview-card') &&
        !excluded.includes(child)
    );
}

function showSeatReturnPreview(card, destination, excluded = []) {
    if (!card || !destination) return;
    const preview = card.cloneNode(true);
    preview.classList.add('swap-preview-card');
    preview.classList.remove('manual-drag-source', 'manual-drag-float', 'drag-preview-card', 'seat-card-will-move');
    preview.removeAttribute('id');
    preview.setAttribute('aria-hidden', 'true');
    if (destination.classList?.contains('seat-slot')) {
        if (getRealSeatCard(destination, excluded)) return;
        destination.appendChild(preview);
        return;
    }
    if (destination.id === 'waiting-list') {
        preview.classList.add('in-waiting');
        destination.classList.add('return-preview-target');
        const source = manualCardDrag?.card;
        if (source?.parentElement === destination) {
            destination.insertBefore(preview, source);
        } else {
            destination.appendChild(preview);
        }
    }
}

function showDraggedSeatPreview(card, slot, excluded = []) {
    // ドラッグ中の本人カードをドロップ先に複製表示しない。
    // 交換・戻り先のヒントだけを残し、画面の重なりを減らす。
    return;
}

function enforceOneCardPerSeat() {
    $$('.seat-slot').forEach(slot => {
        const cards = getRealSeatCards(slot);
        cards.slice(1).forEach(card => $('#waiting-list')?.appendChild(card));
    });
}

function isPointInsideRect(clientX, clientY, rect, margin = 0) {
    if (!rect) return false;
    return clientX >= rect.left - margin &&
        clientX <= rect.right + margin &&
        clientY >= rect.top - margin &&
        clientY <= rect.bottom + margin;
}

function getCarCreateDropTarget(clientX, clientY, el) {
    const carsContainer = byId('cars-container');
    const topArea = byId('top-area');
    if (!carsContainer || !topArea || currentView !== 'list') return null;
    if (el?.closest?.('.car-box, .edit-header, #bottom-tray, .modal, .dropdown-menu, button, input, textarea, select')) return null;

    const topRect = topArea.getBoundingClientRect();
    if (!isPointInsideRect(clientX, clientY, topRect)) return null;

    const containerRect = carsContainer.getBoundingClientRect();
    const startsBelowTools = clientY >= Math.min(containerRect.top || topRect.top, topRect.bottom) - 20;
    if (!startsBelowTools) return null;

    // 車カード同士のすき間、車カードの下の余白、まだ車がないときの空き領域を新規作成エリアにする。
    return carsContainer;
}

function getManualCardDropTarget(clientX, clientY) {
    const el = document.elementFromPoint(clientX, clientY);
    const waitingList = byId('waiting-list');
    const tray = byId('bottom-tray');
    const seat = el?.closest?.('.seat-slot');
    if (seat) return seat;

    if (waitingList && tray && tray.isConnected) {
        const trayIsOpen = !tray.classList.contains('minimized') && !(tray.classList.contains('waiting-empty') && !tray.classList.contains('empty-open'));

        // 開いているときは、待機欄の中に入った場合だけ戻し先にする。
        if (trayIsOpen && el?.closest?.('#waiting-list, #waiting-list-container')) {
            return waitingList;
        }

        // 閉じているときは、閉じたタブ本体に触れたときだけ戻し先扱いにする。
        const handle = byId('tray-handle');
        const targetRect = (handle || tray).getBoundingClientRect();
        const margin = 12;
        const touchingClosedTab = isPointInsideRect(clientX, clientY, targetRect, margin);

        if (!trayIsOpen && touchingClosedTab) return waitingList;
    }

    return getCarCreateDropTarget(clientX, clientY, el);
}

function moveManualDragCardTo(target) {
    if (!manualCardDrag) return;
    if ((target || null) === (manualCardDrag.dropTarget || null)) return;
    clearSeatDropPreview();
    clearDragHoverState();
    manualCardDrag.dropTarget = null;
    if (!target || !target.isConnected) return;
    const card = manualCardDrag.card;
    manualCardDrag.dropTarget = target;
    if (target.id === 'waiting-list') {
        target.classList.add('return-preview-target');
        return;
    }

    if (target.id === 'cars-container') {
        target.classList.add('car-create-drop-target');
        return;
    }

    if (!target.classList.contains('seat-slot')) return;
    const occupant = getRealSeatCard(target, [card]);
    if (occupant) {
        target.classList.add('swap-target');
        dragHoverSlot = target;
        dragHoverOccupant = occupant;
        const returnDestination =
            manualCardDrag.currentContainer?.classList?.contains('seat-slot') || manualCardDrag.currentContainer?.id === 'waiting-list'
                ? manualCardDrag.currentContainer
                : $('#waiting-list');
        dragHoverEscapeSlot = returnDestination;
        if (returnDestination && returnDestination !== target) {
            if (returnDestination.classList?.contains('seat-slot')) {
                returnDestination.classList.add('swap-origin');
            }
            occupant.classList.add('seat-card-will-move');
            showDraggedSeatPreview(card, target, [occupant]);
            showSeatReturnPreview(occupant, returnDestination, [card]);
        }
        return;
    }

    target.classList.add('drop-preview');
    showDraggedSeatPreview(card, target, [card]);
}

function createCarFromDroppedMember(card) {
    if (!card?.isConnected) return false;
    const member = getMemData(card);
    if (!member?.name) return false;

    card.remove();
    addCar(member.name, (typeof getDefaultGroupCapacityForActivePlan === 'function' ? getDefaultGroupCapacityForActivePlan() : 3), [], member.memo, member.gender, member.grade || 0);
    return true;
}

function commitManualCardDrop() {
    if (!manualCardDrag) return;
    const card = manualCardDrag.card;
    const target = manualCardDrag.dropTarget;
    const current = manualCardDrag.currentContainer;
    if (!target || !target.isConnected || target === current) return;

    if (target.id === 'waiting-list') {
        target.appendChild(card);
        manualCardDrag.currentContainer = target;
        return;
    }

    if (target.id === 'cars-container') {
        if (createCarFromDroppedMember(card)) manualCardDrag.currentContainer = target;
        return;
    }

    if (!target.classList.contains('seat-slot')) return;
    const occupant = getRealSeatCard(target, [card]);

    if (occupant) {
        if (current?.id === 'waiting-list' || current?.classList?.contains('seat-slot')) {
            current.appendChild(occupant);
        } else {
            $('#waiting-list')?.appendChild(occupant);
        }
    }
    target.appendChild(card);
    manualCardDrag.currentContainer = target;
}

function getFinitePointerCoord(point, key, fallback) {
    const value = Number(point?.[key]);
    return Number.isFinite(value) ? value : fallback;
}

function clampDragOffset(value, size, edge = 8) {
    const min = Math.min(edge, Math.max(0, size / 2));
    const max = Math.max(min, size - min);
    return Math.max(min, Math.min(max, value));
}

function updateManualDragFloat(clientX, clientY) {
    if (!manualCardDrag?.floating) return;
    const left = clientX - manualCardDrag.offsetX;
    const top = clientY - manualCardDrag.offsetY;
    if (!Number.isFinite(left) || !Number.isFinite(top)) return;
    manualCardDrag.floating.style.left = `${left}px`;
    manualCardDrag.floating.style.top = `${top}px`;
    manualCardDrag.floating.style.transform = 'scale(1.03)';
}

function finishManualCardDrag(commit = true) {
    if (!manualCardDrag) return;
    const { card, floating } = manualCardDrag;
    if (commit) commitManualCardDrop();
    floating?.remove();
    card.classList.remove('manual-drag-source');
    D.body.classList.remove('manual-card-dragging');
    finishWaitingTrayDragState();
    manualCardDrag = null;
    isDraggingCards = false;
    clearSeatDropPreview();
    clearDragHoverState();
    enforceOneCardPerSeat();
    updateUI();
    save();
}

function startManualCardDrag(card, point) {
    closePersonMenus();
    if (manualCardDrag || !card?.isConnected) return;
    const currentContainer = card.parentElement;
    if (!(currentContainer?.classList?.contains('seat-slot') || currentContainer?.id === 'waiting-list')) return;

    const rect = card.getBoundingClientRect();
    const clientX = getFinitePointerCoord(point, 'clientX', rect.left + rect.width / 2);
    const clientY = getFinitePointerCoord(point, 'clientY', rect.top + rect.height / 2);
    const floating = card.cloneNode(true);
    floating.classList.add('manual-drag-float');
    floating.style.width = `${rect.width}px`;
    floating.style.height = `${rect.height}px`;
    D.body.appendChild(floating);

    manualCardDrag = {
        card,
        floating,
        currentContainer,
        pointerId: point?.pointerId ?? null,
        pointerType: point?.pointerType || (point?.touchIdentifier != null ? 'touch' : 'mouse'),
        touchIdentifier: point?.touchIdentifier ?? null,
        offsetX: clampDragOffset(clientX - rect.left, rect.width),
        offsetY: clampDragOffset(clientY - rect.top, rect.height)
    };

    try { if (manualCardDrag.pointerId != null) card.setPointerCapture?.(manualCardDrag.pointerId); } catch (_) {}
    card.classList.add('manual-drag-source');
    D.body.classList.add('manual-card-dragging');
    prepareWaitingTrayForDrag();
    isDraggingCards = true;
    updateManualDragFloat(clientX, clientY);
}

function setupManualCardDrag() {
    let pending = null;
    const touchDelay = 260;
    const mouseDelay = 55;
    const touchMoveCancel = 22;

    const canStartFromTarget = target => {
        if (currentView !== 'list') return null;
        const card = target.closest?.('.member-card');
        if (!card || card.classList.contains('manual-drag-float') || card.classList.contains('swap-preview-card') || card.classList.contains('drag-preview-card')) return null;
        if (card.dataset.locked === 'true') return null;
        if (window.SanpoDrag?.isInteractiveTarget(target) || target.closest?.('.action-btn, .delete-btn-overlay, button, input, textarea, select, .memo-popup, .person-pop-menu')) return null;
        const parent = card.parentElement;
        if (!(parent?.classList?.contains('seat-slot') || parent?.id === 'waiting-list')) return null;
        return card;
    };

    const clearPending = () => {
        clearTimeout(pending?.timer);
        pending = null;
    };

    const findTouch = (touchList, identifier) => Array.from(touchList || []).find(t => t.identifier === identifier) || null;

    // マウス/ペンは従来通り。タッチは touch イベント側に任せることで、通常スクロールと長押しドラッグを両立する。
    D.addEventListener('pointerdown', e => {
        if (e.pointerType === 'touch') return;
        if (e.button !== undefined && e.button !== 0) return;
        const card = canStartFromTarget(e.target);
        if (!card) return;

        e.preventDefault();
        e.stopPropagation();
        card.setPointerCapture?.(e.pointerId);
        clearPending();
        const nextPending = {
            card,
            pointerId: e.pointerId,
            touchIdentifier: null,
            startX: e.clientX,
            startY: e.clientY,
            clientX: e.clientX,
            clientY: e.clientY,
            pointerType: e.pointerType,
            timer: null
        };
        nextPending.timer = setTimeout(() => startManualCardDrag(card, nextPending), mouseDelay);
        pending = nextPending;
    }, { passive: false });

    D.addEventListener('pointermove', e => {
        if (e.pointerType === 'touch') return;
        if (pending && pending.pointerId === e.pointerId && !manualCardDrag) {
            pending.clientX = e.clientX;
            pending.clientY = e.clientY;
            const moved = window.SanpoDrag?.distance?.(pending.startX, pending.startY, e.clientX, e.clientY) ?? Math.hypot(e.clientX - pending.startX, e.clientY - pending.startY);
            if (moved > 8) startManualCardDrag(pending.card, pending);
        }
        if (!manualCardDrag || manualCardDrag.pointerId !== e.pointerId) return;
        e.preventDefault();
        updateManualDragFloat(e.clientX, e.clientY);
        maybeOpenWaitingTrayNearPointer(e.clientX, e.clientY);
        moveManualDragCardTo(getManualCardDropTarget(e.clientX, e.clientY));
    }, { passive: false });

    const cancelPointerPending = e => {
        if (pending && pending.pointerId === e.pointerId) clearPending();
    };

    D.addEventListener('pointerup', e => {
        if (e.pointerType === 'touch') return;
        cancelPointerPending(e);
        if (manualCardDrag && manualCardDrag.pointerId === e.pointerId) finishManualCardDrag(true);
    }, { passive: true });
    D.addEventListener('pointercancel', e => {
        if (e.pointerType === 'touch') return;
        cancelPointerPending(e);
        if (manualCardDrag && manualCardDrag.pointerId === e.pointerId) finishManualCardDrag(false);
    }, { passive: true });

    D.addEventListener('touchstart', e => {
        if (e.touches.length !== 1) return;
        const touch = e.changedTouches?.[0];
        if (!touch) return;
        const card = canStartFromTarget(e.target);
        if (!card) return;

        clearPending();
        const nextPending = {
            card,
            pointerId: null,
            touchIdentifier: touch.identifier,
            startX: touch.clientX,
            startY: touch.clientY,
            clientX: touch.clientX,
            clientY: touch.clientY,
            pointerType: 'touch',
            timer: null
        };
        nextPending.timer = setTimeout(() => startManualCardDrag(card, nextPending), touchDelay);
        pending = nextPending;
    }, { passive: false });

    D.addEventListener('touchmove', e => {
        if (pending && pending.pointerType === 'touch' && !manualCardDrag) {
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

        if (!manualCardDrag || manualCardDrag.pointerType !== 'touch') return;
        const touch = findTouch(e.touches, manualCardDrag.touchIdentifier);
        if (!touch) return;
        e.preventDefault();
        e.stopPropagation();
        updateManualDragFloat(touch.clientX, touch.clientY);
        maybeOpenWaitingTrayNearPointer(touch.clientX, touch.clientY);
        moveManualDragCardTo(getManualCardDropTarget(touch.clientX, touch.clientY));
    }, { passive: false });

    D.addEventListener('touchend', e => {
        if (pending && pending.pointerType === 'touch' && findTouch(e.changedTouches, pending.touchIdentifier)) clearPending();
        if (manualCardDrag?.pointerType === 'touch' && findTouch(e.changedTouches, manualCardDrag.touchIdentifier)) finishManualCardDrag(true);
    }, { passive: true });

    D.addEventListener('touchcancel', e => {
        if (pending && pending.pointerType === 'touch' && findTouch(e.changedTouches, pending.touchIdentifier)) clearPending();
        if (manualCardDrag?.pointerType === 'touch' && findTouch(e.changedTouches, manualCardDrag.touchIdentifier)) finishManualCardDrag(false);
    }, { passive: true });
}

function updateSeatDropPreview(evt) {
    clearSeatDropPreview();
    clearDragHoverState();
    const relatedSlot = evt?.related?.closest?.('.seat-slot');
    const target = relatedSlot || evt?.to;
    if (!target || !target.classList?.contains('seat-slot')) return;
    const dragged = evt.dragged;
    const occupant = getRealSeatCard(target, [dragged]);

    if (occupant) {
        const escapeSlot = findOpenSeatInSameCar(target, [dragOriginSlot]);
        dragHoverSlot = target;
        dragHoverOccupant = occupant;
        dragHoverEscapeSlot = escapeSlot || (dragOriginSlot?.classList?.contains('seat-slot') ? dragOriginSlot : null);
        if (escapeSlot) {
            target.classList.add('shift-target');
            escapeSlot.classList.add('escape-target');
            occupant.classList.add('seat-card-will-move');
            showDraggedSeatPreview(dragged, target, [occupant]);
            showSeatReturnPreview(occupant, escapeSlot, [dragged]);
        } else if (dragOriginSlot && dragOriginSlot !== target && dragOriginSlot.classList.contains('seat-slot')) {
            target.classList.add('swap-target');
            dragOriginSlot.classList.add('swap-origin');
            occupant.classList.add('seat-card-will-move');
            showDraggedSeatPreview(dragged, target, [occupant]);
            showSeatReturnPreview(occupant, dragOriginSlot, [dragged]);
        } else {
            target.classList.add('swap-target');
        }
    } else {
        target.classList.add('drop-preview');
    }
}

function applyHoverSeatExchange(dragged) {
    if (!dragged || !dragHoverSlot || !dragHoverOccupant || !dragHoverOccupant.isConnected) return false;
    const target = dragHoverSlot;
    const occupant = dragHoverOccupant;
    const destination = dragHoverEscapeSlot || (dragOriginSlot?.classList?.contains('seat-slot') ? dragOriginSlot : null) || $('#waiting-list');
    if (!target || !target.isConnected || !destination || destination === target) return false;

    clearSeatDropPreview();
    target.appendChild(dragged);
    destination.appendChild(occupant);
    clearDragHoverState();
    return true;
}

function setupSortable(el) {
    // 編集画面のドラッグは setupManualCardDrag() に一本化しています。
    // 旧 Sortable 実装はタッチ操作と競合するため、ここでは初期化しません。
    return null;
}

function autoScrollEditingView(clientY) {
    if (!isDraggingCards || currentView !== 'list') return;
    const topArea = byId('top-area');
    const waitingContainer = byId('waiting-list-container');
    const areas = [topArea, waitingContainer];

    areas.forEach(area => {
        if (!area || area.offsetParent === null) return;
        const rect = area.getBoundingClientRect();
        const edge = Math.min(112, rect.height / 2.8);
        if (clientY < rect.top + edge) {
            const intensity = Math.min(1, Math.max(0, (rect.top + edge - clientY) / edge));
            area.scrollTop -= Math.ceil(3 + Math.pow(intensity, 2) * 12);
        } else if (clientY > rect.bottom - edge) {
            const intensity = Math.min(1, Math.max(0, (clientY - (rect.bottom - edge)) / edge));
            area.scrollTop += Math.ceil(3 + Math.pow(intensity, 2) * 12);
        }
    });
}

function autoScrollSheetQuickEdit(clientX, clientY) {
    if (!isDraggingCards || currentView !== 'sheet' || !quickEditMode) return;
    const area = byId('sheet-view-area');
    if (!area) return;
    const rect = area.getBoundingClientRect();
    const edgeX = Math.min(56, rect.width / 6);
    const edgeY = Math.min(70, rect.height / 6);
    let moved = false;

    if (clientX < rect.left + edgeX) {
        const intensity = (rect.left + edgeX - clientX) / edgeX;
        sheetX += Math.ceil(3 + intensity * 9);
        moved = true;
    } else if (clientX > rect.right - edgeX) {
        const intensity = (clientX - (rect.right - edgeX)) / edgeX;
        sheetX -= Math.ceil(3 + intensity * 9);
        moved = true;
    }

    if (clientY < rect.top + edgeY) {
        const intensity = (rect.top + edgeY - clientY) / edgeY;
        sheetY += Math.ceil(3 + intensity * 9);
        moved = true;
    } else if (clientY > rect.bottom - edgeY) {
        const intensity = (clientY - (rect.bottom - edgeY)) / edgeY;
        sheetY -= Math.ceil(3 + intensity * 9);
        moved = true;
    }

    if (moved) applySheetTransform();
}
