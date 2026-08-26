// Random assignment feature.
// Allocation has one bulk action only: randomly redistribute movable participants.

function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function isRandomlyMovablePlacement(placement) {
    return placement?.kind === 'waiting'
        || (placement?.kind === 'member' && placement?.driver !== true);
}

function randomSlotsFromCanonical(allocation) {
    const placements = allocation?.placements || {};
    return Object.values(allocation?.groups || {})
        .sort((a, b) => Number(a?.order || 0) - Number(b?.order || 0))
        .flatMap(group => {
            const fixedMembers = Object.values(placements)
                .filter(placement => placement?.kind === 'member' && placement.groupId === group.id && placement.driver === true)
                .length;
            const capacity = Math.max(1, parseInt(group?.capacity, 10) || 1);
            return Array.from({ length: Math.max(0, capacity - fixedMembers) }, (_, order) => ({ groupId: group.id, order }));
        });
}

// data-state.js still restores the historical lastAutoAssignLabel field because it is
// part of persisted room compatibility. There are no longer condition controls to sync.
function updateLastAutoAssignCondition() {}

async function autoAssign() {
    if (!await appConfirm('参加者をランダムに割り当てます。', { title: 'ランダムに割り当て', okText: '実行' })) return;

    const room = window.SanpoCanonicalState?.get?.();
    const type = room?.activeAllocationType === 'team' ? 'team' : 'car';
    const allocation = room?.allocations?.[type];
    if (!room || !allocation) return;

    window.SanpoCanonicalState.ensureAllParticipantsPlaced(allocation, room.participants || {});
    const movableIds = Object.entries(allocation.placements || {})
        .filter(([, placement]) => isRandomlyMovablePlacement(placement))
        .map(([participantId]) => participantId);
    if (!movableIds.length) {
        window.AppUI?.showStatus?.('ランダムに割り当てる参加者がいません。', { tone: 'neutral', duration: 2200 });
        return;
    }

    const now = window.SanpoClock?.now?.() ?? Date.now();
    const slots = shuffleArray(randomSlotsFromCanonical(allocation));
    const shuffled = shuffleArray(movableIds);
    slots.forEach(slot => {
        const participantId = shuffled.shift();
        if (!participantId) return;
        allocation.placements[participantId] = { kind: 'member', groupId: slot.groupId, order: slot.order, updatedAt: now };
    });
    shuffled.forEach((participantId, order) => {
        allocation.placements[participantId] = { kind: 'waiting', groupId: '', order, updatedAt: now };
    });
    window.SanpoCanonicalState.ensureAllParticipantsPlaced(allocation, room.participants || {});
    window.renderActiveCarPlanToDom?.();

    lastAutoAssignLabel = 'ランダムに割り当て';
    updateUI();
    // This is an allocation-wide canonical mutation. A debounced projection
    // save leaves a window where an initial remote read can repaint the old
    // allocation and make every newly assigned person appear to disappear.
    const snapshot = window.SanpoCanonicalState?.get?.() || room;
    if (window.SanpoSync?.saveImmediate) {
        void window.SanpoSync.saveImmediate({ snapshot });
    } else {
        save();
    }
    // The guard defers any already-queued remote paint until the immediate
    // transaction has finished; it never releases it while syncWriteInFlight.
    window.SanpoRemoteGuard?.requestPendingApply?.();
    window.SanpoAssignmentWorkspace?.refresh?.();
}
window.autoAssign = autoAssign;
