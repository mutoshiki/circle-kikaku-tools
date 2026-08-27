// Empty-seat interaction. Uses the existing member card node so drag, lock, and persistence stay intact.
let seatMemberPickerTarget = null;

function refreshEmptySeatAccessibility() {
    $$('.seat-slot').forEach(slot => {
        const empty = getRealSeatCards(slot).length === 0;
        const button = slot.querySelector('.seat-add-btn');
        slot.removeAttribute('role');
        slot.removeAttribute('tabindex');
        slot.removeAttribute('aria-label');
        if (button) {
            button.tabIndex = empty ? 0 : -1;
            button.hidden = !empty;
            button.setAttribute('aria-label', '参加者を追加');
        }
    });
}

function renderSeatMemberPicker() {
    const list = byId('seatMemberPickerList');
    const empty = byId('seatMemberPickerEmpty');
    if (!list || !empty) return;
    const cards = Array.from($$('#waiting-list .member-card'));
    list.replaceChildren();
    empty.hidden = cards.length > 0;
    cards.forEach(card => {
        const item = document.createElement('div');
        item.className = 'seat-member-picker-item';
        item.setAttribute('role', 'listitem');
        const button = document.createElement('cds-button');
        button.type = 'button';
        button.kind = 'ghost';
        button.size = 'lg';
        button.className = 'seat-member-picker-option';
        const name = escapeHtml(card.dataset.name || '名前未設定');
        const grade = parseInt(card.dataset.grade) || 0;
        button.innerHTML = `
            <span class="seat-member-picker-name">${name}</span>
            <span class="seat-member-picker-meta">${grade > 0 ? `${grade}年` : '学年未設定'}</span>
            <span data-carbon-icon="arrow--right" class="seat-member-picker-arrow" aria-hidden="true"></span>
        `;
        button.addEventListener('click', () => assignWaitingMemberToSeat(card));
        item.appendChild(button);
        list.appendChild(item);
    });
}

function openSeatMemberPicker(slot) {
    if (!slot || getRealSeatCards(slot).length > 0) return;
    if (typeof canUseUnlockedMenuAction === 'function' && !canUseUnlockedMenuAction()) return;
    if (document.body.classList.contains('assignment-workspace-enabled')) {
        window.SanpoAssignmentWorkspace?.openSeatCandidates?.(slot);
        return;
    }
    seatMemberPickerTarget = slot;
    renderSeatMemberPicker();
    modals.seatMember?.show();
}

function assignWaitingMemberToSeat(card, targetSlot = seatMemberPickerTarget) {
    const slot = targetSlot;
    if (!slot || !slot.isConnected || getRealSeatCards(slot).length > 0 || card?.parentElement?.id !== 'waiting-list') {
        if (!document.body.classList.contains('assignment-workspace-enabled')) modals.seatMember?.hide();
        return;
    }
    slot.appendChild(card);
    if (!document.body.classList.contains('assignment-workspace-enabled')) modals.seatMember?.hide();
    updateUI();
    save();
    window.SanpoAssignmentWorkspace?.refresh?.();
    requestAnimationFrame(() => card.querySelector('.person-overflow-menu')?.focus());
}

function setupSeatMemberPicker() {
    const container = byId('cars-container');
    const modal = byId('seatMemberPickerModal');
    if (!container || container.dataset.seatPickerBound === 'true') return;
    container.dataset.seatPickerBound = 'true';
    container.addEventListener('click', event => {
        if (!event.target.closest('.seat-add-btn')) return;
        const slot = event.target.closest('.seat-slot');
        if (slot) openSeatMemberPicker(slot);
    });
    modal?.addEventListener('sanpo:modal-hidden', () => {
        const target = seatMemberPickerTarget;
        seatMemberPickerTarget = null;
        if (target?.isConnected && getRealSeatCards(target).length === 0) target.querySelector('.seat-add-btn')?.focus();
    });
    refreshEmptySeatAccessibility();
}

window.refreshEmptySeatAccessibility = refreshEmptySeatAccessibility;
window.setupSeatMemberPicker = setupSeatMemberPicker;
