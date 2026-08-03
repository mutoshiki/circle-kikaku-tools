// Compact person menu feature
// Owns member/driver quick action menus and the shared edit modal entry point.

let activePersonMenuTarget = null;
let activePersonMenuTrigger = null;

function closePersonMenus() {
    document.querySelectorAll('cds-menu.person-pop-menu').forEach(menu => menu.remove());
    activePersonMenuTarget = null;
    activePersonMenuTrigger = null;
}

function getActivePersonMenuTarget() {
    return activePersonMenuTarget;
}
window.getActivePersonMenuTarget = getActivePersonMenuTarget;

function getPersonMenuViewport() {
    const viewport = window.visualViewport;
    return {
        left: viewport?.offsetLeft || 0,
        top: viewport?.offsetTop || 0,
        width: viewport?.width || window.innerWidth,
        height: viewport?.height || window.innerHeight
    };
}

function positionPersonMenu(menu, anchor = activePersonMenuTrigger) {
    if (!menu?.isConnected) return;
    const viewport = getPersonMenuViewport();
    const margin = 8;
    const gap = 4;
    const items = Array.from(menu.querySelectorAll('cds-menu-item'));
    const width = Math.min(224, viewport.width - margin * 2);
    items.forEach(item => { item.style.width = `${width}px`; });

    Promise.all([menu, ...items].map(control => Promise.resolve(control.updateComplete))).then(() => {
        requestAnimationFrame(() => {
            if (!menu.isConnected) return;
            const measuredHeight = items.reduce((sum, item) => sum + Math.max(0, item.getBoundingClientRect().height), 0) || items.length * 48;
            const height = Math.min(measuredHeight, viewport.height - margin * 2);
            let left = viewport.left + Math.max(margin, (viewport.width - width) / 2);
            let top = viewport.top + Math.max(margin, (viewport.height - height) / 2);
            if (anchor?.isConnected) {
                const rect = anchor.getBoundingClientRect();
                const roomBelow = viewport.top + viewport.height - rect.bottom - margin - gap;
                const roomAbove = rect.top - viewport.top - margin - gap;
                const openBelow = roomBelow >= height || roomBelow >= roomAbove;
                left = rect.right - width;
                top = openBelow ? rect.bottom + gap : rect.top - gap - height;
            }
            left = Math.min(viewport.left + viewport.width - width - margin, Math.max(viewport.left + margin, left));
            top = Math.min(viewport.top + viewport.height - height - margin, Math.max(viewport.top + margin, top));
            const x = Math.round(left);
            const y = Math.round(top);
            menu.position = 'fixed';
            menu.x = x;
            menu.y = y;
            Promise.resolve(menu.updateComplete).then(() => {
                if (!menu.isConnected) return;
                menu.style.setProperty('inset-inline-start', `${x}px`);
                menu.style.setProperty('inset-inline-end', 'initial');
                menu.style.setProperty('inset-block-start', `${y}px`);
            });
        });
    });
}

function personMenuItemFromEvent(event) {
    return event.composedPath?.().find(node => node?.matches?.('cds-menu-item')) || event.target.closest?.('cds-menu-item');
}

function createPersonMenu({ label = '操作メニュー' } = {}) {
    const menu = ce('cds-menu', 'person-pop-menu');
    menu.open = true;
    menu.position = 'fixed';
    menu.size = 'lg';
    menu.label = label;
    menu.setAttribute('aria-label', label);
    return menu;
}

function renderPersonMenuItem({ value = '', label = '', icon = '', danger = false, flag = '' } = {}) {
    const item = ce('cds-menu-item', 'person-pop-item');
    item.setAttribute('label', label);
    item.dataset.value = value;
    if (danger) item.setAttribute('kind', 'danger');
    if (flag) item.dataset.flagChoice = flag;
    if (icon) {
        const iconSlot = ce('span');
        iconSlot.setAttribute('slot', 'render-icon');
        iconSlot.setAttribute('data-carbon-icon', icon);
        iconSlot.setAttribute('aria-hidden', 'true');
        item.appendChild(iconSlot);
    }
    return item;
}

function openChoicePopup(title, choices, onPick, anchor = activePersonMenuTrigger) {
    document.querySelectorAll('cds-menu.person-pop-menu').forEach(menu => menu.remove());
    const menu = createPersonMenu({ label: `${title}を選択` });
    choices.forEach(choice => menu.appendChild(renderPersonMenuItem({
        value: choice.value,
        label: choice.label,
        icon: choice.icon || 'circle--filled',
        flag: choice.flag ? choice.value : ''
    })));
    menu.addEventListener('click', event => {
        const item = personMenuItemFromEvent(event);
        if (!item) return;
        event.preventDefault();
        event.stopPropagation();
        onPick(item.dataset.value);
        closePersonMenus();
    });
    document.body.appendChild(menu);
    positionPersonMenu(menu, anchor);
}

function ensurePersonMeta(line) {
    if (!line) return null;
    let meta = line.querySelector('.person-meta');
    if (!meta) {
        meta = ce('div', 'person-meta');
        line.insertBefore(meta, line.querySelector('.member-menu-btn, .driver-menu-btn') || null);
    }
    return meta;
}

function updatePersonGradeBadge(person) {
    if (!person) return;
    const grade = parseInt(person.dataset.grade) || 0;
    const line = $('.member-main-line, .driver-main-line', person);
    if (!line) return;
    const meta = ensurePersonMeta(line);
    meta?.querySelector('.grade-badge')?.remove();
    if (grade > 0 && meta) {
        const gender = person.dataset.gender || 'unknown';
        const badge = ce('cds-tag', `grade-badge carbon-display-tag ${gradeGenderClass(gender)}`);
        badge.dataset.grade = String(grade);
        badge.dataset.tagGroup = 'grade';
        badge.dataset.tagValue = gender;
        badge.setAttribute('type', window.SanpoTagTypes?.resolve('grade', gender) || 'gray');
        badge.setAttribute('size', 'sm');
        badge.textContent = `${grade}年`;
        badge.setAttribute('aria-label', window.SanpoTagTypes?.accessibleName('grade', gender, badge.textContent) || badge.textContent);
        meta.appendChild(badge);
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
        const gender = person.dataset.gender || 'unknown';
        badge.classList.add(gradeGenderClass(gender));
        badge.dataset.tagValue = gender;
        badge.setAttribute('type', window.SanpoTagTypes?.resolve('grade', gender) || 'gray');
        badge.setAttribute('aria-label', window.SanpoTagTypes?.accessibleName('grade', gender, badge.textContent) || badge.textContent);
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
    const meta = ensurePersonMeta(line);
    meta?.querySelector('.person-flag')?.remove();
    const holder = document.createElement('template');
    holder.innerHTML = renderPersonFlag(person.dataset.flag);
    const badge = holder.content.firstElementChild;
    if (!meta || !badge) return;
    const grade = meta.querySelector('.grade-badge');
    meta.insertBefore(badge, grade || null);
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

    // Keep the selected person and anchor before closing/removing the floating menu.
    const choiceAnchor = activePersonMenuTrigger || targetPerson.querySelector('.member-menu-btn, .driver-menu-btn');
    closePersonMenus();

    if (action === 'memo') handleEdit(isDriver ? 'driverMemo' : 'memo', targetPerson);
    else if (action === 'lock' && card) toggleLock(card);
    else if (action === 'return' && card) returnOrDeleteMemberCard(card);
    else if (action === 'name') handleEdit(isDriver ? 'driverName' : 'memberName', targetPerson);
    else if (action === 'grade') openChoicePopup('学年', [
        { value: '0', label: '未設定', icon: 'subtract' },
        { value: '1', label: '1年', icon: 'number--1' },
        { value: '2', label: '2年', icon: 'number--2' },
        { value: '3', label: '3年', icon: 'number--3' },
        { value: '4', label: '4年', icon: 'number--4' }
    ], value => setPersonGrade(targetPerson, value), choiceAnchor);
    else if (action === 'gender') openChoicePopup('性別', [
        { value: 'male', label: '男性', icon: 'gender--male' },
        { value: 'female', label: '女性', icon: 'gender--female' },
        { value: 'unknown', label: '未設定', icon: 'help' }
    ], value => setPersonGender(targetPerson, value), choiceAnchor);
    else if (action === 'flag') openChoicePopup('しるし', [
        { value: 'none', label: 'しるしなし', icon: 'close--outline', flag: true },
        { value: 'blue', label: '青', icon: 'flag', flag: true },
        { value: 'purple', label: '紫', icon: 'flag', flag: true },
        { value: 'yellow', label: '黄', icon: 'flag', flag: true },
        { value: 'red', label: '赤', icon: 'flag', flag: true }
    ], value => setPersonFlag(targetPerson, value), choiceAnchor);
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
            ['memo', 'メモ', 'notebook'],
            ['flag', 'しるし', 'flag'],
            ['grade', '学年', 'education'],
            ['gender', '性別', 'user-multiple'],
            ['name', '名前変更', 'edit']
          ]
        : [
            ['memo', 'メモ', 'notebook'],
            ['flag', 'しるし', 'flag'],
            ['lock', locked ? '固定解除' : '固定', locked ? 'unlocked' : 'locked'],
            ['return', inWaiting ? '削除' : '戻す', inWaiting ? 'trash-can' : 'undo'],
            ['grade', '学年', 'education'],
            ['gender', '性別', 'user-multiple'],
            ['name', '名前変更', 'edit']
          ];
    const name = person.dataset.name || person.querySelector('.member-name-text, .driver-name-disp')?.textContent || '参加者';
    const menu = createPersonMenu({ label: `${name}の操作` });
    actions.forEach(([action, label, icon]) => {
        const item = renderPersonMenuItem({
            value: action,
            label,
            icon,
            danger: action === 'return' && inWaiting
        });
        item.dataset.personAction = action;
        menu.appendChild(item);
    });
    menu.addEventListener('click', event => {
        const item = personMenuItemFromEvent(event);
        if (!item) return;
        event.preventDefault();
        event.stopPropagation();
        handleCompactPersonAction(item.dataset.personAction, person);
    });
    activePersonMenuTrigger = trigger;
    document.body.appendChild(menu);
    positionPersonMenu(menu, trigger);
}

function shouldKeepPersonMenuForTarget(target) {
    return !!target?.closest?.('cds-menu.person-pop-menu, .member-menu-btn, .driver-menu-btn');
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
        if (event.target.closest?.('cds-menu.person-pop-menu')) return;
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
        if (event.target.closest?.('cds-menu.person-pop-menu')) return;
        closePersonMenus();
    }, { passive: true, capture: true });

    D.addEventListener('wheel', event => {
        if (event.target.closest?.('cds-menu.person-pop-menu')) return;
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
    if(isCap) {
        title = '定員変更';
        initialVal = String(
            box?.dataset.capacity
            || box?.querySelectorAll?.('.seat-slot')?.length
            || el.value
            || el.getAttribute?.('value')
            || ''
        );
    }
    else if (type === 'memberName' && card) { title = '名前変更'; initialVal = card.dataset.name || $('.member-name-text', card).innerText; }
    else if (type === 'driverName' && driver) { title = '名前変更'; initialVal = driver.dataset.name || $('.driver-name-disp', driver).innerText; }
    else if (card) { title = 'メモ編集'; initialVal = $('.memo-popup', card).innerText; } 
    else if (driver) { title = '車出しメモ'; initialVal = $('.driver-memo-text', driver).innerText; }

    const editTitleEl = $('#commonEditModalTitle');
    const editInput = $('#editModalInput');
    if (editTitleEl) editTitleEl.innerText = title;
    if (editInput) {
        editInput.value = initialVal;
        editInput.label = isCap ? '定員' : (type.includes('Name') ? '名前' : 'メモ');
        editInput.setAttribute('label', editInput.label);
        editInput.setAttribute('aria-label', editInput.label);
        editInput.type = isCap ? 'number' : 'text';
        editInput.inputMode = isCap ? 'numeric' : 'text';
        if (isCap) {
            editInput.setAttribute('min', '1');
            editInput.setAttribute('step', '1');
        } else {
            editInput.removeAttribute('min');
            editInput.removeAttribute('step');
        }
    }
    
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
