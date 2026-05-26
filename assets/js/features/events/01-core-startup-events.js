// Core startup event bindings that operate on already-rendered cards and global pointer movement.
(function (global) {
    'use strict';

    const events = global.SanpoEvents || {};

    function bindCoreStartupEvents() {
        if (document.documentElement.dataset.coreStartupEventsBound === 'true') return;
        document.documentElement.dataset.coreStartupEventsBound = 'true';

        D.body.addEventListener('click', async e => {
            const t = e.target;
            const nameTrigger = t.closest('.member-name-text, .driver-name-disp');
            if (nameTrigger) {
                toggleStatus(nameTrigger.closest('.member-card') || nameTrigger.closest('.driver-seat'));
                return;
            }
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

                    if (driverName && waitingList) addMember(driverName, driverMemo, driverGender, driverGrade, waitingList, false);
                    $$('.member-card', box).forEach(m => waitingList?.appendChild(m));
                    if (settlementState?.cars && driverName) delete settlementState.cars[driverName];
                    if (settlementState?.driverPaid && driverName) delete settlementState.driverPaid[driverName];

                    if (box.parentElement && box.parentElement.classList.contains('col-12')) {
                        box.parentElement.remove();
                    } else {
                        box.closest('.col-12')?.remove();
                    }
                }
            }
            updateUI();
            global.__lastLocalUpdatedAt = Date.now();
            save();
        });

        const saveEditBtn = $('#saveEditBtn');
        if (saveEditBtn) saveEditBtn.addEventListener('click', () => { saveCb && saveCb(); });

        const editModalInput = $('#editModalInput');
        if (editModalInput) {
            editModalInput.addEventListener('keydown', e => {
                if (e.key === 'Enter' && saveCb) saveCb();
            });
        }

        const roomNameInput = $('#roomNameInput');
        if (roomNameInput) {
            roomNameInput.addEventListener('input', () => {
                refreshRoomTitle();
                clearTimeout(saveTimer);
                saveTimer = setTimeout(save, 500);
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
