// Compact person menu feature.
// Owns the Carbon overflow-menu lifecycle plus memo, role, grade, flag, lock and
// unassigned/delete actions. Name editing, gender metadata and cross-car movement
// are deliberately not part of the participant menu.

let activePersonMenuTarget = null;
let activePersonMenuTrigger = null;

function closeOtherPersonMenus(keepTrigger) {
    document.querySelectorAll('cds-overflow-menu.person-overflow-menu').forEach(menu => {
        if (menu === keepTrigger) return;
        menu.open = false;
    });
}

function closePersonMenus() {
    const triggerToBlur = activePersonMenuTrigger;
    document.body.classList.remove('person-menu-open');
    document.querySelectorAll('cds-overflow-menu.person-overflow-menu').forEach(menu => {
        menu.open = false;
    });
    activePersonMenuTarget = null;
    activePersonMenuTrigger = null;
    window.SanpoFocusModality?.clearPointerFocus?.(triggerToBlur);
}

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
    return false;
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
        roleItem.removeAttribute('disabled');
        replacePersonMenuItemIcon(roleItem, document.body.dataset.activePlanTemplate === 'team' ? 'user-role' : 'car');
    }

    const lockItem = trigger.querySelector('[data-person-action="lock"]');
    if (lockItem) {
        const locked = person.dataset.locked === 'true';
        const label = locked ? 'ロック解除' : 'ロック';
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

function commitAllocationPersonMutation(person, mutate) {
    const participantId = String(person?.dataset?.participantId || '');
    const state = window.SanpoCanonicalState;
    const room = state?.get?.();
    const type = room?.activeAllocationType === 'team' ? 'team' : 'car';
    const allocation = room?.allocations?.[type];
    const placement = allocation?.placements?.[participantId];
    if (!participantId || !room || !allocation || !placement) return false;
    mutate({ room, allocation, placement, participantId, type });
    state.ensureAllParticipantsPlaced?.(allocation, room.participants || {});
    state.set?.(room);
    window.renderActiveCarPlanToDom?.();
    updateUI();
    save();
    window.SanpoAssignmentWorkspace?.refresh?.();
    return true;
}

function reassignGroupAnchorBeforeRemoval(allocation, participantId, now) {
    Object.entries(allocation?.groups || {}).forEach(([groupId, group]) => {
        if (group?.ownerId !== participantId) return;
        const replacement = Object.entries(allocation.placements || {})
            .filter(([id, candidate]) => id !== participantId
                && candidate?.kind === 'member'
                && candidate.groupId === groupId)
            .sort(([, a], [, b]) => {
                const orderDiff = Number(a?.order || 0) - Number(b?.order || 0);
                return orderDiff;
            })[0];
        if (replacement) {
            group.ownerId = replacement[0];
            group.updatedAt = now;
            return;
        }
        // Removing the last header anchor removes an empty group. Any stale
        // occupants are returned to waiting by the canonical normalizer.
        delete allocation.groups[groupId];
    });
}

function setPersonDriverRole(person, enabled = !personRoleEnabled(person)) {
    if (!person) return;
    const now = window.SanpoClock?.now?.() ?? Date.now();
    const changed = commitAllocationPersonMutation(person, ({ allocation, placement, participantId }) => {
        allocation.placements[participantId] = { ...placement, driver: enabled === true, updatedAt: now };
    });
    if (!changed) return;
}
window.setPersonDriverRole = setPersonDriverRole;

async function returnOrDeleteMemberCard(card) {
    if (!card) return;
    if (card.dataset.locked === 'true') {
        showAppNotice('ロック中です。先にロックを解除してください。', true);
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
        const now = window.SanpoClock?.now?.() ?? Date.now();
        changed = commitAllocationPersonMutation(card, ({ allocation, placement, participantId }) => {
            reassignGroupAnchorBeforeRemoval(allocation, participantId, now);
            allocation.placements[participantId] = {
                ...allocation.placements[participantId],
                kind: 'waiting',
                groupId: '',
                order: Number.MAX_SAFE_INTEGER,
                updatedAt: now
            };
        });
    }
    if (!changed) return;
    if (!deletingFromWaiting) return;
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
    }
    document.body.classList.remove('person-menu-open');
    window.SanpoFocusModality?.clearPointerFocus?.(trigger);

    if (action === 'memo') handleEdit('memo', targetPerson);
    else if (action === 'driver') setPersonDriverRole(targetPerson);
    else if (action === 'lock') toggleLock(targetPerson);
    else if (action === 'return') returnOrDeleteMemberCard(targetPerson);
    else if (action === 'grade') setPersonGrade(targetPerson, choiceValue);
    else if (action === 'flag') setPersonFlag(targetPerson, choiceValue);
}
window.handleCompactPersonAction = handleCompactPersonAction;

function openCompactPersonMenu(trigger) {
    closeOtherPersonMenus(trigger);
    const person = syncPersonMenuContext(trigger);
    if (!person) return false;
    trigger.open = true;
    return true;
}
window.openCompactPersonMenu = openCompactPersonMenu;

function closeCompactPersonMenu(trigger) {
    if (!trigger) return;
    trigger.open = false;
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
        if (personOverflowFromEvent(event)) return;
        if (!shouldKeepPersonMenuForTarget(event.target)) closePersonMenus();
    }, true);

    // This feature owns person-action state through Carbon's public API. Carbon
    // remains sole owner of rendering, focus and Floating UI placement.
    document.addEventListener('click', event => {
        const trigger = personOverflowFromEvent(event);
        if (!trigger || personMenuItemFromEvent(event)) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        if (trigger.open === true || trigger.hasAttribute('open')) {
            closeCompactPersonMenu(trigger);
            return;
        }
        openCompactPersonMenu(trigger);
    }, true);

    document.addEventListener('click', event => {
        const item = personMenuItemFromEvent(event);
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
    window.addEventListener('orientationchange', closePersonMenus, { passive: true });
}

// Install with this feature, not after asynchronous workspace setup. Person cards
// can be rendered before app bootstrap finishes during a shared-state refresh.
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setupCompactPersonMenu, { once: true });
else setupCompactPersonMenu();

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
