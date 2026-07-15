// Compact person menu feature
// Owns member/driver quick action menus and the shared edit modal entry point.

let activePersonMenuTarget = null;

function closePersonMenus() {
    document.querySelectorAll('.person-pop-menu').forEach(menu => menu.remove());
    activePersonMenuTarget = null;
}

function getActivePersonMenuTarget() {
    return activePersonMenuTarget;
}
window.getActivePersonMenuTarget = getActivePersonMenuTarget;

function positionPersonMenu(menu, anchor = null) {
    const margin = 8;
    let left = Math.max(margin, Math.round((window.innerWidth - menu.offsetWidth) / 2));
    let top = Math.max(margin, Math.round((window.innerHeight - menu.offsetHeight) / 2));
    if (anchor) {
        const rect = anchor.getBoundingClientRect();
        left = Math.min(window.innerWidth - menu.offsetWidth - margin, Math.max(margin, rect.right - menu.offsetWidth));
        top = Math.min(window.innerHeight - menu.offsetHeight - margin, Math.max(margin, rect.bottom + 6));
    }
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
}

function openChoicePopup(title, choices, onPick) {
    closePersonMenus();
    const menu = ce('div', 'person-pop-menu choice-menu');
    menu.innerHTML = `<div class="person-pop-title">${escapeHtml(title)}</div>` + choices.map(choice => `
        <button type="button" class="person-pop-item" data-value="${escapeHtml(choice.value)}"${choice.flag ? ` data-flag-choice="${escapeHtml(choice.value)}"` : ''}>
            <i class="${choice.icon || 'fas fa-circle'}" aria-hidden="true"></i><span>${escapeHtml(choice.label)}</span>
        </button>
    `).join('');
    menu.addEventListener('click', event => {
        const item = event.target.closest('.person-pop-item');
        if (!item) return;
        event.preventDefault();
        event.stopPropagation();
        onPick(item.dataset.value);
        closePersonMenus();
    });
    document.body.appendChild(menu);
    positionPersonMenu(menu);
}

function updatePersonGradeBadge(person) {
    if (!person) return;
    const grade = parseInt(person.dataset.grade) || 0;
    const line = $('.member-main-line, .driver-main-line', person);
    if (!line) return;
    line.querySelector('.grade-badge')?.remove();
    if (grade > 0) {
        const badge = ce('span', `grade-badge ${gradeGenderClass(person.dataset.gender)}`);
        badge.dataset.grade = String(grade);
        badge.textContent = `${grade}年`;
        const menuBtn = line.querySelector('.member-menu-btn, .driver-menu-btn');
        line.insertBefore(badge, menuBtn || null);
    }
}

function updatePersonGenderBadge(person) {
    if (!person) return;
    const line = $('.member-main-line, .driver-main-line', person);
    if (!line) return;
    line.querySelector('.gender-badge')?.remove();
    const badge = line.querySelector('.grade-badge');
    if (badge) {
        badge.classList.remove('grade-male', 'grade-female', 'grade-unknown');
        badge.classList.add(gradeGenderClass(person.dataset.gender));
    }
}

function setPersonGrade(person, gradeValue) {
    const grade = Math.max(0, Math.min(4, parseInt(gradeValue) || 0));
    person.dataset.grade = String(grade);
    updatePersonGradeBadge(person);
    updateUI();
    save();
}

function setPersonGender(person, gender) {
    const next = ['male', 'female', 'unknown'].includes(gender) ? gender : 'unknown';
    person.dataset.gender = next;
    updatePersonGenderBadge(person);
    updateUI();
    save();
}

function updatePersonFlagBadge(person) {
    if (!person) return;
    person.dataset.flag = normalizePersonFlag(person.dataset.flag);
    const line = $('.member-main-line, .driver-main-line', person);
    if (!line) return;
    line.querySelector('.person-flag')?.remove();
    const holder = document.createElement('template');
    holder.innerHTML = renderPersonFlag(person.dataset.flag);
    const badge = holder.content.firstElementChild;
    const grade = line.querySelector('.grade-badge');
    line.insertBefore(badge, grade || line.querySelector('.member-menu-btn, .driver-menu-btn'));
}

function syncFlagAcrossPlans(name, flag) {
    const key = normalizeParticipantKey(name);
    syncActiveCarPlanFromDom();
    (carPlans || []).forEach(plan => {
        (plan.waiting || []).forEach(member => {
            if (normalizeParticipantKey(member.name) === key) member.flag = flag;
        });
        (plan.cars || []).forEach(group => {
            if (normalizeParticipantKey(group.name) === key) group.driverFlag = flag;
            (group.members || []).forEach(member => {
                if (normalizeParticipantKey(member.name) === key) member.flag = flag;
            });
        });
    });
}

function setPersonFlag(person, value) {
    if (!person) return;
    const flag = normalizePersonFlag(value);
    const name = person.dataset.name || $('.member-name-text, .driver-name-disp', person)?.textContent || '';
    $$('.member-card, .driver-seat').forEach(candidate => {
        const candidateName = candidate.dataset.name || $('.member-name-text, .driver-name-disp', candidate)?.textContent || '';
        if (normalizeParticipantKey(candidateName) !== normalizeParticipantKey(name)) return;
        candidate.dataset.flag = flag;
        updatePersonFlagBadge(candidate);
    });
    syncFlagAcrossPlans(name, flag);
    updateUI();
    save();
}

async function returnOrDeleteMemberCard(card) {
    if (!card) return;
    if (card.dataset.locked === 'true') {
        showAppNotice('固定されています。先に固定を解除してください。', true);
        return;
    }
    let changed = false;
    if (card.parentElement?.id === 'waiting-list') {
        if (await appConfirm('このメンバーを完全に削除しますか？', { title: 'メンバー削除', okText: '削除', danger: true })) { card.remove(); changed = true; }
    } else if (await appConfirm('車から降ろして未割り当てメンバーに戻しますか？', { title: '未割り当てに戻す', okText: '戻す' })) {
        $('#waiting-list')?.appendChild(card);
        changed = true;
    }
    if (!changed) return;
    updateUI();
    save();
}

function handleCompactPersonAction(action, person = activePersonMenuTarget) {
    if (!action || !person) return;
    const card = person.closest?.('.member-card') || null;
    const driver = person.closest?.('.driver-seat') || null;
    const isDriver = !!driver;
    const targetPerson = card || driver;
    if (!targetPerson) return;

    // Keep the selected person before closing/removing the floating menu.
    closePersonMenus();

    if (action === 'memo') handleEdit(isDriver ? 'driverMemo' : 'memo', targetPerson);
    else if (action === 'lock' && card) toggleLock(card);
    else if (action === 'return' && card) returnOrDeleteMemberCard(card);
    else if (action === 'name') handleEdit(isDriver ? 'driverName' : 'memberName', targetPerson);
    else if (action === 'grade') openChoicePopup('学年', [
        { value: '0', label: '未設定', icon: 'fas fa-minus' },
        { value: '1', label: '1年', icon: 'fas fa-1' },
        { value: '2', label: '2年', icon: 'fas fa-2' },
        { value: '3', label: '3年', icon: 'fas fa-3' },
        { value: '4', label: '4年', icon: 'fas fa-4' }
    ], value => setPersonGrade(targetPerson, value));
    else if (action === 'gender') openChoicePopup('性別', [
        { value: 'male', label: '男性', icon: 'fas fa-mars' },
        { value: 'female', label: '女性', icon: 'fas fa-venus' },
        { value: 'unknown', label: '未設定', icon: 'fas fa-circle-question' }
    ], value => setPersonGender(targetPerson, value));
    else if (action === 'flag') openChoicePopup('しるし', [
        { value: 'none', label: 'しるしなし', icon: 'fas fa-ban', flag: true },
        { value: 'blue', label: '青', icon: 'fas fa-flag', flag: true },
        { value: 'purple', label: '紫', icon: 'fas fa-flag', flag: true },
        { value: 'yellow', label: '黄', icon: 'fas fa-flag', flag: true },
        { value: 'red', label: '赤', icon: 'fas fa-flag', flag: true }
    ], value => setPersonFlag(targetPerson, value));
}
window.handleCompactPersonAction = handleCompactPersonAction;

function openCompactPersonMenu(trigger) {
    closePersonMenus();
    const card = trigger.closest('.member-card');
    const driver = trigger.closest('.driver-seat');
    const person = card || driver;
    if (!person) return;
    activePersonMenuTarget = person;
    const isDriver = !!driver;
    const inWaiting = card?.parentElement?.id === 'waiting-list';
    const locked = card?.dataset.locked === 'true';
    const actions = isDriver
        ? [
            ['memo', 'メモ', 'fas fa-sticky-note'],
            ['flag', 'しるし', 'fas fa-flag'],
            ['grade', '学年', 'fas fa-graduation-cap'],
            ['gender', '性別', 'fas fa-venus-mars'],
            ['name', '名前変更', 'fas fa-pen']
          ]
        : [
            ['memo', 'メモ', 'fas fa-sticky-note'],
            ['flag', 'しるし', 'fas fa-flag'],
            ['lock', locked ? '固定解除' : '固定', locked ? 'fas fa-lock-open' : 'fas fa-lock'],
            ['return', inWaiting ? '削除' : '戻す', inWaiting ? 'fas fa-trash-can' : 'fas fa-reply'],
            ['grade', '学年', 'fas fa-graduation-cap'],
            ['gender', '性別', 'fas fa-venus-mars'],
            ['name', '名前変更', 'fas fa-pen']
          ];
    const menu = ce('div', 'person-pop-menu');
    menu.innerHTML = actions.map(([action, label, icon]) => `
        <button type="button" class="person-pop-item ${action === 'return' && inWaiting ? 'danger' : ''}" data-person-action="${action}">
            <i class="${icon}" aria-hidden="true"></i><span>${label}</span>
        </button>
    `).join('');
    menu.addEventListener('click', event => {
        const item = event.target.closest('.person-pop-item');
        if (!item) return;
        event.preventDefault();
        event.stopPropagation();
        handleCompactPersonAction(item.dataset.personAction, person);
    });
    document.body.appendChild(menu);
    positionPersonMenu(menu, trigger);
}

function shouldKeepPersonMenuForTarget(target) {
    return !!target?.closest?.('.person-pop-menu, .member-menu-btn, .driver-menu-btn');
}


function ensureCompactMenuFallback() {
    if (window.__compactMenuFallbackBound) return;
    window.__compactMenuFallbackBound = true;
    document.addEventListener('click', event => {
        const menuTrigger = event.target.closest?.('.member-menu-btn, .driver-menu-btn');
        if (!menuTrigger) return;
        event.preventDefault();
        event.stopPropagation();
        if (typeof openCompactPersonMenu === 'function') openCompactPersonMenu(menuTrigger);
    }, false);
}

function setupCompactPersonMenu() {
    if (setupCompactPersonMenu.bound === true) return;
    setupCompactPersonMenu.bound = true;

    D.addEventListener('click', event => {
        const menuTrigger = event.target.closest?.('.member-menu-btn, .driver-menu-btn');
        if (menuTrigger) {
            event.preventDefault();
            event.stopPropagation();
            openCompactPersonMenu(menuTrigger);
            return;
        }
        if (event.target.closest?.('.person-pop-menu')) return;
        if (event.target.closest?.('.member-name-text, .driver-name-disp')) {
            // 名前タップで性別が切り替わる旧挙動は廃止。
            event.stopPropagation();
            closePersonMenus();
            return;
        }
        closePersonMenus();
    }, true);

    // click が発火しないスマホのスクロール、ドラッグ開始、外側タップでも確実に閉じる。
    D.addEventListener('pointerdown', event => {
        if (shouldKeepPersonMenuForTarget(event.target)) return;
        closePersonMenus();
    }, true);

    D.addEventListener('touchmove', event => {
        if (event.target.closest?.('.person-pop-menu')) return;
        closePersonMenus();
    }, { passive: true, capture: true });

    D.addEventListener('wheel', event => {
        if (event.target.closest?.('.person-pop-menu')) return;
        closePersonMenus();
    }, { passive: true, capture: true });

    D.addEventListener('keydown', event => {
        if (event.key === 'Escape') closePersonMenus();
    }, true);

    window.addEventListener('resize', closePersonMenus, { passive: true });
    window.addEventListener('orientationchange', closePersonMenus, { passive: true });
}

function handleEdit(type, el) {
    const isCap = type === 'capacity';
    const box = isCap ? el.closest('.car-box') : null;
    const card = !isCap ? el.closest('.member-card') : null;
    const driver = !isCap && !card ? el.closest('.driver-seat') : null;

    let initialVal = '', title = '';
    if(isCap) { title = '定員変更'; initialVal = el.val(); }
    else if (type === 'memberName' && card) { title = '名前変更'; initialVal = card.dataset.name || $('.member-name-text', card).innerText; }
    else if (type === 'driverName' && driver) { title = '名前変更'; initialVal = driver.dataset.name || $('.driver-name-disp', driver).innerText; }
    else if (card) { title = 'メモ編集'; initialVal = $('.memo-popup', card).innerText; } 
    else if (driver) { title = '車出しメモ'; initialVal = $('.driver-memo-text', driver).innerText; }

    const editTitleEl = $('#commonEditModalTitle');
    if (editTitleEl) editTitleEl.innerText = title;
    $('#editModalInput').value = initialVal;
    
    saveCb = () => {
        const v = $('#editModalInput').value;
        if(isCap) {
            const newC = getInt(v);
            if(newC > 0) {
                const boxEl = el.closest('.car-box');
                const grid = $('.car-layout-grid', boxEl);
                const current = $$('.seat-slot', grid);
                if(newC > current.length) {
                    for(let i=0; i<newC-current.length; i++) {
                        const d = ce('div','seat-slot'); grid.appendChild(d); setupSortable(d);
                    }
                } else if(newC < current.length) {
                    for(let i=current.length-1; i>=newC; i--) {
                        if(current[i].children.length) $('#waiting-list').appendChild(current[i].children[0]);
                        current[i].remove();
                    }
                }
                boxEl.dataset.capacity = newC;
            }
        } else if (type === 'memberName' && card) {
            const nextName = v.trim();
            if (!nextName) return;
            card.dataset.name = nextName;
            $('.member-name-text', card).textContent = nextName;
        } else if (type === 'driverName' && driver) {
            const nextName = v.trim();
            if (!nextName) return;
            const oldName = driver.dataset.name || $('.driver-name-disp', driver).innerText;
            driver.dataset.name = nextName;
            $('.driver-name-disp', driver).textContent = nextName;
            const boxEl = driver.closest('.car-box');
            const label = $('.car-name-label', boxEl);
            if (label) label.textContent = `${nextName}${typeof getActiveGroupSuffix === 'function' ? getActiveGroupSuffix() : '車'}`;
            if (settlementState?.cars?.[oldName] && !settlementState.cars[nextName]) {
                settlementState.cars[nextName] = settlementState.cars[oldName];
                delete settlementState.cars[oldName];
            }
        } else if (card) {
            const m = $('.memo-popup', card); m.innerText = v; m.style.display = v?'block':'none';
        } else if (driver) {
            const m = $('.driver-memo-text', driver); m.innerText = v; m.style.display = v?'block':'none';
        }
        modals.edit.hide(); updateUI(); save();
    };
    modals.edit.show();
}
