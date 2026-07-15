// Empty-seat interaction. Uses the existing member card node so drag, lock, and persistence stay intact.
let seatMemberPickerTarget = null;

function refreshEmptySeatAccessibility() {
    $$('.seat-slot').forEach(slot => {
        const empty = getRealSeatCards(slot).length === 0;
        if (empty) {
            slot.setAttribute('role', 'button');
            slot.setAttribute('tabindex', '0');
            slot.setAttribute('aria-label', '空席に未割り当てメンバーを追加');
        } else {
            slot.removeAttribute('role');
            slot.removeAttribute('tabindex');
            slot.removeAttribute('aria-label');
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
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'seat-member-picker-option';
        const name = escapeHtml(card.dataset.name || '名前未設定');
        const grade = parseInt(card.dataset.grade) || 0;
        button.innerHTML = `
            <span class="seat-member-picker-name">${name}</span>
            <span class="seat-member-picker-meta">${grade > 0 ? `${grade}年` : '学年未設定'}</span>
            <i class="fas fa-arrow-right seat-member-picker-arrow" aria-hidden="true"></i>
        `;
        button.addEventListener('click', () => assignWaitingMemberToSeat(card));
        item.appendChild(button);
        list.appendChild(item);
    });
}

function openSeatMemberPicker(slot) {
    if (!slot || getRealSeatCards(slot).length > 0) return;
    if (typeof canUseUnlockedMenuAction === 'function' && !canUseUnlockedMenuAction()) return;
    seatMemberPickerTarget = slot;
    renderSeatMemberPicker();
    modals.seatMember?.show();
}

function assignWaitingMemberToSeat(card) {
    const slot = seatMemberPickerTarget;
    if (!slot || !slot.isConnected || getRealSeatCards(slot).length > 0 || card?.parentElement?.id !== 'waiting-list') {
        modals.seatMember?.hide();
        return;
    }
    const before = captureAppUndoSnapshot();
    const memberName = card.dataset.name || 'メンバー';
    slot.appendChild(card);
    modals.seatMember?.hide();
    updateUI();
    save();
    commitAppUndo(before, `${memberName}を空席に追加しました`);
    requestAnimationFrame(() => card.querySelector('.member-menu-btn')?.focus());
}

function setupSeatMemberPicker() {
    const container = byId('cars-container');
    const modal = byId('seatMemberPickerModal');
    if (!container || container.dataset.seatPickerBound === 'true') return;
    container.dataset.seatPickerBound = 'true';
    container.addEventListener('click', event => {
        if (event.target.closest('.member-card')) return;
        const slot = event.target.closest('.seat-slot');
        if (slot) openSeatMemberPicker(slot);
    });
    container.addEventListener('keydown', event => {
        if (!['Enter', ' '].includes(event.key)) return;
        const slot = event.target.closest('.seat-slot');
        if (!slot || getRealSeatCards(slot).length > 0) return;
        event.preventDefault();
        openSeatMemberPicker(slot);
    });
    modal?.addEventListener('hidden.bs.modal', () => {
        const target = seatMemberPickerTarget;
        seatMemberPickerTarget = null;
        if (target?.isConnected && getRealSeatCards(target).length === 0) target.focus();
    });
    refreshEmptySeatAccessibility();
}

window.refreshEmptySeatAccessibility = refreshEmptySeatAccessibility;
window.setupSeatMemberPicker = setupSeatMemberPicker;
