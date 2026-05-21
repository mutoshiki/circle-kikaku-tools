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
        ? '<i class="fas fa-check me-1" aria-hidden="true"></i>編集中'
        : '<i class="fas fa-hand-paper me-1" aria-hidden="true"></i>クイック編集';
    btn.setAttribute('aria-pressed', quickEditMode && shouldShow ? 'true' : 'false');
    btn.setAttribute('aria-label', quickEditMode ? 'クイック編集を完了' : '発表ビューをクイック編集');
}

function toggleQuickEdit() {
    if (!hasTrustedEditAccess()) return;
    quickEditMode = !quickEditMode;
    updateQuickEditButton();
    if (currentView === 'sheet') renderSheetView();
}
window.SanpoApp?.exposeCompat?.('toggleQuickEdit', toggleQuickEdit);

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
