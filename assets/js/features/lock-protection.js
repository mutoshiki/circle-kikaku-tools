// Lock/protection feature
// Owns edit lock, protected menu state, passphrase panel, and app notices.

function getTrustedDeviceKey() {
    return `syawari_edit_trust_${roomId}`;
}

function normalizeEditLockScopes(scopes = editLockScopes) {
    const source = scopes && typeof scopes === 'object' ? scopes : {};
    return {
        allocation: !!source.allocation,
        settlement: !!source.settlement
    };
}

function getLockedScopeLabels(scopes = editLockScopes) {
    const normalized = normalizeEditLockScopes(scopes);
    const labels = [];
    if (normalized.allocation) labels.push('車割・班割');
    if (normalized.settlement) labels.push('精算');
    return labels;
}

function isEditScopeLocked(scope = 'any') {
    if (!editLockEnabled || !editLockPassphrase) return false;
    const scopes = normalizeEditLockScopes();
    if (scope === 'allocation' || scope === 'settlement') return !!scopes[scope];
    return scopes.allocation || scopes.settlement;
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

function hasTrustedEditAccess(scope = 'any') {
    return !isEditScopeLocked(scope) || (!!editLockPassphrase && trustedEditPassphrase === editLockPassphrase);
}

function updateEditLockButton() {
    const btn = byId('editLockBtn');
    if (!btn) return;
    const icon = btn.querySelector('i');
    const label = btn.querySelector('span');
    const labels = getLockedScopeLabels();
    const locked = labels.length > 0;
    const partial = labels.length === 1;
    icon.className = `fas ${locked ? 'fa-lock' : 'fa-unlock'}`;
    label.textContent = locked ? (partial ? '一部ロック' : 'ロック中') : 'ロック';
    btn.classList.toggle('is-locked', locked);
    btn.classList.toggle('is-partial-lock', partial);
    btn.title = locked
        ? `${labels.join('・')}のロックを解除`
        : '車割・班割と精算のロック範囲を選ぶ';
    btn.setAttribute('aria-label', btn.title);
    updateProtectedMenuItems();
    updateQuickEditButton();
}

function updateProtectedMenuItems() {
    const lockedForThisDevice = isEditScopeLocked('any') && !hasTrustedEditAccess('any');
    ['historyBtn', 'sampleDataBtn', 'resetDataBtn'].forEach(id => {
        const btn = byId(id);
        if (!btn) return;
        btn.disabled = lockedForThisDevice;
        btn.classList.toggle('disabled', lockedForThisDevice);
        btn.setAttribute('aria-disabled', lockedForThisDevice ? 'true' : 'false');
        if (lockedForThisDevice) {
            if (btn.dataset.lockTitle === undefined) btn.dataset.lockTitle = btn.title || '';
            btn.title = 'ロック中は使えません';
        } else {
            btn.title = btn.dataset.lockTitle || '';
            delete btn.dataset.lockTitle;
        }
    });
}

function canUseUnlockedMenuAction() {
    if (hasTrustedEditAccess('any')) return true;
    showAppNotice('ロック中は使えません。先にロックを解除してください。', true);
    return false;
}

function updateQuickEditButton() {
    const btn = byId('sheet-quick-edit-btn');
    if (!btn) return;
    const canQuickEdit = hasTrustedEditAccess('allocation');
    const shouldShow = currentView === 'sheet' && canQuickEdit;
    btn.style.display = shouldShow ? 'inline-flex' : 'none';
    if (!shouldShow) quickEditMode = false;
    btn.classList.toggle('active', quickEditMode && shouldShow);
    document.body.classList.toggle('quick-edit-mode', quickEditMode && shouldShow);
    btn.innerHTML = quickEditMode
        ? '<i class="fas fa-check" aria-hidden="true"></i><span>完了</span>'
        : '<i class="fas fa-pen" aria-hidden="true"></i>';
    btn.title = quickEditMode ? '完了' : '編集';
    btn.setAttribute('aria-pressed', quickEditMode && shouldShow ? 'true' : 'false');
    btn.setAttribute('aria-label', quickEditMode ? '編集内容を保存して完了' : '共有画面を編集');
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
    if (!hasTrustedEditAccess('allocation')) return;
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

function createLockPanelBase(message) {
    const old = byId('passphrase-panel');
    if (old) old.remove();

    const overlay = document.createElement('div');
    overlay.id = 'passphrase-panel';
    overlay.className = 'passphrase-panel';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    const form = document.createElement('form');
    form.className = 'passphrase-form';

    const label = document.createElement('div');
    label.textContent = message;
    label.className = 'passphrase-label';
    form.appendChild(label);
    overlay.appendChild(form);
    return { overlay, form };
}

function createPassphraseInput({ label, isPassword = true, autocomplete = 'off' }) {
    const field = document.createElement('label');
    field.className = 'passphrase-field';
    const caption = document.createElement('span');
    caption.className = 'passphrase-field-label';
    caption.textContent = label;
    const input = document.createElement('input');
    input.type = isPassword ? 'password' : 'text';
    input.autocomplete = autocomplete;
    input.className = 'passphrase-input';
    field.append(caption, input);
    return { field, input };
}

function appendPassphraseActions(form, { cancelText = 'キャンセル', submitText = 'OK', onCancel }) {
    const actions = document.createElement('div');
    actions.className = 'passphrase-actions';

    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = cancelText;
    cancel.className = 'passphrase-cancel';
    cancel.addEventListener('click', onCancel);

    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.textContent = submitText;
    submit.className = 'passphrase-submit';

    actions.append(cancel, submit);
    form.appendChild(actions);
}

function requestPassphrasePanel(message, isPassword = true) {
    return new Promise(resolve => {
        const { overlay, form } = createLockPanelBase(message);
        const { field, input } = createPassphraseInput({
            label: isPassword ? '合言葉' : '入力',
            isPassword,
            autocomplete: isPassword ? 'current-password' : 'off'
        });
        form.appendChild(field);

        const done = value => {
            overlay.remove();
            resolve(value);
        };
        appendPassphraseActions(form, { onCancel: () => done(null) });
        overlay.addEventListener('click', event => {
            if (event.target === overlay) done(null);
        });
        overlay.addEventListener('keydown', event => {
            if (event.key === 'Escape') done(null);
        });
        form.addEventListener('submit', event => {
            event.preventDefault();
            done(input.value.trim());
        });

        document.body.appendChild(overlay);
        input.focus();
    });
}

function requestLockSetupPanel() {
    return new Promise(resolve => {
        const { overlay, form } = createLockPanelBase('ロックする範囲と合言葉を設定してください');
        form.classList.add('passphrase-form--lock-setup');

        const scopeGroup = document.createElement('fieldset');
        scopeGroup.className = 'lock-scope-group';
        const legend = document.createElement('legend');
        legend.textContent = 'ロックする機能';
        scopeGroup.appendChild(legend);

        const createScopeOption = (value, label, icon) => {
            const option = document.createElement('label');
            option.className = 'lock-scope-option';
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.value = value;
            input.checked = true;
            const content = document.createElement('span');
            content.className = 'lock-scope-option-content';
            content.innerHTML = `<i class="fas ${icon}" aria-hidden="true"></i><span>${label}</span>`;
            option.append(input, content);
            return { option, input };
        };

        const allocation = createScopeOption('allocation', '車割・班割', 'fa-pen-to-square');
        const settlement = createScopeOption('settlement', '精算', 'fa-receipt');
        scopeGroup.append(allocation.option, settlement.option);
        form.appendChild(scopeGroup);

        const first = createPassphraseInput({ label: '合言葉', isPassword: true, autocomplete: 'new-password' });
        const second = createPassphraseInput({ label: '合言葉（確認）', isPassword: true, autocomplete: 'new-password' });
        form.append(first.field, second.field);

        const error = document.createElement('div');
        error.className = 'passphrase-error';
        error.hidden = true;
        form.appendChild(error);

        const done = value => {
            overlay.remove();
            resolve(value);
        };
        appendPassphraseActions(form, { submitText: 'ロックする', onCancel: () => done(null) });
        overlay.addEventListener('click', event => {
            if (event.target === overlay) done(null);
        });
        overlay.addEventListener('keydown', event => {
            if (event.key === 'Escape') done(null);
        });
        form.addEventListener('submit', event => {
            event.preventDefault();
            const scopes = {
                allocation: allocation.input.checked,
                settlement: settlement.input.checked
            };
            const passphrase = first.input.value.trim();
            const confirmation = second.input.value.trim();
            let message = '';
            if (!scopes.allocation && !scopes.settlement) message = 'ロックする機能を1つ以上選んでください。';
            else if (!passphrase) message = '合言葉を入力してください。';
            else if (passphrase !== confirmation) message = '合言葉が一致しません。';
            if (message) {
                error.textContent = message;
                error.hidden = false;
                return;
            }
            done({ passphrase, scopes });
        });

        document.body.appendChild(overlay);
        first.input.focus();
    });
}

async function requestPassphrase(message) {
    return requestPassphrasePanel(message, true);
}

async function verifyEditPassphrase(message, scope = 'any', { allowTrusted = true } = {}) {
    if (allowTrusted && hasTrustedEditAccess(scope)) return true;
    const input = await requestPassphrase(message);
    if (input === null) return false;
    if (input !== editLockPassphrase) {
        showAppNotice('合言葉が違います。', true);
        return false;
    }
    rememberTrustedDevice(input);
    updateProtectedMenuItems();
    updateQuickEditButton();
    return true;
}

async function toggleEditProtection() {
    if (!isEditScopeLocked('any')) {
        const setup = await requestLockSetupPanel();
        if (!setup) return;
        editLockScopes = normalizeEditLockScopes(setup.scopes);
        editLockEnabled = editLockScopes.allocation || editLockScopes.settlement;
        editLockPassphrase = setup.passphrase;
        rememberTrustedDevice(setup.passphrase);
        updateEditLockButton();
        save();
        const labels = getLockedScopeLabels();
        showAppNotice(`${labels.join('・')}をロックしました。`);
        return;
    }

    if (!(await verifyEditPassphrase('ロックを解除する合言葉を入力してください', 'any', { allowTrusted: false }))) return;
    editLockEnabled = false;
    editLockPassphrase = '';
    editLockScopes = { allocation: false, settlement: false };
    rememberTrustedDevice('');
    updateEditLockButton();
    save();
    showAppNotice('ロックを解除しました。');
}

window.SanpoApp?.exposeCompat?.('toggleEditProtection', toggleEditProtection);
window.SanpoApp?.exposeCompat?.('isEditScopeLocked', isEditScopeLocked);
window.SanpoApp?.exposeCompat?.('hasTrustedEditAccess', hasTrustedEditAccess);
