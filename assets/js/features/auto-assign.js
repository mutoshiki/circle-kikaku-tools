// Random assignment feature.
// Allocation has one bulk action only: randomly redistribute movable participants.

function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function buildRandomAssignmentSlots() {
    return shuffleArray(Array.from($$('.car-box')).flatMap(box =>
        Array.from($$('.seat-slot', box)).filter(slot => getRealSeatCards(slot).length === 0)
    ));
}

function appendAssignmentMember(member, parent) {
    return addMember(
        member.name,
        member.memo,
        '',
        member.grade || 0,
        parent,
        member.locked,
        member.flag,
        member.participantId || '',
        member.driver === true || member.isDriver === true
    );
}

// data-state.js still restores the historical lastAutoAssignLabel field because it is
// part of persisted room compatibility. There are no longer condition controls to sync.
function updateLastAutoAssignCondition() {}

async function autoAssign() {
    if (!await appConfirm('参加者をランダムに割り当てます。', { title: 'ランダムに割り当て', okText: '実行' })) return;

    const members = [];
    $$('.seat-slot').forEach(slot => getRealSeatCards(slot)
        .filter(member => member.dataset.locked !== 'true')
        .forEach(member => {
            members.push(getMemData(member));
            member.remove();
        }));
    $$('#waiting-list .member-card:not([data-locked="true"])').forEach(member => {
        members.push(getMemData(member));
        member.remove();
    });

    if (!members.length) {
        window.AppUI?.showStatus?.('ランダムに割り当てる参加者がいません。', { tone: 'neutral', duration: 2200 });
        return;
    }

    const slots = buildRandomAssignmentSlots();
    const shuffled = shuffleArray(members);
    slots.forEach(slot => {
        const member = shuffled.shift();
        if (member) appendAssignmentMember(member, slot);
    });
    shuffled.forEach(member => appendAssignmentMember(member, $('#waiting-list')));

    lastAutoAssignLabel = 'ランダムに割り当て';
    updateUI();
    save();
    window.SanpoRemoteGuard?.requestPendingApply?.();
    window.SanpoAssignmentWorkspace?.refresh?.();
}
window.autoAssign = autoAssign;
