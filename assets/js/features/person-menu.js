// Compact person menu feature
// Owns member/driver quick action menus and the shared edit modal entry point.

let activePersonMenuTarget = null;
let activePersonMenuTrigger = null;

// An open person menu is promoted to the browser top layer. A z-index can only
// compete inside its current stacking context; the Popover API removes that
// limitation while Carbon continues to own placement, focus and submenus.
const personMenuAnchorRects = new WeakMap();
const personMenuPlaceholders = new WeakMap();
const personMenuNativeToggleBound = new WeakSet();
let personMenuPositionFrame = 0;

function supportsPersonMenuTopLayer() {
    return typeof HTMLElement !== 'undefined'
        && typeof HTMLElement.prototype.showPopover === 'function'
        && typeof HTMLElement.prototype.hidePopover === 'function';
}

function isPersonMenuInTopLayer(trigger) {
    if (!trigger || !supportsPersonMenuTopLayer()) return false;
    try { return trigger.matches(':popover-open'); }
    catch { return false; }
}

function capturePersonMenuAnchor(trigger) {
    if (!trigger || isPersonMenuInTopLayer(trigger)) return;
    const rect = trigger.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) personMenuAnchorRects.set(trigger, rect);
}

function setPersonMenuAnchorPosition(trigger, rect) {
    if (!trigger || !rect) return;
    trigger.style.setProperty('--person-menu-anchor-left', `${Math.round(rect.left)}px`);
    trigger.style.setProperty('--person-menu-anchor-top', `${Math.round(rect.top)}px`);
    trigger.style.setProperty('--person-menu-anchor-width', `${Math.max(1, Math.round(rect.width))}px`);
    trigger.style.setProperty('--person-menu-anchor-height', `${Math.max(1, Math.round(rect.height))}px`);
}

function ensurePersonMenuPlaceholder(trigger, rect) {
    let placeholder = personMenuPlaceholders.get(trigger);
    if (placeholder?.isConnected) return placeholder;
    placeholder = document.createElement('span');
    placeholder.className = 'person-menu-top-layer-placeholder';
    placeholder.setAttribute('aria-hidden', 'true');
    placeholder.style.width = `${Math.max(1, Math.round(rect.width))}px`;
    placeholder.style.height = `${Math.max(1, Math.round(rect.height))}px`;
    trigger.before(placeholder);
    personMenuPlaceholders.set(trigger, placeholder);
    return placeholder;
}

function getOpenPersonMenuTrigger() {
    if (activePersonMenuTrigger
        && (activePersonMenuTrigger.open === true || activePersonMenuTrigger.hasAttribute('open'))) {
        return activePersonMenuTrigger;
    }
    return document.querySelector('cds-overflow-menu.person-overflow-menu[data-person-menu-top-layer="true"], cds-overflow-menu.person-overflow-menu[open]');
}

function syncPersonMenuTopLayerPosition(trigger = getOpenPersonMenuTrigger()) {
    if (!trigger || !isPersonMenuInTopLayer(trigger)) return;
    const placeholder = personMenuPlaceholders.get(trigger);
    const rect = placeholder?.isConnected
        ? placeholder.getBoundingClientRect()
        : personMenuAnchorRects.get(trigger);
    if (!rect) return;
    const viewportWidth = window.visualViewport?.width || window.innerWidth;
    const viewportHeight = window.visualViewport?.height || window.innerHeight;
    if (rect.bottom < 0 || rect.top > viewportHeight || rect.right < 0 || rect.left > viewportWidth) {
        closePersonMenus();
        return;
    }
    setPersonMenuAnchorPosition(trigger, rect);
}

function schedulePersonMenuTopLayerPosition() {
    const trigger = getOpenPersonMenuTrigger();
    if (!trigger || personMenuPositionFrame) return;
    personMenuPositionFrame = requestAnimationFrame(() => {
        personMenuPositionFrame = 0;
        syncPersonMenuTopLayerPosition(trigger);
    });
}

function handlePersonMenuNativeToggle(event) {
    const trigger = event.currentTarget;
    if (event.newState !== 'closed' || !trigger) return;
    if (trigger.open === true || trigger.hasAttribute('open')) {
        trigger.open = false;
        trigger.removeAttribute('open');
    }
    demotePersonMenuFromTopLayer(trigger);
    if (activePersonMenuTrigger === trigger) {
        const nextTrigger = getOpenPersonMenuTrigger();
        activePersonMenuTrigger = nextTrigger || null;
        activePersonMenuTarget = nextTrigger?.closest('.member-card, .driver-seat') || null;
        document.body.classList.toggle('person-menu-open', !!nextTrigger);
    }
}

function promotePersonMenuToTopLayer(trigger) {
    if (!trigger || !supportsPersonMenuTopLayer()) return false;
    if (isPersonMenuInTopLayer(trigger)) {
        syncPersonMenuTopLayerPosition(trigger);
        return true;
    }
    const rect = personMenuAnchorRects.get(trigger) || trigger.getBoundingClientRect();
    if (!(rect.width > 0 && rect.height > 0)) return false;
    ensurePersonMenuPlaceholder(trigger, rect);
    setPersonMenuAnchorPosition(trigger, rect);
    try {
        if (!personMenuNativeToggleBound.has(trigger)) {
            trigger.addEventListener('toggle', handlePersonMenuNativeToggle);
            personMenuNativeToggleBound.add(trigger);
        }
        trigger.dataset.personMenuTopLayer = 'true';
        trigger.setAttribute('popover', 'manual');
        trigger.showPopover();
        document.body.classList.add('person-menu-top-layer-open');
        schedulePersonMenuTopLayerPosition();
        return true;
    } catch (error) {
        trigger.removeAttribute('popover');
        trigger.removeAttribute('data-person-menu-top-layer');
        personMenuPlaceholders.get(trigger)?.remove();
        personMenuPlaceholders.delete(trigger);
        console.warn('Person menu top-layer promotion failed; using stacking fallback.', error);
        return false;
    }
}

function demotePersonMenuFromTopLayer(trigger) {
    if (!trigger) return;
    if (isPersonMenuInTopLayer(trigger)) {
        try { trigger.hidePopover(); }
        catch { /* The Carbon menu may already have closed it. */ }
    }
    trigger.removeAttribute('popover');
    trigger.removeAttribute('data-person-menu-top-layer');
    trigger.style.removeProperty('--person-menu-anchor-left');
    trigger.style.removeProperty('--person-menu-anchor-top');
    trigger.style.removeProperty('--person-menu-anchor-width');
    trigger.style.removeProperty('--person-menu-anchor-height');
    personMenuPlaceholders.get(trigger)?.remove();
    personMenuPlaceholders.delete(trigger);
    personMenuAnchorRects.delete(trigger);
    const anyTopLayerMenu = Array.from(document.querySelectorAll('cds-overflow-menu.person-overflow-menu'))
        .some(isPersonMenuInTopLayer);
    document.body.classList.toggle('person-menu-top-layer-open', anyTopLayerMenu);
}

function closeOtherPersonMenus(keepTrigger) {
    document.querySelectorAll('cds-overflow-menu.person-overflow-menu').forEach(menu => {
        if (menu === keepTrigger) return;
        menu.open = false;
        menu.removeAttribute('open');
        demotePersonMenuFromTopLayer(menu);
    });
}

function closePersonMenus() {
    const triggerToBlur = activePersonMenuTrigger;
    document.body.classList.remove('person-menu-open');
    document.querySelectorAll('cds-overflow-menu.person-overflow-menu').forEach(menu => {
        menu.open = false;
        menu.removeAttribute('open');
        demotePersonMenuFromTopLayer(menu);
    });
    document.body.classList.remove('person-menu-top-layer-open');
    activePersonMenuTarget = null;
    activePersonMenuTrigger = null;
    window.SanpoFocusModality?.clearPointerFocus?.(triggerToBlur);
}

window.SanpoPersonMenuLayer = Object.freeze({
    promote: promotePersonMenuToTopLayer,
    demote: demotePersonMenuFromTopLayer,
    syncPosition: syncPersonMenuTopLayerPosition,
    isTopLayer: isPersonMenuInTopLayer
});

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
        demotePersonMenuFromTopLayer(trigger);
    }
    document.body.classList.remove('person-menu-open');
    window.SanpoFocusModality?.clearPointerFocus?.(trigger);

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
    closeOtherPersonMenus(trigger);
    capturePersonMenuAnchor(trigger);
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
            closeOtherPersonMenus(trigger);
            capturePersonMenuAnchor(trigger);
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
                const open = overflowTrigger.open === true || overflowTrigger.hasAttribute('open');
                document.body.classList.toggle('person-menu-open', open);
                if (open) promotePersonMenuToTopLayer(overflowTrigger);
                else demotePersonMenuFromTopLayer(overflowTrigger);
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
        const menuRecords = records.filter(record => record.target?.matches?.('cds-overflow-menu.person-overflow-menu'));
        if (!menuRecords.length) return;
        menuRecords.forEach(record => {
            const trigger = record.target;
            const open = trigger.open === true || trigger.hasAttribute('open');
            if (open) promotePersonMenuToTopLayer(trigger);
            else demotePersonMenuFromTopLayer(trigger);
        });
        const anyOpen = !!D.querySelector('cds-overflow-menu.person-overflow-menu[open]');
        D.body.classList.toggle('person-menu-open', anyOpen);
        if (!anyOpen) {
            activePersonMenuTarget = null;
            activePersonMenuTrigger = null;
        } else if (!activePersonMenuTrigger
            || !(activePersonMenuTrigger.open === true || activePersonMenuTrigger.hasAttribute('open'))) {
            const nextTrigger = D.querySelector('cds-overflow-menu.person-overflow-menu[open]');
            activePersonMenuTrigger = nextTrigger || null;
            activePersonMenuTarget = nextTrigger?.closest('.member-card, .driver-seat') || null;
        }
    });
    menuStateObserver.observe(D.body, { subtree: true, attributes: true, attributeFilter: ['open'] });
    setupCompactPersonMenu.menuStateObserver = menuStateObserver;

    D.addEventListener('scroll', schedulePersonMenuTopLayerPosition, { capture: true, passive: true });
    window.addEventListener('resize', schedulePersonMenuTopLayerPosition, { passive: true });
    window.visualViewport?.addEventListener('resize', schedulePersonMenuTopLayerPosition, { passive: true });
    window.visualViewport?.addEventListener('scroll', schedulePersonMenuTopLayerPosition, { passive: true });
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
