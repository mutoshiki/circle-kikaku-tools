// Hidden unassigned-pool compatibility feature.
// Unassigned participants remain canonical state for seat picking and random assignment,
// but the former bottom drawer, drag lifecycle and assignment settings UI are retired.

function getWaitingCards() {
    return Array.from(document.querySelectorAll('#waiting-list .member-card')).filter(card => card.isConnected);
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

function updateWaitingTrayState() {
    const tray = byId('bottom-tray');
    if (tray) {
        tray.hidden = true;
        tray.setAttribute('aria-hidden', 'true');
        tray.style.display = 'none';
    }
    const count = byId('waiting-count');
    if (count) count.textContent = `未割り当て ${getWaitingCards().length}人`;
}

function getWaitingTrayNameSummary(names = [], count = names.length) {
    const cleanNames = names.map(name => String(name || '').trim()).filter(Boolean);
    if (!count || !cleanNames.length) return count > 0 ? `${count}人` : '';
    return count === 1 ? cleanNames[0] : `${cleanNames[0]}・他${count - 1}人`;
}

function updateTrayToggleLabel() { updateWaitingTrayState(); }
function updateTrayMenuDirection() { updateWaitingTrayState(); }
function toggleTray() { updateWaitingTrayState(); }
function prepareWaitingTrayForDrag() {}
function maybeOpenWaitingTrayNearPointer() {}
function finishWaitingTrayDragState() {}
function highlightNewWaitingMembers() {}
function preserveTopAreaScrollAcrossTrayResize(mutator) { mutator?.(); }
function isWaitingTrayCollapsed() { return true; }

window.toggleTray = toggleTray;
window.updateWaitingTrayState = updateWaitingTrayState;
window.getWaitingTrayStats = getWaitingTrayStats;
