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

function isWaitingTrayCollapsed(tray = byId('bottom-tray')) {
    return !!tray && (tray.classList.contains('minimized') || tray.classList.contains('drag-transient-minimized'));
}

function preserveTopAreaScrollAcrossTrayResize(mutator) {
    const topArea = byId('top-area');
    const scrollTop = topArea?.scrollTop || 0;
    mutator?.();
    if (!topArea) return;
    topArea.scrollTop = scrollTop;
    requestAnimationFrame(() => {
        if (topArea.isConnected) topArea.scrollTop = scrollTop;
    });
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

    // Keep guidance scrolling inside the tray. Element.scrollIntoView() walks every
    // scrollable ancestor and, on iOS Safari, can reset #top-area when a card has
    // just been reparented. The waiting drawer owns its own scroll container, so
    // only that container is allowed to move.
    const target = targets[0];
    const scroller = byId('waiting-list-container');
    const tray = byId('bottom-tray');
    if (!target || !scroller || !tray || tray.classList.contains('minimized')) return;
    const targetTop = target.offsetTop;
    const targetBottom = targetTop + target.offsetHeight;
    const viewTop = scroller.scrollTop;
    const viewBottom = viewTop + scroller.clientHeight;
    if (targetTop < viewTop) {
        scroller.scrollTo({ top: targetTop, behavior: 'smooth' });
    } else if (targetBottom > viewBottom) {
        scroller.scrollTo({ top: Math.max(0, targetBottom - scroller.clientHeight), behavior: 'smooth' });
    }
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

    countEl.textContent = `未割り当て ${count}人`;
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
        tray.classList.remove('is-drop-ready', 'empty-open');
        if (!initialized) tray.classList.add('minimized');
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
    const handle = byId('tray-handle');
    const updatePresentation = (open, text, disabled = false) => {
        window.SanpoIconAdapter.setStateIcon(label, 'waitingTray', open ? 'open' : 'closed');
        let textNode = label.querySelector('span:not([data-state-icon])');
        if (!textNode) {
            textNode = document.createElement('span');
            label.appendChild(textNode);
        }
        textNode.textContent = text;
        handle?.setAttribute('aria-expanded', open ? 'true' : 'false');
        handle?.setAttribute('aria-disabled', disabled ? 'true' : 'false');
        if (handle) {
            handle.disabled = disabled;
            handle.tabIndex = disabled ? -1 : 0;
        }
    };
    const minimized = isWaitingTrayCollapsed(tray);
    const emptySuffix = count === 0 ? '（0人）' : suffix;
    updatePresentation(!minimized, minimized
        ? `未割り当てメンバーを開く${emptySuffix}`
        : `未割り当てメンバーを閉じる${emptySuffix}`);
}

function toggleTray() {
  const tray = byId("bottom-tray");
  if (!tray) return;
  tray.classList.toggle("minimized");
  tray.classList.remove('empty-open');
  tray.dataset.userMinimized = tray.classList.contains('minimized') ? 'true' : 'false';
  window.SanpoDeviceRoomUi?.write?.({ trayMinimized: tray.classList.contains('minimized') });
  updateTrayMenuDirection();
  updateTrayToggleLabel();
  save();
}
window.toggleTray = toggleTray;

const traySettingsTriggerEl = byId('traySettingsBtn');
const traySettingsPopoverEl = byId('autoAssignPopover');
const traySettingsPopoverTag = 'cds-popover';

function isTraySettingsMenuOpen() {
    if (!traySettingsPopoverEl) return false;
    // Once Carbon is defined its reactive property is the source of truth.
    // During a close event the reflected attribute can lag one update behind,
    // so reading the attribute first would leave aria-expanded stuck at true.
    if (customElements.get(traySettingsPopoverTag)) return traySettingsPopoverEl.open === true;
    return traySettingsPopoverEl.hasAttribute('open');
}

function syncTraySettingsMenuState() {
    if (!traySettingsTriggerEl || !traySettingsPopoverEl) return;
    const open = isTraySettingsMenuOpen();
    traySettingsTriggerEl.setAttribute('aria-expanded', open ? 'true' : 'false');
    byId('bottom-tray')?.classList.toggle('tray-settings-open', open);
}

function setTraySettingsMenuOpen(open) {
    if (!traySettingsPopoverEl) return;
    const next = !!open;

    // Keep state safe while Carbon is still upgrading: the reflected attribute
    // works before definition, then the public Carbon property takes over.
    traySettingsPopoverEl.toggleAttribute('open', next);

    // Once Carbon is defined, use its public reactive property as well so the
    // component update is immediate.
    if (customElements.get(traySettingsPopoverTag)) {
        traySettingsPopoverEl.open = next;
    }
    syncTraySettingsMenuState();
}

function initializeTraySettingsPopover() {
    if (!traySettingsPopoverEl) return;

    // Defensive cleanup for any pre-upgrade property left by an older cached
    // controller. Carbon/Lit normally upgrades this safely, but normalizing it
    // here keeps a single reactive state owner.
    if (Object.prototype.hasOwnProperty.call(traySettingsPopoverEl, 'open')) {
        const pendingOpen = traySettingsPopoverEl.open === true || traySettingsPopoverEl.hasAttribute('open');
        delete traySettingsPopoverEl.open;
        traySettingsPopoverEl.toggleAttribute('open', pendingOpen);
        traySettingsPopoverEl.open = pendingOpen;
    }

    // Root cause of the invisible menu was Carbon auto-align's floating `hide`
    // calculation marking this fixed bottom-tray reference as hidden on the iOS
    // layout. The Popover was actually `open`, but its content received
    // `visibility: hidden`. The requested placement is always north-facing, so
    // use Carbon's stable static top-end alignment instead of auto-align.
    traySettingsPopoverEl.autoalign = false;
    traySettingsPopoverEl.removeAttribute('autoalign');
    traySettingsPopoverEl.removeAttribute('autoalign-boundary');
    traySettingsPopoverEl.align = 'top-end';
    syncTraySettingsMenuState();
}

traySettingsTriggerEl?.addEventListener('click', event => {
    event.preventDefault();
    // Keep this controller synchronous. Carbon itself owns focus, Escape and
    // outside-click dismissal after `open` changes.
    setTraySettingsMenuOpen(!isTraySettingsMenuOpen());
});

// Carbon Popover owns outside-click and Escape dismissal. We only mirror its state
// to the trigger aria attribute and the tray stacking context.
traySettingsPopoverEl?.addEventListener('cds-popover-closed', syncTraySettingsMenuState);

customElements.whenDefined(traySettingsPopoverTag).then(initializeTraySettingsPopover);
syncTraySettingsMenuState();

function updateTrayMenuDirection() {
    const tray = byId("bottom-tray");
    const menuWrap = tray?.querySelector('.tray-settings-dropdown');
    if (!tray || !menuWrap) return;
    menuWrap.classList.toggle('is-dropup', true);
    if (tray.classList.contains('minimized')) setTraySettingsMenuOpen(false);
    updateTrayToggleLabel();
}

function prepareWaitingTrayForDrag() {
    const tray = byId('bottom-tray');
    if (!tray || currentView !== 'list') return;

    const fromWaiting = manualCardDrag?.currentContainer?.id === 'waiting-list';
    const wasClosed = tray.classList.contains('minimized') || (tray.classList.contains('waiting-empty') && !tray.classList.contains('empty-open'));
    tray.dataset.dragStartedMinimized = wasClosed ? 'true' : 'false';
    tray.dataset.dragSource = fromWaiting ? 'waiting' : 'seat';
    const topArea = byId('top-area');
    const waitingScroller = byId('waiting-list-container');
    tray.dataset.dragWaitingScrollTop = String(waitingScroller?.scrollTop || 0);
    tray.dataset.dragTopAreaOverflowAnchor = topArea?.style.overflowAnchor || '';
    if (topArea) topArea.style.overflowAnchor = 'none';

    // The tray is visually collapsed only for the drag lifecycle. Do NOT toggle
    // the canonical `minimized` class or userMinimized flag: those are persisted
    // room settings. A dedicated transient class avoids accidental sync while the
    // captured scroll position prevents iOS Safari from re-anchoring the page.
    preserveTopAreaScrollAcrossTrayResize(() => tray.classList.add('drag-transient-minimized'));
    tray.classList.remove('is-drop-near');
    tray.classList.add('is-drop-ready');
    updateTrayMenuDirection();
    updateTrayToggleLabel();
}

function maybeOpenWaitingTrayNearPointer(clientX, clientY) {
    const tray = byId('bottom-tray');
    const waitingList = byId('waiting-list');
    if (!tray || !waitingList || currentView !== 'list' || !manualCardDrag) return;

    if (manualCardDrag.currentContainer?.id === 'waiting-list') {
        tray.classList.remove('is-drop-near');
        return;
    }

    const closed = isWaitingTrayCollapsed(tray) || (tray.classList.contains('waiting-empty') && !tray.classList.contains('empty-open'));
    if (!closed) {
        tray.classList.remove('is-drop-near');
        return;
    }

    // A closed tray already accepts a drop through its handle in
    // getManualCardDropTarget(). Highlight that handle, but do not open the drawer
    // mid-drag: opening it would resize #top-area and disturb the current scroll.
    const handle = byId('tray-handle');
    const trayRect = tray.getBoundingClientRect();
    const handleRect = handle?.getBoundingClientRect?.();
    const viewportWidth = window.visualViewport?.width || window.innerWidth;
    const stripTop = Math.min(trayRect.top || Infinity, handleRect?.top ?? Infinity) - 40;
    const stripBottom = Math.max(trayRect.bottom || 0, handleRect?.bottom ?? 0) + 32;
    const touchingClosedStrip = clientX >= -12
        && clientX <= viewportWidth + 12
        && clientY >= stripTop
        && clientY <= stripBottom;

    tray.classList.toggle('is-drop-near', touchingClosedStrip);
}

function finishWaitingTrayDragState() {
    const tray = byId('bottom-tray');
    if (!tray) return;
    const topArea = byId('top-area');
    const waitingScroller = byId('waiting-list-container');
    const waitingScrollTop = Number(tray.dataset.dragWaitingScrollTop || 0);
    const previousOverflowAnchor = tray.dataset.dragTopAreaOverflowAnchor || '';

    // Expand back to exactly the user's pre-drag state. Capture the current
    // #top-area scroll position *after any intentional drag auto-scroll*, then
    // preserve that position while the tray regains its normal height.
    preserveTopAreaScrollAcrossTrayResize(() => tray.classList.remove('drag-transient-minimized'));
    if (waitingScroller) waitingScroller.scrollTop = waitingScrollTop;
    if (topArea) topArea.style.overflowAnchor = previousOverflowAnchor;

    tray.classList.remove('is-drop-ready', 'is-drop-near');
    delete tray.dataset.dragStartedMinimized;
    delete tray.dataset.dragSource;
    delete tray.dataset.dragWaitingScrollTop;
    delete tray.dataset.dragTopAreaOverflowAnchor;
    updateTrayMenuDirection();
    updateTrayToggleLabel();
}
