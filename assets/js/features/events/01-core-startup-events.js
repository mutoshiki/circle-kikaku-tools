// Core startup event bindings that operate on already-rendered cards and global pointer movement.
(function (global) {
    'use strict';

    const events = global.SanpoEvents || {};

    function installRoomTitleValueBridge(roomNameInput) {
        if (!roomNameInput || roomNameInput.dataset.projectTitleValueBridge === 'true') return;
        const prototype = Object.getPrototypeOf(roomNameInput);
        const valueDescriptor = Object.getOwnPropertyDescriptor(prototype, 'value')
            || Object.getOwnPropertyDescriptor(global.HTMLInputElement?.prototype || {}, 'value');
        if (!valueDescriptor?.get || !valueDescriptor?.set) return;

        let pendingLocalTitle = '';
        const normalizeTitle = value => String(value ?? '').replace(/[\r\n]+/g, '');
        const syncEditor = value => {
            const editor = byId('projectTitleEditor');
            if (!editor || document.activeElement === editor) return;
            const next = normalizeTitle(value);
            if (editor.textContent !== next) editor.textContent = next;
            if (!next && editor.childNodes.length) editor.replaceChildren();
        };

        Object.defineProperty(roomNameInput, 'value', {
            configurable: true,
            enumerable: valueDescriptor.enumerable,
            get() {
                return valueDescriptor.get.call(this);
            },
            set(value) {
                const next = normalizeTitle(value);
                const current = normalizeTitle(valueDescriptor.get.call(this));
                const editor = byId('projectTitleEditor');
                const editorValue = normalizeTitle(editor?.textContent || '');

                // A remote snapshot can arrive between the local input event and its
                // debounced save. Do not let an older/empty roomName erase the title
                // that is still waiting to be acknowledged by the shared room.
                if (pendingLocalTitle && next !== pendingLocalTitle) return;
                if (pendingLocalTitle && next === pendingLocalTitle) pendingLocalTitle = '';

                // While the contenteditable editor owns focus, only accept the value it
                // is currently writing itself. A remote repaint must not replace a title
                // midway through composition/typing.
                if (editor && document.activeElement === editor && next !== editorValue && next !== current) return;

                valueDescriptor.set.call(this, next);
                syncEditor(next);
            }
        });
        roomNameInput.dataset.projectTitleValueBridge = 'true';

        roomNameInput.addEventListener('input', event => {
            if (event.isComposing) return;
            pendingLocalTitle = normalizeTitle(valueDescriptor.get.call(roomNameInput));
        });
        roomNameInput.addEventListener('compositionend', () => {
            pendingLocalTitle = normalizeTitle(valueDescriptor.get.call(roomNameInput));
        });
    }

    function bindCoreStartupEvents() {
        if (document.documentElement.dataset.coreStartupEventsBound === 'true') return;
        document.documentElement.dataset.coreStartupEventsBound = 'true';

        D.body.addEventListener('click', async e => {
            const t = e.target;
            // Participant names are display text. Editable state changes are handled only
            // by the official Carbon overflow-menu actions beside each person.
            const editTrigger = t.closest('.edit-btn');
            if (editTrigger) {
                handleEdit(editTrigger.closest('.driver-seat') ? 'driverMemo' : 'memo', editTrigger);
                return;
            }
            const lockTrigger = t.closest('.lock-btn');
            if (lockTrigger) {
                toggleLock(lockTrigger.closest('.member-card'));
                return;
            }

            const deleteTrigger = t.closest('.delete-btn, .delete-btn-overlay');
            if (!deleteTrigger) return;

            const card = deleteTrigger.closest('.member-card');
            const box = deleteTrigger.closest('.car-box');

            if (card) {
                if (card.dataset.locked === 'true') {
                    await appAlert('固定されています。先に固定を解除してください。', { title: '操作できません' });
                    return;
                }

                if (card.parentElement.id === 'waiting-list') {
                    if (await appConfirm('このメンバーを完全に削除しますか？', { title: 'メンバー削除', okText: '削除', danger: true })) {
                        const participantKey = card.dataset.participantId || card.dataset.name || '';
                        window.SanpoCanonicalState?.deleteParticipant?.(participantKey);
                        card.remove();
                    }
                } else if (await appConfirm('車から降ろして未割り当てメンバーに戻しますか？', { title: '未割り当てに戻す', okText: '戻す' })) {
                    $('#waiting-list').appendChild(card);
                }
            } else if (box) {
                if (await appConfirm('この車出しを解除して、車出しと同乗者を待機メンバーに戻しますか？', { title: '車出しを解除', okText: '戻す' })) {
                    const driver = $('.driver-seat', box);
                    const driverName = driver?.dataset?.name || $('.driver-name-disp', driver)?.innerText || '';
                    const driverMemo = $('.driver-memo-text', driver)?.innerText || '';
                    const driverGender = driver?.dataset?.gender || 'unknown';
                    const driverGrade = parseInt(driver?.dataset?.grade) || 0;
                    const waitingList = $('#waiting-list');

                    if (driverName && waitingList) addMember(driverName, driverMemo, driverGender, driverGrade, waitingList, false, driver?.dataset.flag, driver?.dataset.participantId || '');
                    $$('.member-card', box).forEach(m => waitingList?.appendChild(m));
                    if (settlementState?.cars && driverName) delete settlementState.cars[driverName];
                    if (settlementState?.driverPaid && driverName) delete settlementState.driverPaid[driverName];

                    if (box.parentElement && box.parentElement.classList.contains('allocation-grid-item')) {
                        box.parentElement.remove();
                    } else {
                        box.closest('.allocation-grid-item')?.remove();
                    }
                }
            }
            updateUI();
            global.__lastLocalUpdatedAt = (window.SanpoClock?.now?.() ?? Date.now());
            save();
        });

        const saveEditBtn = $('#saveEditBtn');
        if (saveEditBtn) saveEditBtn.addEventListener('click', () => { saveCb && saveCb(); });

        const editModalInput = $('#editModalInput');
        if (editModalInput) {
            editModalInput.addEventListener('keydown', e => {
                if (e.key === 'Enter' && saveCb) saveCb();
                if (e.key === 'Tab') {
                    const target = e.shiftKey
                        ? $('#commonEditModal cds-modal-close-button')
                        : $('#saveEditBtn');
                    if (target) {
                        e.preventDefault();
                        e.stopPropagation();
                        queueMicrotask(() => target.focus());
                    }
                }
            });
        }

        const debugCarCount = $('#debugCarCount');
        if (debugCarCount) {
            debugCarCount.addEventListener('keydown', e => {
                if (e.key !== 'Tab') return;
                const target = e.shiftKey
                    ? $('#debugModal cds-modal-close-button')
                    : $('#executeDebugBtn');
                if (target) {
                    e.preventDefault();
                    e.stopPropagation();
                    queueMicrotask(() => target.focus());
                }
            });
        }

        const roomNameInput = $('#roomNameInput');
        if (roomNameInput) {
            installRoomTitleValueBridge(roomNameInput);
            roomNameInput.addEventListener('input', event => {
                refreshRoomTitle();
                if (event.isComposing) return;
                clearTimeout(saveTimer);
                saveTimer = setTimeout(save, 500);
            });
            roomNameInput.addEventListener('keydown', event => {
                if (event.key !== 'Enter') return;
                event.preventDefault();
                roomNameInput.blur();
            });
        }

        document.addEventListener('pointermove', e => {
            autoScrollEditingView(e.clientY);
            autoScrollSheetQuickEdit(e.clientX, e.clientY);
        }, { passive: true });
    }

    global.SanpoEvents = Object.freeze({
        ...events,
        bindCoreStartupEvents
    });
})(window);
