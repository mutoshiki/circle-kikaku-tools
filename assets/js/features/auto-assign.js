// Auto assignment feature.
// Owns random/fill allocation and the optional grade grouping condition.

function getAutoAssignConditionItems(opts = null) {
    const source = opts || { g: byId('optGrade')?.checked };
    return source.g ? ['学年'] : [];
}

function updateAutoAssignSummary() {
    const el = byId('autoAssignSummary');
    if (!el) return;
    const items = getAutoAssignConditionItems();
    el.textContent = items.length ? `条件：${items.join('・')}` : '条件：なし';
}
window.updateAutoAssignSummary = updateAutoAssignSummary;

function buildAutoAssignAppliedLabel(opts, mode) {
    if (mode === 'fill') return '空きを埋める';
    return opts?.g ? '学年' : 'ランダム割当';
}

function updateLastAutoAssignCondition() {
    const el = byId('lastAutoAssignCondition');
    if (!el) return;
    const text = lastAutoAssignLabel || '未実行';
    el.innerHTML = `<span data-carbon-icon="shuffle" aria-hidden="true"></span><span>${escapeHtml(text)}</span>`;
    el.classList.toggle('is-empty', !lastAutoAssignLabel);
}

function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function buildCarStates() {
    const states = shuffleArray(Array.from($$('.car-box')).map(box => {
        const slots = Array.from($$('.seat-slot', box));
        const currentMembers = slots.flatMap(slot => getRealSeatCards(slot).map(getMemData));
        const grades = {};
        currentMembers.forEach(member => {
            const grade = parseInt(member.grade) || 0;
            if (grade > 0) grades[grade] = (grades[grade] || 0) + 1;
        });
        return {
            box,
            slots,
            freeSlots: slots.filter(slot => getRealSeatCards(slot).length === 0),
            counts: { total: currentMembers.length, grades }
        };
    }));
    states.forEach((state, index) => { state.index = index; });
    return states;
}

function placeMemberIntoState(state, member) {
    const slot = state.freeSlots.shift();
    if (!slot) return false;
    addMember(
        member.name,
        member.memo,
        '',
        member.grade || 0,
        slot,
        member.locked,
        member.flag,
        member.participantId || '',
        member.driver === true || member.isDriver === true
    );
    state.counts.total += 1;
    const grade = parseInt(member.grade) || 0;
    if (grade > 0) state.counts.grades[grade] = (state.counts.grades[grade] || 0) + 1;
    return true;
}

function assignPureRandom(members, carStates) {
    const remaining = shuffleArray([...members]);
    const usableCars = carStates.filter(state => state.freeSlots.length > 0);
    const emptyCars = usableCars.filter(state => state.counts.total === 0);

    emptyCars.slice(0, remaining.length).forEach(state => {
        if (remaining.length) placeMemberIntoState(state, remaining.shift());
    });

    const randomSlots = shuffleArray(usableCars.flatMap(state => state.freeSlots.map(slot => ({ state, slot }))));
    randomSlots.forEach(({ state }) => {
        if (remaining.length) placeMemberIntoState(state, remaining.shift());
    });
    return remaining;
}

function assignByGrade(members, carStates) {
    const remaining = [];
    shuffleArray([...members]).forEach(member => {
        const candidates = carStates.filter(state => state.freeSlots.length > 0);
        if (!candidates.length) {
            remaining.push(member);
            return;
        }
        candidates.sort((a, b) => {
            const grade = parseInt(member.grade) || 0;
            const aAffinity = grade ? (a.counts.grades[grade] || 0) * 3 : 0;
            const bAffinity = grade ? (b.counts.grades[grade] || 0) * 3 : 0;
            const aLoad = a.counts.total / Math.max(a.slots.length, 1);
            const bLoad = b.counts.total / Math.max(b.slots.length, 1);
            if (aAffinity !== bAffinity) return bAffinity - aAffinity;
            if (aLoad !== bLoad) return aLoad - bLoad;
            if (a.counts.total !== b.counts.total) return a.counts.total - b.counts.total;
            return a.index - b.index;
        });
        if (!placeMemberIntoState(candidates[0], member)) remaining.push(member);
    });
    return remaining;
}

async function autoAssign(mode) {
    const opts = { g: !!byId('optGrade')?.checked };
    const members = [];

    if (mode === 'shuffle') {
        const message = opts.g ? '学年をまとめて自動割り当てします。' : 'ランダムで自動割り当てします。';
        if (!await appConfirm(message, { title: 'ランダム割当', okText: '実行' })) return;
        $$('.seat-slot').forEach(slot => getRealSeatCards(slot)
            .filter(member => member.dataset.locked !== 'true')
            .forEach(member => { members.push(getMemData(member)); member.remove(); }));
        $$('#waiting-list .member-card:not([data-locked="true"])').forEach(member => {
            members.push(getMemData(member));
            member.remove();
        });
    } else {
        $$('#waiting-list .member-card').forEach(member => {
            members.push(getMemData(member));
            member.remove();
        });
    }

    if (!members.length) return;
    const carStates = buildCarStates();
    const leftOvers = opts.g ? assignByGrade(members, carStates) : assignPureRandom(members, carStates);
    leftOvers.forEach(member => addMember(
        member.name,
        member.memo,
        '',
        member.grade || 0,
        $('#waiting-list'),
        member.locked,
        member.flag,
        member.participantId || '',
        false
    ));
    lastAutoAssignLabel = buildAutoAssignAppliedLabel(opts, mode);
    updateUI();
    save();
}
window.autoAssign = autoAssign;
