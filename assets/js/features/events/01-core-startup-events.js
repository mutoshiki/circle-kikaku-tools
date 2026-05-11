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
                if (await appConfirm('この車を削除しますか？同乗者は未割り当てメンバーに戻ります。', { title: '車を削除', okText: '削除', danger: true })) {
                    $$('.member-card', box).forEach(m => $('#waiting-list').appendChild(m));
                    if (box.parentElement && box.parentElement.classList.contains('col-12')) {
                        box.parentElement.remove();
                    } else {
                        box.closest('.col-12').remove();
                    }
                }
            }
            updateUI();
            global.__lastLocalUpdatedAt = Date.now();
            save();
        });

        const saveEditBtn = $('#saveEditBtn');
        if (saveEditBtn) saveEditBtn.onclick = () => { saveCb && saveCb(); };

        const editModalInput = $('#editModalInput');
        if (editModalInput) {
            editModalInput.onkeypress = e => {
                if (e.key === 'Enter' && saveCb) saveCb();
            };
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
