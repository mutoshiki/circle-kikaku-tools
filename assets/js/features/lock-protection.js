// Lock/protection feature
// Owns edit lock, protected menu state, passphrase panel, and app notices.

function getTrustedDeviceKey() {
    return `syawari_edit_trust_${roomId}`;
}

function loadTrustedEditPassphrase() {
    trustedEditPassphrase = localStorage.getItem(getTrustedDeviceKey()) || '';
}

function rememberTrustedDevice(passphrase) {
    trustedEditPassphrase = passphrase || '';
    if (trustedEditPassphrase) {
        localStorage.setItem(getTrustedDeviceKey(), trustedEditPassphrase);
    } else {
        safeLocalRemove(getTrustedDeviceKey());
    }
}

function hasTrustedEditAccess() {
    return !editLockEnabled || (!!editLockPassphrase && trustedEditPassphrase === editLockPassphrase);
}

function updateEditLockButton() {
    const btn = byId('editLockBtn');
    if (!btn) return;
    const icon = btn.querySelector('i');
    const label = btn.querySelector('span');
    icon.className = `fas ${editLockEnabled ? 'fa-lock' : 'fa-unlock'}`;
    label.textContent = editLockEnabled ? 'ロック中' : 'ロック';
    btn.classList.toggle('is-locked', editLockEnabled);
    btn.title = editLockEnabled ? '車割メーカーと精算ツールのロックを解除' : '車割メーカーと精算ツールをロック';
    btn.setAttribute('aria-label', btn.title);
    updateProtectedMenuItems();
    updateQuickEditButton();
}

function updateProtectedMenuItems() {
    const locked = !!editLockEnabled;
    ['historyBtn', 'sampleDataBtn', 'resetDataBtn'].forEach(id => {
        const btn = byId(id);
        if (!btn) return;
        btn.disabled = locked;
        btn.classList.toggle('disabled', locked);
        btn.setAttribute('aria-disabled', locked ? 'true' : 'false');
        if (locked) {
            if (btn.dataset.lockTitle === undefined) btn.dataset.lockTitle = btn.title || '';
            btn.title = 'ロック中は使えません';
        } else {
            btn.title = btn.dataset.lockTitle || '';
            delete btn.dataset.lockTitle;
        }
    });
}

function canUseUnlockedMenuAction() {
    if (!editLockEnabled) return true;
    showAppNotice('ロック中は使えません。先にロックを解除してください。', true);
    return false;
}

function updateQuickEditButton() {
    const btn = byId('sheet-quick-edit-btn');
    if (!btn) return;
    const canQuickEdit = !editLockEnabled || hasTrustedEditAccess();
    const shouldShow = currentView === 'sheet' && canQuickEdit;
    btn.style.display = shouldShow ? 'inline-flex' : 'none';
    if (!shouldShow) quickEditMode = false;
    btn.classList.toggle('active', quickEditMode && shouldShow);
    document.body.classList.toggle('quick-edit-mode', quickEditMode && shouldShow);
    btn.innerHTML = quickEditMode
        ? '<i class="fas fa-check me-1" aria-hidden="true"></i>完了'
        : '<i class="fas fa-pen me-1" aria-hidden="true"></i>編集';
    btn.setAttribute('aria-pressed', quickEditMode && shouldShow ? 'true' : 'false');
    btn.setAttribute('aria-label', quickEditMode ? '編集内容を保存して完了' : '発表ビューを編集');
}

function completeQuickEdit({ showNotice = true, rerender = true } = {}) {
    if (!quickEditMode) return false;

    let saveError = null;
    const previousPlans = Array.isArray(carPlans) ? cloneData(carPlans) : [];
    const previousOverview = window.SanpoOverview?.getSnapshot?.() || window.SanpoApp?.state?.getSnapshot?.()?.overview || {};
    const hadRenderablePlans = typeof hasSheetPlanContent === 'function'
        ? hasSheetPlanContent(previousPlans)
        : previousPlans.some(plan => (plan?.cars || []).length || (plan?.waiting || []).length);

    const restorePreviousSheet = reason => {
        if (previousPlans.length) carPlans = cloneData(previousPlans);
        window.SanpoOverview?.applySnapshot?.(previousOverview, { skipRender: true });
        saveError = saveError || new Error(reason || 'Quick edit restored previous sheet.');
    };

    if (currentView === 'sheet' && typeof syncSheetToMainData === 'function') {
        try {
            // 完了ボタンを押した時点の発表ビューDOMを、通常編集DOMより先に本データへ確定する。
            // 保存は再描画後に「表が残っている」ことを確認してから実行する。
            syncSheetToMainData({ refresh: false, persist: false, syncHiddenDom: false });
        } catch (error) {
            console.error('Quick edit commit failed:', error);
            restorePreviousSheet(error?.message || 'Quick edit commit failed.');
        }
    }

    // 保存処理で例外が出ても、空の通常表示を描画しないよう、
    // 発表ビュー側を復元してから編集モードを終了する。
    quickEditMode = false;
    updateQuickEditButton();

    if (typeof cleanupSheetEditArtifacts === 'function') cleanupSheetEditArtifacts();

    if (rerender && currentView === 'sheet' && typeof renderSheetView === 'function') {
        renderSheetView();
        const canvas = byId('sheet-canvas');
        const hasPlanSection = typeof hasRenderedSheetPlanContent === 'function'
            ? hasRenderedSheetPlanContent(canvas)
            : !!canvas?.querySelector(':scope > .sheet-plan-section[data-plan-id]:not(.sheet-timetable-section) .sheet-plan-table > .sheet-car-col, :scope > .sheet-plan-section[data-plan-id]:not(.sheet-timetable-section) .sheet-wait-block');
        const isEmptySheet = hadRenderablePlans && !hasPlanSection;
        if (isEmptySheet) {
            restorePreviousSheet('Quick edit render fallback restored previous sheet.');
            renderSheetView();
        }
    }

    if (!saveError && typeof renderActiveCarPlanToDom === 'function') {
        const previousSuspend = !!window.__suspendActiveDomPlanSync;
        try {
            window.__suspendActiveDomPlanSync = true;
            renderActiveCarPlanToDom({ skipUpdate: true });
        } catch (error) {
            console.error('Quick edit hidden DOM refresh failed:', error);
        } finally {
            window.__suspendActiveDomPlanSync = previousSuspend;
        }
    }

    if (!saveError && typeof persistSheetCommittedSnapshot === 'function') {
        try {
            persistSheetCommittedSnapshot();
        } catch (error) {
            saveError = error;
            console.error('Quick edit persist failed:', error);
            restorePreviousSheet(error?.message || 'Quick edit persist failed.');
            if (rerender && currentView === 'sheet' && typeof renderSheetView === 'function') renderSheetView();
        }
    }

    if (showNotice && typeof showAppNotice === 'function') {
        showAppNotice(saveError ? '編集を保存できなかったため、表示を元に戻しました。' : '編集を保存しました。', !!saveError);
    }
    return !saveError;
}

function toggleQuickEdit() {
    if (!hasTrustedEditAccess()) return;
    if (quickEditMode) {
        completeQuickEdit({ showNotice: true, rerender: true });
        return;
    }
    quickEditMode = true;
    updateQuickEditButton();
    if (currentView === 'sheet') renderSheetView();
}

window.addEventListener('beforeunload', () => {
    if (quickEditMode && currentView === 'sheet' && typeof syncSheetToMainData === 'function') {
        try {
            syncSheetToMainData({ refresh: false, persist: true, syncHiddenDom: false });
        } catch (error) {
            console.error('Quick edit beforeunload save failed:', error);
        }
    }
});

window.completeQuickEdit = completeQuickEdit;
window.SanpoApp?.exposeCompat?.('toggleQuickEdit', toggleQuickEdit);
window.SanpoApp?.exposeCompat?.('completeQuickEdit', completeQuickEdit);

function showAppNotice(message, isError = false) {
    let toast = byId('app-notice');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'app-notice';
        toast.className = 'app-notice';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.toggle('is-error', !!isError);
    toast.classList.add('visible');
    setTimeout(() => { toast.classList.remove('visible'); }, 2200);
}

function requestPassphrasePanel(message, isPassword = true) {
    return new Promise(resolve => {
        const old = byId('passphrase-panel');
        if (old) old.remove();

        const overlay = document.createElement('div');
        overlay.id = 'passphrase-panel';
        overlay.className = 'passphrase-panel';

        const form = document.createElement('form');
        form.className = 'passphrase-form';

        const label = document.createElement('label');
        label.textContent = message;
        label.className = 'passphrase-label';

        const input = document.createElement('input');
        input.type = isPassword ? 'password' : 'text';
        input.autocomplete = 'off';
        input.className = 'passphrase-input';

        const actions = document.createElement('div');
        actions.className = 'passphrase-actions';

        const cancel = document.createElement('button');
        cancel.type = 'button';
        cancel.textContent = 'キャンセル';
        cancel.className = 'passphrase-cancel';

        const submit = document.createElement('button');
        submit.type = 'submit';
        submit.textContent = 'OK';
        submit.className = 'passphrase-submit';

        const done = value => {
            overlay.remove();
            resolve(value);
        };

        cancel.onclick = () => done(null);
        overlay.onclick = event => {
            if (event.target === overlay) done(null);
        };
        form.onsubmit = event => {
            event.preventDefault();
            done(input.value.trim());
        };

        actions.append(cancel, submit);
        form.append(label, input, actions);
        overlay.appendChild(form);
        document.body.appendChild(overlay);
        input.focus();
    });
}

async function requestPassphrase(message) {
    try {
        const value = window.prompt(message);
        if (value === null) return null;
        return value.trim();
    } catch (e) {
        return requestPassphrasePanel(message);
    }
}

async function verifyEditPassphrase(message) {
    if (hasTrustedEditAccess()) return true;
    const input = await requestPassphrase(message);
    if (input === null) return false;
    if (input !== editLockPassphrase) {
        showAppNotice('合言葉が違います。', true);
        return false;
    }
    rememberTrustedDevice(input);
    return true;
}

async function toggleEditProtection() {
    if (!editLockEnabled) {
        const first = await requestPassphrase('車割メーカーと精算ツールをロックする合言葉を設定してください');
        if (first === null) return;
        if (!first) {
            showAppNotice('合言葉を入力してください。', true);
            return;
        }
        const second = await requestPassphrase('確認のため、もう一度同じ合言葉を入力してください');
        if (second === null) return;
        if (first !== second) {
            showAppNotice('合言葉が一致しません。', true);
            return;
        }
        editLockEnabled = true;
        editLockPassphrase = first;
        rememberTrustedDevice(first);
        updateEditLockButton();
        save();
        return;
    }

    if (!(await verifyEditPassphrase('ロックを解除する合言葉を入力してください'))) return;
    editLockEnabled = false;
    editLockPassphrase = '';
    rememberTrustedDevice('');
    updateEditLockButton();
    save();
}
window.SanpoApp?.exposeCompat?.('toggleEditProtection', toggleEditProtection);
