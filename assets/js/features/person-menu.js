// Compact person menu feature.
// Owns the Carbon overflow-menu lifecycle plus memo, role, grade, flag, lock and
// unassigned/delete actions. Name editing, gender metadata and cross-car movement
// are deliberately not part of the participant menu.

let activePersonMenuTarget = null;
let activePersonMenuTrigger = null;
const personMenuAnchorRects = new WeakMap();
const personMenuPlaceholders = new WeakMap();
const personMenuNativeToggleBound = new WeakSet();
const personMenuWasOpenOnPointerDown = new WeakMap();
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
        && (isPersonMenuInTopLayer(activePersonMenuTrigger)
            || activePersonMenuTrigger.open === true
            || activePersonMenuTrigger.hasAttribute('open'))) return activePersonMenuTrigger;
    return document.querySelector('cds-overflow-menu.person-overflow-menu[data-person-menu-top-layer="true"], cds-overflow-menu.person-overflow-menu[open]');
}

function syncPersonMenuTopLayerPosition(trigger = getOpenPersonMenuTrigger()) {
    if (!trigger || !isPersonMenuInTopLayer(trigger)) return;
    const placeholder = personMenuPlaceholders.get(trigger);
    const rect = placeholder?.isConnected ? placeholder.getBoundingClientRect() : personMenuAnchorRects.get(trigger);
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

function nativeHidePersonMenuPopover(trigger) {
    if (!trigger || !supportsPersonMenuTopLayer() || !isPersonMenuInTopLayer(trigger)) return;
    try { HTMLElement.prototype.hidePopover.call(trigger); } catch (_) {}
}

function nativeShowPersonMenuPopover(trigger) {
    if (!trigger || !supportsPersonMenuTopLayer()) return false;
    try {
        HTMLElement.prototype.showPopover.call(trigger);
        return isPersonMenuInTopLayer(trigger);
    } catch (_) {
        return false;
    }
}

function demotePersonMenuFromTopLayer(trigger) {
    if (!trigger) return;
    nativeHidePersonMenuPopover(trigger);
    trigger.removeAttribute('popover');
    trigger.removeAttribute('data-person-menu-top-layer');
    ['--person-menu-anchor-left', '--person-menu-anchor-top', '--person-menu-anchor-width', '--person-menu-anchor-height']
        .forEach(property => trigger.style.removeProperty(property));
    personMenuPlaceholders.get(trigger)?.remove();
    personMenuPlaceholders.delete(trigger);
    personMenuAnchorRects.delete(trigger);
    personMenuWasOpenOnPointerDown.delete(trigger);
    const anyTopLayerMenu = Array.from(document.querySelectorAll('cds-overflow-menu.person-overflow-menu')).some(isPersonMenuInTopLayer);
    document.body.classList.toggle('person-menu-top-layer-open', anyTopLayerMenu);
}

function handlePersonMenuNativeToggle(event) {
    const trigger = event.currentTarget;
    if (event.newState !== 'closed' || !trigger) return;
    if (trigger.open === true || trigger.hasAttribute('open')) {
        trigger.open = false;
        trigger.removeAttribute('open');
    }
    demotePersonMenuFromTopLayer(trigger);
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
        if (!nativeShowPersonMenuPopover(trigger)) throw new Error('person menu top layer did not open');
        document.body.classList.add('person-menu-top-layer-open');
        schedulePersonMenuTopLayerPosition();
        return true;
    } catch (_) {
        trigger.removeAttribute('popover');
        trigger.removeAttribute('data-person-menu-top-layer');
        personMenuPlaceholders.get(trigger)?.remove();
        personMenuPlaceholders.delete(trigger);
        personMenuAnchorRects.delete(trigger);
        return false;
    }
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

function getActivePersonMenuTarget() { return activePersonMenuTarget; }
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
    const placeholder = document.createElement('span');
    placeholder.setAttribute('slot', 'render-icon');
    placeholder.setAttribute('data-carbon-icon', iconName);
    placeholder.setAttribute('aria-hidden', 'true');
    if (current) current.replaceWith(placeholder); else item.prepend(placeholder);
    window.SanpoCarbon?.renderCarbonIcons?.(placeholder);
}

function personRoleEnabled(person) {
    if (person?.dataset?.driver === 'true') return true;
    if (person?.dataset?.driver === 'false') return false;
    return !!person?.classList?.contains('driver-seat');
}

function allocationRoleText(enabled) {
    const team = document.body.dataset.activePlanTemplate === 'team';
    if (team) return enabled ? '班長を外す' : '班長にする';
    return enabled ? '運転手を外す' : '運転手にする';
}

function syncPersonMenuContext(trigger) {
    if (!trigger) return null;
    const person = trigger.closest('.member-card, .driver-seat');
    if (!person) return null;
    const name = person.dataset.name || person.querySelector('.member-name-text, .driver-name-disp')?.textContent || '参加者';
    trigger.label = `${name}の操作`;
    trigger.setAttribute('label', trigger.label);
    trigger.setAttribute('aria-label', trigger.label);
    const rootMenu = trigger.querySelector(':scope > cds-menu.person-pop-menu');
    rootMenu?.setAttribute('aria-label', trigger.label);

    const roleItem = trigger.querySelector('[data-person-action="driver"]');
    if (roleItem) {
        const enabled = personRoleEnabled(person);
        const label = allocationRoleText(enabled);
        roleItem.setAttribute('label', label);
        roleItem.label = label;
        roleItem.toggleAttribute('disabled', person.parentElement?.id === 'waiting-list');
        replacePersonMenuItemIcon(roleItem, document.body.dataset.activePlanTemplate === 'team' ? 'user-role' : 'car');
    }

    const lockItem = trigger.querySelector('[data-person-action="lock"]');
    if (lockItem) {
        const locked = person.dataset.locked === 'true';
        const label = locked ? '固定解除' : '固定';
        lockItem.setAttribute('label', label);
        lockItem.label = label;
        replacePersonMenuItemIcon(lockItem, locked ? 'unlocked' : 'locked');
    }

    const returnItem = trigger.querySelector('[data-person-action="return"]');
    if (returnItem) {
        const inWaiting = person.parentElement?.id === 'waiting-list';
        const label = inWaiting ? '削除' : '未配置に戻す';
        returnItem.setAttribute('label', label);
        returnItem.label = label;
        returnItem.kind = inWaiting ? 'danger' : 'default';
        returnItem.setAttribute('kind', returnItem.kind);
        replacePersonMenuItemIcon(returnItem, inWaiting ? 'trash-can' : 'undo');
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
        line.insertBefore(meta, line.querySelector('.person-overflow-menu') || null);
    }
    return meta;
}

function updatePersonGradeBadge(person) {
    if (!person) return;
    const grade = parseInt(person.dataset.grade) || 0;
    const line = $('.member-main-line, .driver-main-line', person);
    const meta = ensurePersonMeta(line);
    meta?.querySelector('.grade-badge')?.remove();
    if (grade > 0 && meta) {
        const badge = ce('cds-tag', 'grade-badge carbon-display-tag');
        badge.dataset.grade = String(grade);
        badge.setAttribute('type', 'gray');
        badge.setAttribute('size', 'sm');
        badge.textContent = `${grade}年`;
        badge.setAttribute('aria-label', badge.textContent);
        meta.appendChild(badge);
    }
}

function setPersonGrade(person, gradeValue) {
    const grade = Math.max(0, Math.min(4, parseInt(gradeValue) || 0));
    person.dataset.grade = String(grade);
    updatePersonGradeBadge(person);
    updateUI();
    save();
}

function updatePersonFlagBadge(person) {
    if (!person) return;
    person.dataset.flag = normalizePersonFlag(person.dataset.flag);
    const line = $('.member-main-line, .driver-main-line', person);
    const meta = ensurePersonMeta(line);
    meta?.querySelector('.person-flag')?.remove();
    const holder = document.createElement('template');
    holder.innerHTML = renderPersonFlag(person.dataset.flag);
    const badge = holder.content.firstElementChild;
    if (!meta || !badge) return;
    const role = meta.querySelector('.driver-role-tag');
    const grade = meta.querySelector('.grade-badge');
    meta.insertBefore(badge, role || grade || null);
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

function syncPersonRoleTag(person) {
    const meta = ensurePersonMeta($('.member-main-line, .driver-main-line', person));
    if (!meta) return;
    let tag = meta.querySelector('.driver-role-tag');
    if (!personRoleEnabled(person)) {
        tag?.remove();
        return;
    }
    if (!tag) {
        tag = ce('cds-tag', 'driver-role-tag carbon-display-tag');
        tag.setAttribute('type', 'gray');
        tag.setAttribute('size', 'sm');
        const grade = meta.querySelector('.grade-badge');
        meta.insertBefore(tag, grade || null);
    }
    tag.textContent = document.body.dataset.activePlanTemplate === 'team' ? '班長' : '運転手';
    tag.setAttribute('aria-label', tag.textContent);
}

function setPersonDriverRole(person, enabled = !personRoleEnabled(person)) {
    if (!person || person.parentElement?.id === 'waiting-list') return;
    person.dataset.driver = enabled ? 'true' : 'false';
    syncPersonRoleTag(person);
    syncActiveCarPlanFromDom?.();
    updateUI();
    save();
    window.SanpoAssignmentWorkspace?.refresh?.();
}
window.setPersonDriverRole = setPersonDriverRole;

async function returnOrDeleteMemberCard(card) {
    if (!card) return;
    if (card.dataset.locked === 'true') {
        showAppNotice('固定されています。先に固定を解除してください。', true);
        return;
    }
    let changed = false;
    const deletingFromWaiting = card.parentElement?.id === 'waiting-list';
    if (deletingFromWaiting) {
        if (await appConfirm('このメンバーを完全に削除しますか？', { title: 'メンバー削除', okText: '削除', danger: true })) {
            const participantKey = card.dataset.participantId || card.dataset.name || '';
            window.SanpoCanonicalState?.deleteParticipant?.(participantKey);
            card.remove();
            changed = true;
        }
    } else if (await appConfirm('未配置に戻しますか？', { title: '未配置に戻す', okText: '戻す' })) {
        $('#waiting-list')?.appendChild(card);
        card.dataset.driver = 'false';
        changed = true;
    }
    if (!changed) return;
    updateUI();
    save();
    window.SanpoAssignmentWorkspace?.refresh?.();
}

function handleCompactPersonAction(action, person = activePersonMenuTarget, choiceValue = '') {
    if (!action || !person) return;
    const targetPerson = person.closest?.('.member-card, .driver-seat') || null;
    if (!targetPerson) return;
    const trigger = targetPerson.querySelector('cds-overflow-menu.person-overflow-menu');
    if (trigger) {
        trigger.open = false;
        trigger.removeAttribute('open');
        demotePersonMenuFromTopLayer(trigger);
    }
    document.body.classList.remove('person-menu-open');
    window.SanpoFocusModality?.clearPointerFocus?.(trigger);

    if (action === 'memo') handleEdit('memo', targetPerson);
    else if (action === 'driver') setPersonDriverRole(targetPerson);
    else if (action === 'lock' && targetPerson.classList.contains('member-card')) toggleLock(targetPerson);
    else if (action === 'return' && targetPerson.classList.contains('member-card')) returnOrDeleteMemberCard(targetPerson);
    else if (action === 'grade') setPersonGrade(targetPerson, choiceValue);
    else if (action === 'flag') setPersonFlag(targetPerson, choiceValue);
}
window.handleCompactPersonAction = handleCompactPersonAction;

function openCompactPersonMenu(trigger) {
    closeOtherPersonMenus(trigger);
    capturePersonMenuAnchor(trigger);
    const person = syncPersonMenuContext(trigger);
    if (!person) return false;
    trigger.open = true;
    trigger.setAttribute('open', '');
    promotePersonMenuToTopLayer(trigger);
    return true;
}
window.openCompactPersonMenu = openCompactPersonMenu;

function closeCompactPersonMenu(trigger) {
    if (!trigger) return;
    trigger.open = false;
    trigger.removeAttribute('open');
    demotePersonMenuFromTopLayer(trigger);
    if (activePersonMenuTrigger === trigger) {
        document.body.classList.remove('person-menu-open');
        activePersonMenuTarget = null;
        activePersonMenuTrigger = null;
    }
    window.SanpoFocusModality?.clearPointerFocus?.(trigger);
}

function shouldKeepPersonMenuForTarget(target) {
    return !!target?.closest?.('cds-overflow-menu.person-overflow-menu, cds-menu.person-pop-menu');
}

function ensureCompactMenuFallback() { setupCompactPersonMenu(); }
window.ensureCompactMenuFallback = ensureCompactMenuFallback;

function setupCompactPersonMenu() {
    if (setupCompactPersonMenu.bound === true) return;
    setupCompactPersonMenu.bound = true;

    document.addEventListener('pointerdown', event => {
        const trigger = personOverflowFromEvent(event);
        if (trigger) {
            const wasOpen = isPersonMenuInTopLayer(trigger)
                || trigger.open === true
                || trigger.hasAttribute('open');
            personMenuWasOpenOnPointerDown.set(trigger, wasOpen);
            closeOtherPersonMenus(trigger);
            capturePersonMenuAnchor(trigger);
            syncPersonMenuContext(trigger);
            return;
        }
        if (!shouldKeepPersonMenuForTarget(event.target)) closePersonMenus();
    }, true);

    document.addEventListener('click', event => {
        const overflowTrigger = personOverflowFromEvent(event);
        const item = personMenuItemFromEvent(event);
        if (overflowTrigger && !item) {
            const wasOpen = personMenuWasOpenOnPointerDown.get(overflowTrigger) === true;
            personMenuWasOpenOnPointerDown.delete(overflowTrigger);
            queueMicrotask(() => {
                if (wasOpen) closeCompactPersonMenu(overflowTrigger);
                else openCompactPersonMenu(overflowTrigger);
            });
        }
        if (!item) return;
        const trigger = item.closest?.('cds-overflow-menu.person-overflow-menu');
        if (!trigger) return;
        const person = syncPersonMenuContext(trigger);
        const directAction = item.dataset.personAction || '';
        const choiceAction = item.dataset.personChoice || '';
        if (!directAction && !choiceAction) return;
        queueMicrotask(() => handleCompactPersonAction(choiceAction || directAction, person, choiceAction ? item.dataset.choiceValue || '' : ''));
    }, false);

    document.addEventListener('keydown', event => { if (event.key === 'Escape') closePersonMenus(); }, true);
    document.addEventListener('scroll', schedulePersonMenuTopLayerPosition, { capture: true, passive: true });
    window.addEventListener('resize', schedulePersonMenuTopLayerPosition, { passive: true });
    window.visualViewport?.addEventListener('resize', schedulePersonMenuTopLayerPosition, { passive: true });
    window.visualViewport?.addEventListener('scroll', schedulePersonMenuTopLayerPosition, { passive: true });
    window.addEventListener('orientationchange', closePersonMenus, { passive: true });
}

function handleEdit(type, el) {
    const isCap = type === 'capacity';
    const box = isCap ? el.closest('.car-box') : null;
    const person = !isCap ? el.closest('.member-card, .driver-seat') : null;
    const memo = person?.querySelector('.memo-popup');
    const title = isCap ? '定員変更' : 'メモ編集';
    const initialVal = isCap
        ? String(box?.dataset.capacity || box?.querySelectorAll?.('.seat-slot')?.length || '')
        : String(memo?.innerText || '');

    const editTitleEl = $('#commonEditModalTitle');
    const editInput = $('#editModalInput');
    if (editTitleEl) editTitleEl.innerText = title;
    if (editInput) {
        editInput.value = initialVal;
        editInput.label = isCap ? '定員' : 'メモ';
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
        const value = $('#editModalInput').value;
        if (isCap) {
            const newCapacity = getInt(value);
            if (newCapacity > 0) {
                const grid = $('.car-layout-grid', box);
                const current = $$('.seat-slot', grid);
                if (newCapacity > current.length) {
                    for (let i = 0; i < newCapacity - current.length; i += 1) {
                        const slot = ce('div', 'seat-slot');
                        slot.innerHTML = '<cds-icon-button class="seat-add-btn" type="button" kind="ghost" size="lg" aria-label="メンバーを追加"><span data-carbon-icon="add" slot="icon" aria-hidden="true"></span></cds-icon-button>';
                        grid.appendChild(slot);
                    }
                } else if (newCapacity < current.length) {
                    for (let i = current.length - 1; i >= newCapacity; i -= 1) {
                        const occupant = current[i].querySelector('.member-card');
                        if (occupant) {
                            occupant.dataset.driver = 'false';
                            $('#waiting-list')?.appendChild(occupant);
                        }
                        current[i].remove();
                    }
                }
                box.dataset.capacity = newCapacity;
            }
        } else if (memo) {
            memo.innerText = value;
            memo.style.display = value ? 'block' : 'none';
        }
        modals.edit.hide();
        updateUI();
        save();
        window.SanpoAssignmentWorkspace?.refresh?.();
    };
    modals.edit.show();
}
