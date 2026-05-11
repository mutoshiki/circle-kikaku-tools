// Auto assignment and local gender heuristic feature
// Owns auto-assign conditions, local name heuristic, and assignment algorithms.

function getAutoAssignConditionItems(opts = null) {
    const source = opts || {
        f: byId('optFemale')?.checked,
        m: byId('optMale')?.checked,
        g: byId('optGrade')?.checked
    };
    const items = [];
    if (source.f) items.push('女子');
    if (source.m) items.push('男子');
    if (source.g) items.push('学年');
    return items;
}

function updateAutoAssignSummary() {
    const el = byId('autoAssignSummary');
    if (!el) return;
    const items = getAutoAssignConditionItems();
    el.textContent = items.length ? `現在：${items.join('・')}をまとめる` : '現在：ランダム';
}
window.updateAutoAssignSummary = updateAutoAssignSummary;

function buildAutoAssignAppliedLabel(opts, mode) {
    const items = getAutoAssignConditionItems(opts);
    const condition = items.length ? `${items.join('・')}をまとめる` : 'ランダム';
    const scope = mode === 'fill' ? '空席のみ' : '全体を組み直し';
    return `自動割当：${condition} / ${scope}`;
}

function updateLastAutoAssignCondition() {
    const el = byId('lastAutoAssignCondition');
    if (!el) return;
    const text = lastAutoAssignLabel || '自動割当：未実行';
    el.innerHTML = `<i class="fas fa-random"></i><span>${escapeHtml(text)}</span>`;
    el.classList.toggle('is-empty', !lastAutoAssignLabel);
}

function normalizeNameForGenderHeuristic(name) {
    return String(name || '')
        .replace(/[ 　\t\r\n]+/g, '')
        .replace(/[様さん君くんちゃん先輩後輩氏]/g, '')
        .trim();
}

function getGivenNameCandidate(name) {
    const raw = String(name || '').trim();
    const spaced = raw.split(/[ 　\t\r\n]+/).filter(Boolean);
    if (spaced.length >= 2) return spaced[spaced.length - 1];

    const compact = normalizeNameForGenderHeuristic(raw);
    if (!compact) return '';

    // Japanese full names are often 3-5 characters. Prefer the likely given-name tail.
    if (compact.length >= 5) return compact.slice(-2);
    if (compact.length >= 4) return compact.slice(-2);
    if (compact.length >= 3) return compact.slice(-2);
    return compact;
}

function scoreLocalGenderName(name) {
    const compact = normalizeNameForGenderHeuristic(name);
    const given = getGivenNameCandidate(name);
    const last = given.slice(-1);
    const last2 = given.slice(-2);

    let femaleScore = 0;
    let maleScore = 0;

    // Strong common endings.
    if (/[子美奈菜那花華香佳加果歌音乃野穂歩萌芽愛彩紗沙咲桜桃梨里莉理璃結優友由祐希姫]/.test(last)) femaleScore += 3;
    if (/[郎朗太大斗翔人仁也哉矢弥介佑祐助輔平兵真誠司志史士樹生雄男夫]/.test(last)) maleScore += 3;

    // Common two-character given-name endings.
    if (/(陽菜|結菜|優奈|美咲|美月|美優|美穂|美緒|彩花|彩乃|花音|香織|真由|真央|莉子|梨子|愛子|桃子|杏奈|琴音|七海|芽衣|紗季|沙紀|友香|由香|遥香|里奈|理奈|菜月|千尋)$/.test(given)) femaleScore += 5;
    if (/(太郎|一郎|二郎|三郎|大輔|祐介|裕介|健太|翔太|陽太|颯太|悠斗|拓海|大地|和也|拓也|直人|真人|健人|雄大|翔平|公平|大樹|直樹|一輝|和樹|智也|悠真|拓真|龍也|達也|勇人)$/.test(given)) maleScore += 5;

    // Common single-character names.
    if (/^(葵|凛|澪|楓|杏|舞|唯|茜|遥|愛|結)$/.test(given)) femaleScore += 3;
    if (/^(蓮|樹|翔|翼|陸|駿|匠|隼|仁|誠|司|学|健)$/.test(given)) maleScore += 3;

    // Ambiguous endings are weak only.
    if (/[希葵陽遥優翼光空海晴]/.test(last)) {
        femaleScore += 1;
        maleScore += 1;
    }

    // Explicit notes sometimes pasted with names.
    if (/[（(]女|女性|女子|女$/.test(compact)) femaleScore += 8;
    if (/[（(]男|男性|男子|男$/.test(compact)) maleScore += 8;

    const diff = femaleScore - maleScore;
    if (diff >= 3) return 'female';
    if (diff <= -3) return 'male';
    return 'unknown';
}

function applyDetectedGenderToName(name, gender) {
    if (!gender || gender === 'unknown') return;
    $$('.member-card, .driver-seat').forEach(person => {
        if (person.dataset.name !== name) return;
        if (person.dataset.gender && person.dataset.gender !== 'unknown') return;
        person.dataset.gender = gender;
        updatePersonGenderBadge(person);
        const grade = parseInt(person.dataset.grade) || 0;
        const oldBadge = person.querySelector('.grade-badge');
        if (oldBadge && grade > 0) {
            oldBadge.className = `grade-badge ${gradeGenderClass(gender)}`;
        }
    });
}

function detectGender(name) {
    if (!AUTO_GENDER_HEURISTIC) return;
    const cleanName = String(name || '').trim();
    if (!cleanName) return;
    genderQueue.push(cleanName);
    processGenderQueue();
}
async function processGenderQueue() {
    if (isProcessingQueue) return;
    isProcessingQueue = true;
    try {
        while (genderQueue.length) {
            const name = genderQueue.shift();
            // プライバシー優先：外部APIへ送らず、端末内の簡易推定だけを行う。
            const g = scoreLocalGenderName(name);
            applyDetectedGenderToName(name, g);
            await new Promise(r => setTimeout(r, 30));
        }
        save();
    } finally {
        isProcessingQueue = false;
    }
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
        const counts = {
            total: currentMembers.length,
            female: currentMembers.filter(m => m.gender === 'female').length,
            male: currentMembers.filter(m => m.gender === 'male').length,
            grades: {}
        };
        currentMembers.forEach(m => {
            const grade = parseInt(m.grade) || 0;
            if (grade > 0) counts.grades[grade] = (counts.grades[grade] || 0) + 1;
        });
        return {
            box,
            slots,
            freeSlots: slots.filter(slot => getRealSeatCards(slot).length === 0),
            counts
        };
    }));
    states.forEach((state, index) => { state.index = index; });
    return states;
}

function placeMemberIntoState(state, member) {
    const slot = state.freeSlots.shift();
    if (!slot) return false;
    addMember(member.name, member.memo, member.gender, member.grade || 0, slot, member.locked);
    state.counts.total += 1;
    if (member.gender === 'female') state.counts.female += 1;
    if (member.gender === 'male') state.counts.male += 1;
    const grade = parseInt(member.grade) || 0;
    if (grade > 0) state.counts.grades[grade] = (state.counts.grades[grade] || 0) + 1;
    return true;
}

function assignPureRandom(members, carStates) {
    const remaining = shuffleArray([...members]);
    const usableCars = carStates.filter(state => state.freeSlots.length > 0);
    const emptyCars = usableCars.filter(state => state.counts.total === 0);

    if (emptyCars.length) {
        emptyCars.slice(0, remaining.length).forEach(state => {
            if (!remaining.length) return;
            placeMemberIntoState(state, remaining.shift());
        });
    }

    const randomSlots = shuffleArray(usableCars.flatMap(state =>
        state.freeSlots.map(slot => ({ state, slot }))
    ));

    randomSlots.forEach(({ state }) => {
        if (!remaining.length) return;
        placeMemberIntoState(state, remaining.shift());
    });

    return remaining;
}

function assignBalanced(members, carStates, opts) {
    const remaining = [];
    shuffleArray([...members]).forEach(member => {
        const candidates = carStates.filter(state => state.freeSlots.length > 0);
        if (!candidates.length) {
            remaining.push(member);
            return;
        }

        candidates.sort((a, b) => {
            const aAffinity =
                (opts.f && member.gender === 'female' ? a.counts.female * 2 : 0) +
                (opts.m && member.gender === 'male' ? a.counts.male * 2 : 0) +
                (opts.g && member.grade ? (a.counts.grades[member.grade] || 0) * 3 : 0);
            const bAffinity =
                (opts.f && member.gender === 'female' ? b.counts.female * 2 : 0) +
                (opts.m && member.gender === 'male' ? b.counts.male * 2 : 0) +
                (opts.g && member.grade ? (b.counts.grades[member.grade] || 0) * 3 : 0);
            const aLoad = a.counts.total / Math.max(a.slots.length, 1);
            const bLoad = b.counts.total / Math.max(b.slots.length, 1);
            if (aAffinity !== bAffinity) return bAffinity - aAffinity;
            if (aLoad !== bLoad) return aLoad - bLoad;
            if (a.counts.total !== b.counts.total) return a.counts.total - b.counts.total;
            return a.index - b.index;
        });

        if (!placeMemberIntoState(candidates[0], member)) {
            remaining.push(member);
        }
    });
    return remaining;
}

async function autoAssign(mode) {
    const opts = { f:$('#optFemale').checked, m:$('#optMale').checked, g:$('#optGrade').checked };
    let mems = [];
    
    if(mode === 'shuffle') {
        if(!await appConfirm('配置済みのメンバーも含めて再シャッフルしますか？固定済みの人は残します。', { title: '自動割り当て', okText: '組み直す' })) return;
        $$('.seat-slot').forEach(slot => getRealSeatCards(slot).filter(m => m.dataset.locked !== 'true').forEach(m => { mems.push(getMemData(m)); m.remove(); }));
        $$('#waiting-list .member-card:not([data-locked="true"])').forEach(m => { mems.push(getMemData(m)); m.remove(); });
    } else {
        $$('#waiting-list .member-card').forEach(m => { mems.push(getMemData(m)); m.remove(); });
    }
    
    if(!mems.length) return;

    const carStates = buildCarStates();
    const leftOvers = (opts.f || opts.m || opts.g)
        ? assignBalanced(mems, carStates, opts)
        : assignPureRandom(mems, carStates);

    leftOvers.forEach(m => addMember(m.name, m.memo, m.gender, m.grade || 0, $('#waiting-list'), m.locked));
    lastAutoAssignLabel = buildAutoAssignAppliedLabel(opts, mode);
    updateUI(); save();
}
window.autoAssign = autoAssign;
