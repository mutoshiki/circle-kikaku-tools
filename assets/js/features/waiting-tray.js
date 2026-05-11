// Waiting tray feature
// Owns waiting tray stats, opening behavior during drag, and tray labels.

function getWaitingCards() {
    return Array.from(document.querySelectorAll('#waiting-list .member-card')).filter(card =>
        card.isConnected &&
        !card.classList.contains('manual-drag-source') &&
        !card.classList.contains('manual-drag-float') &&
        !card.classList.contains('swap-preview-card') &&
        !card.classList.contains('drag-preview-card')
    );
}

function getWaitingTrayStats() {
    const waitingCards = getWaitingCards();
    let seatsTotal = 0;
    let seatsFilled = 0;
    document.querySelectorAll('.car-box').forEach(box => {
        const capacity = getInt(box.dataset.capacity);
        seatsTotal += Math.max(0, capacity);
        box.querySelectorAll('.seat-slot').forEach(slot => {
            seatsFilled += getRealSeatCards(slot).length;
        });
    });
    return {
        waitingCount: waitingCards.length,
        waitingNames: waitingCards.map(card => card.dataset.name || ''),
        seatsTotal,
        seatsFilled,
        openSeats: Math.max(0, seatsTotal - seatsFilled)
    };
}

function setWaitingTraySizeClass(tray, count) {
    tray.classList.remove('waiting-empty', 'waiting-few', 'waiting-normal', 'waiting-many');
    if (count === 0) tray.classList.add('waiting-empty');
    else if (count <= 2) tray.classList.add('waiting-few');
    else if (count <= 6) tray.classList.add('waiting-normal');
    else tray.classList.add('waiting-many');
}

function highlightNewWaitingMembers(previousNames = []) {
    const previous = new Set(previousNames.filter(Boolean));
    const cards = getWaitingCards();
    const newlyAdded = cards.filter(card => !previous.has(card.dataset.name || ''));
    const targets = newlyAdded.length ? newlyAdded : cards.slice(-1);
    targets.forEach(card => {
        card.classList.remove('waiting-card-new');
        void card.offsetWidth;
        card.classList.add('waiting-card-new');
        setTimeout(() => card.classList.remove('waiting-card-new'), 1600);
    });
    targets[0]?.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
}

function updateWaitingTrayState() {
    const tray = byId("bottom-tray");
    const countEl = byId("waiting-count");
    const list = byId('waiting-list');
    if (!tray || !countEl || !list) return;

    const stats = getWaitingTrayStats();
    const count = stats.waitingCount;
    const previousCount = Number(tray.dataset.waitingCount || '0');
    const previousNames = (() => {
        try { return JSON.parse(tray.dataset.waitingNames || '[]'); }
        catch (_) { return []; }
    })();
    const initialized = tray.dataset.waitingInitialized === 'true';

    countEl.textContent = `${count}人`;
    countEl.setAttribute('aria-label', `未割り当てメンバー ${count}人`);
    setWaitingTraySizeClass(tray, count);
    tray.dataset.waitingCount = String(count);
    tray.dataset.waitingNames = JSON.stringify(stats.waitingNames);
    tray.dataset.waitingInitialized = 'true';

    if (count > 0) tray.classList.remove('empty-open');

    const status = tray.querySelector('.tray-status small');
    if (status) {
        status.textContent = '';
    }

    if (initialized && count > previousCount) {
        highlightNewWaitingMembers(previousNames);
        if (currentView === 'list' && tray.dataset.userMinimized !== 'true') {
            tray.classList.remove('minimized');
        }
    }

    if (count === 0) {
        tray.classList.remove('is-drop-ready');
    }

    updateTrayToggleLabel();
}

function getWaitingTrayNameSummary(names = [], count = names.length) {
    const cleanNames = names.map(name => String(name || '').trim()).filter(Boolean);
    if (!count || cleanNames.length === 0) return count > 0 ? `${count}人` : '';
    const firstName = cleanNames[0];
    if (count <= 1) return firstName;
    return `${firstName}・他${count - 1}人`;
}

function updateTrayToggleLabel() {
    const tray = byId("bottom-tray");
    const label = byId("tray-toggle-label");
    if (!tray || !label) return;
    const { waitingCount: count, waitingNames } = getWaitingTrayStats();
    const summary = getWaitingTrayNameSummary(waitingNames, count);
    const suffix = summary ? `（${summary}）` : '';
    if (count === 0) {
        const open = tray.classList.contains('empty-open');
        label.innerHTML = open
            ? '<i class="fas fa-chevron-down" aria-hidden="true"></i><span>未割り当てメンバーを閉じる</span>'
            : '<i class="fas fa-chevron-up" aria-hidden="true"></i><span>未割り当てメンバーを開く</span>'; 
        return;
    }
    const minimized = tray.classList.contains("minimized");
    label.innerHTML = minimized
        ? `<i class="fas fa-chevron-up" aria-hidden="true"></i><span>未割り当てメンバーを開く${suffix}</span>`
        : `<i class="fas fa-chevron-down" aria-hidden="true"></i><span>未割り当てメンバーを閉じる${suffix}</span>`;
}

function toggleTray() {
  const tray = byId("bottom-tray");
  if (!tray) return;
  if (tray.classList.contains('waiting-empty')) {
    tray.classList.toggle('empty-open');
    tray.dataset.userMinimized = tray.classList.contains('empty-open') ? 'false' : 'true';
  } else {
    tray.classList.toggle("minimized");
    tray.classList.remove('empty-open');
    tray.dataset.userMinimized = tray.classList.contains('minimized') ? 'true' : 'false';
  }
  updateTrayMenuDirection();
  updateTrayToggleLabel();
  save();
}
window.toggleTray = toggleTray;

const trayHandleEl = byId('tray-handle');
trayHandleEl?.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleTray();
    }
});

function updateTrayMenuDirection() {
    const tray = byId("bottom-tray");
    const menuWrap = tray?.querySelector('.tray-settings-dropdown');
    if (!tray || !menuWrap) return;
    menuWrap.classList.toggle('dropup', tray.classList.contains('minimized'));
    updateTrayToggleLabel();
}

function prepareWaitingTrayForDrag() {
    const tray = byId('bottom-tray');
    if (!tray || currentView !== 'list') return;

    const fromWaiting = manualCardDrag?.currentContainer?.id === 'waiting-list';
    const wasClosed = tray.classList.contains('minimized') || (tray.classList.contains('waiting-empty') && !tray.classList.contains('empty-open'));
    tray.dataset.dragStartedMinimized = wasClosed ? 'true' : 'false';

    // ドラッグ中は待機欄を一時的に閉じ、座席側の作業面を広く保つ。
    // もともと開いていた場合だけ、ドロップ後に元の開いた状態へ戻す。
    if (!wasClosed) {
        tray.dataset.closedDuringDrag = 'true';
    } else {
        delete tray.dataset.closedDuringDrag;
    }

    tray.classList.add('minimized');
    tray.classList.remove('empty-open', 'is-drop-near');
    tray.dataset.userMinimized = 'true';

    if (fromWaiting) {
        // 待機メンバーから持ち上げたカードは、同じドラッグ中に自動再展開しない。
        tray.classList.remove('is-drop-ready');
        tray.dataset.closedByWaitingDrag = 'true';
    } else {
        // 車側から戻すときだけ、閉じたタブへのドロップ先として控えめに準備する。
        tray.classList.add('is-drop-ready');
        delete tray.dataset.closedByWaitingDrag;
    }

    updateTrayMenuDirection();
    updateTrayToggleLabel();
}

function maybeOpenWaitingTrayNearPointer(clientX, clientY) {
    const tray = byId('bottom-tray');
    const waitingList = byId('waiting-list');
    if (!tray || !waitingList || currentView !== 'list' || !manualCardDrag) return;

    // 待機欄からドラッグを始めた場合は、閉じたタブの上を通っても再展開しない。
    // これにより「持ち上げた瞬間に閉じたのに、すぐ開き直す」挙動を防ぐ。
    if (tray.dataset.closedByWaitingDrag === 'true' || manualCardDrag.currentContainer?.id === 'waiting-list') {
        tray.classList.remove('is-drop-near');
        return;
    }

    const closed = tray.classList.contains('minimized') || (tray.classList.contains('waiting-empty') && !tray.classList.contains('empty-open'));
    if (!closed) {
        tray.classList.remove('is-drop-near');
        return;
    }

    // 自動で開くのは、カードが「閉じているタブ本体」に触れたときだけ。
    // 以前のように画面下に近づいただけでは開かない。
    const handle = byId('tray-handle');
    const targetRect = (handle || tray).getBoundingClientRect();
    const margin = 10;
    const touchingClosedTab =
        clientX >= targetRect.left - margin &&
        clientX <= targetRect.right + margin &&
        clientY >= targetRect.top - margin &&
        clientY <= targetRect.bottom + margin;

    tray.classList.toggle('is-drop-near', touchingClosedTab);
    if (!touchingClosedTab) return;

    tray.classList.remove('minimized');
    if (tray.classList.contains('waiting-empty')) tray.classList.add('empty-open');
    tray.dataset.openedByDrag = 'true';
    tray.classList.add('is-drop-ready');
    updateTrayMenuDirection();
    updateTrayToggleLabel();
}

function finishWaitingTrayDragState() {
    const tray = byId('bottom-tray');
    if (!tray) return;
    const droppedToWaiting = manualCardDrag?.dropTarget?.id === 'waiting-list';
    const closedByWaitingDrag = tray.dataset.closedByWaitingDrag === 'true';
    const closedDuringDrag = tray.dataset.closedDuringDrag === 'true';
    const wasMinimizedBeforeDrag = tray.dataset.dragStartedMinimized === 'true';
    tray.classList.remove('is-drop-ready', 'is-drop-near');

    if (closedByWaitingDrag || closedDuringDrag) {
        if (!wasMinimizedBeforeDrag || droppedToWaiting) {
            // ドラッグ中だけ閉じた場合は、ドロップ後に元の開いた状態へ戻す。
            tray.classList.remove('minimized');
            tray.classList.remove('empty-open');
            tray.dataset.userMinimized = 'false';
        } else {
            tray.classList.add('minimized');
            tray.classList.remove('empty-open');
            tray.dataset.userMinimized = 'true';
        }
    } else if (tray.dataset.openedByDrag === 'true' && tray.dataset.userMinimized === 'true' && !droppedToWaiting) {
        tray.classList.add('minimized');
        tray.classList.remove('empty-open');
    } else if (droppedToWaiting) {
        tray.dataset.userMinimized = 'false';
    }

    delete tray.dataset.openedByDrag;
    delete tray.dataset.dragStartedMinimized;
    delete tray.dataset.closedByWaitingDrag;
    delete tray.dataset.closedDuringDrag;
    updateTrayMenuDirection();
    updateTrayToggleLabel();
}
