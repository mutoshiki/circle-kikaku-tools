// Compact person menu feature
// Owns member/driver quick action menus and the shared edit modal entry point.

let activePersonMenuTarget = null;
let activePersonMenuTrigger = null;

function closePersonMenus() {
    document.body.classList.remove('person-menu-open');
    document.querySelectorAll('cds-overflow-menu.person-overflow-menu').forEach(menu => {
        menu.open = false;
        menu.removeAttribute('open');
    });
    activePersonMenuTarget = null;
    activePersonMenuTrigger = null;
}

function getActivePersonMenuTarget() {
    return activePersonMenuTarget;
}
window.getActivePersonMenuTarget = getActivePersonMenuTarget;

function personMenuItemFromEvent(event) {
    return event.composedPath?.().find(node => node?.matches?.('cds-menu-item')) || event.target.closest?.('cds-menu-item');
}

function personOverflowFromEvent(event) {
    return event.composedPath?.().find(node => node?.matches?.('cds-overflow-menu.person-overflow-menu'))
        || event.target.closest?.('cds-overflow-menu.person-overflow-menu');
}

function replacePersonMenuItemIcon(item, iconName) {
    if (!item || !iconName) return;
    const current = item.querySelector('[slot="render-icon"]');
    if (current?.dataset?.carbonIconName === iconName || current?.dataset?.carbonIcon === iconName) return;
    const placeholder = document.createElement('span');
    placeholder.setAttribute('slot', 'render-icon');
    placeholder.setAttribute('data-carbon-icon', iconName);
    placeholder.setAttribute('aria-hidden', 'true');
    if (current) current.replaceWith(placeholder);
    else item.prepend(placeholder);
    window.SanpoCarbon?.renderCarbonIcons?.(placeholder);
}

function syncPersonMenuContext(trigger) {
    if (!trigger) return null;
    const card = trigger.closest('.member-card');
    const driver = trigger.closest('.driver-seat');
    const person = card || driver;
    if (!person) return null;
    const name = person.dataset.name || person.querySelector('.member-name-text, .driver-name-disp')?.textContent || '参加者';
    trigger.label = `${name}の操作`;
    trigger.setAttribute('label', trigger.label);
    trigger.setAttribute('aria-label', trigger.label);
    const rootMenu = trigger.querySelector(':scope > cds-menu.person-pop-menu');
    if (rootMenu) {
        rootMenu.label = trigger.label;
        rootMenu.setAttribute('aria-label', trigger.label);
    }
    if (card) {
        const locked = card.dataset.locked === 'true';
        const lockItem = trigger.querySelector('cds-menu-item[data-person-action="lock"]');
        if (lockItem) {
            const label = locked ? '固定解除' : '固定';
            lockItem.label = label;
            lockItem.setAttribute('label', label);
            replacePersonMenuItemIcon(lockItem, locked ? 'unlocked' : 'locked');
        }
        const inWaiting = card.parentElement?.id === 'waiting-list';
        const returnItem = trigger.querySelector('cds-menu-item[data-person-action="return"]');
        if (returnItem) {
            const label = inWaiting ? '削除' : '戻す';
            returnItem.label = label;
            returnItem.setAttribute('label', label);
            returnItem.kind = inWaiting ? 'danger' : 'default';
            returnItem.setAttribute('kind', returnItem.kind);
            replacePersonMenuItemIcon(returnItem, inWaiting ? 'trash-can' : 'undo');
        }
    }
    activePersonMenuTarget = person;
    activePersonMenuTrigger = trigger;
    document.body.classList.add('person-menu-open');
    return person;
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

function handleCompactPersonAction(action, person = activePersonMenuTarget, choiceValue = '') {
    if (!action || !person) return;
    const card = person.closest?.('.member-card') || null;
    const driver = person.closest?.('.driver-seat') || null;
    const isDriver = !!driver;
    const targetPerson = card || driver;
    if (!targetPerson) return;

    const trigger = targetPerson.querySelector('cds-overflow-menu.person-overflow-menu');
    if (trigger) {
        trigger.open = false;
        trigger.removeAttribute('open');
    }
    document.body.classList.remove('person-menu-open');

    if (action === 'memo') handleEdit(isDriver ? 'driverMemo' : 'memo', targetPerson);
    else if (action === 'lock' && card) toggleLock(card);
    else if (action === 'return' && card) returnOrDeleteMemberCard(card);
    else if (action === 'name') handleEdit(isDriver ? 'driverName' : 'memberName', targetPerson);
    else if (action === 'grade') setPersonGrade(targetPerson, choiceValue);
    else if (action === 'gender') setPersonGender(targetPerson, choiceValue);
    else if (action === 'flag') setPersonFlag(targetPerson, choiceValue);
}
window.handleCompactPersonAction = handleCompactPersonAction;

function openCompactPersonMenu(trigger) {
    const person = syncPersonMenuContext(trigger);
    if (!person) return;
    trigger.open = true;
    trigger.setAttribute('open', '');
}
window.openCompactPersonMenu = openCompactPersonMenu;

function shouldKeepPersonMenuForTarget(target) {
    return !!target?.closest?.('cds-overflow-menu.person-overflow-menu, cds-menu.person-pop-menu');
}

function ensureCompactMenuFallback() {
    setupCompactPersonMenu();
}
window.ensureCompactMenuFallback = ensureCompactMenuFallback;

function setupCompactPersonMenu() {
    if (setupCompactPersonMenu.bound === true) return;
    setupCompactPersonMenu.bound = true;

    D.addEventListener('pointerdown', event => {
        const trigger = personOverflowFromEvent(event);
        if (trigger) {
            syncPersonMenuContext(trigger);
            return;
        }
        if (shouldKeepPersonMenuForTarget(event.target)) return;
        closePersonMenus();
    }, true);

    D.addEventListener('click', event => {
        const overflowTrigger = personOverflowFromEvent(event);
        const item = personMenuItemFromEvent(event);
        if (overflowTrigger && !item) {
            queueMicrotask(() => {
                document.body.classList.toggle('person-menu-open', overflowTrigger.open === true || overflowTrigger.hasAttribute('open'));
            });
        }
        if (!item) return;
        const trigger = item.closest?.('cds-overflow-menu.person-overflow-menu');
        if (!trigger) return;
        const person = syncPersonMenuContext(trigger);
        const directAction = item.dataset.personAction || '';
        const choiceAction = item.dataset.personChoice || '';
        if (!directAction && !choiceAction) return;
        const action = choiceAction || directAction;
        const value = choiceAction ? item.dataset.choiceValue || '' : '';
        queueMicrotask(() => handleCompactPersonAction(action, person, value));
    }, false);

    D.addEventListener('keydown', event => {
        if (event.key === 'Escape') closePersonMenus();
    }, true);

    D.addEventListener('cds-popover-closed', event => {
        const path = event.composedPath?.() || [];
        if (path.some(node => node?.matches?.('cds-overflow-menu.person-overflow-menu'))) closePersonMenus();
    }, true);

    const menuStateObserver = new MutationObserver(records => {
        if (!records.some(record => record.target?.matches?.('cds-overflow-menu.person-overflow-menu'))) return;
        const anyOpen = !!D.querySelector('cds-overflow-menu.person-overflow-menu[open]');
        D.body.classList.toggle('person-menu-open', anyOpen);
        if (!anyOpen) {
            activePersonMenuTarget = null;
            activePersonMenuTrigger = null;
        }
    });
    menuStateObserver.observe(D.body, { subtree: true, attributes: true, attributeFilter: ['open'] });
    setupCompactPersonMenu.menuStateObserver = menuStateObserver;

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
