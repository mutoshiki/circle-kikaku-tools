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
    const labels = getLockedScopeLabels();
    const locked = labels.length > 0;
    const partial = labels.length === 1;
    window.SanpoIconAdapter.setStateIcon(btn, 'editLock', locked ? 'locked' : 'unlocked');
    btn.classList.toggle('is-locked', locked);
    btn.classList.toggle('is-partial-lock', partial);
    const accessibleLabel = locked
        ? `${labels.join('・')}のロックを解除`
        : '車割・班割と精算のロック範囲を選ぶ';
    btn.setAttribute('aria-label', accessibleLabel);
    const scopeState = normalizeEditLockScopes();
    [
        ['allocation', byId('tab-list'), '車割・班割'],
        ['settlement', byId('tab-seisan'), '精算']
    ].forEach(([scope, tab, baseLabel]) => {
        if (!tab) return;
        const scopeLocked = locked && !!scopeState[scope];
        const indicator = tab.querySelector(`[data-view-lock-scope="${scope}"]`);
        if (indicator) {
            indicator.hidden = !scopeLocked;
            indicator.setAttribute('aria-hidden', scopeLocked ? 'false' : 'true');
        }
        tab.classList.toggle('view-tab--locked', scopeLocked);
        tab.setAttribute('aria-label', scopeLocked ? `${baseLabel}（ロック中）` : baseLabel);
    });
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
        ? '<span data-carbon-icon="checkmark" aria-hidden="true"></span><span>完了</span>'
        : '<span data-carbon-icon="edit" aria-hidden="true"></span><span>編集</span>';
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

function createLockModalBase(title, description = '') {
    byId('passphrase-panel')?.remove();

    const modal = document.createElement('cds-modal');
    modal.id = 'passphrase-panel';
    modal.className = 'app-modal lock-modal';
    modal.size = 'xs';
    modal.setAttribute('size', 'xs');
    modal.setAttribute('aria-label', title);

    const header = document.createElement('cds-modal-header');
    const heading = document.createElement('cds-modal-heading');
    heading.id = 'passphrase-panel-title';
    heading.tabIndex = -1;
    heading.dataset.modalPrimaryFocus = '';
    heading.textContent = title;
    const close = document.createElement('cds-modal-close-button');
    close.setAttribute('close-button-label', '閉じる');
    close.dataset.modalClose = '';
    header.append(heading, close);

    const body = document.createElement('cds-modal-body');
    body.className = 'app-modal-body lock-modal-body';
    if (description) {
        const helper = document.createElement('p');
        helper.className = 'lock-modal-description';
        helper.textContent = description;
        body.appendChild(helper);
    }

    const footer = document.createElement('cds-modal-footer');
    footer.className = 'app-modal-footer';
    const cancel = document.createElement('cds-modal-footer-button');
    cancel.kind = 'secondary';
    cancel.type = 'button';
    cancel.dataset.modalClose = '';
    cancel.textContent = 'キャンセル';
    const submit = document.createElement('cds-modal-footer-button');
    submit.kind = 'primary';
    submit.type = 'button';
    submit.textContent = 'OK';
    footer.append(cancel, submit);

    modal.append(header, body, footer);
    document.body.appendChild(modal);
    const adapter = globalThis.AppModalAdapter.getOrCreateInstance(modal);
    return { modal, adapter, body, submit };
}

function createPassphraseInput({ label, isPassword = true, autocomplete = 'off' }) {
    const input = document.createElement('cds-text-input');
    input.type = isPassword ? 'password' : 'text';
    input.autocomplete = autocomplete;
    input.className = 'passphrase-input';
    input.size = 'lg';
    input.label = label;
    input.setAttribute('label', label);
    input.setAttribute('aria-label', label);
    return input;
}

function settleLockModal({ modal, adapter, resolve }, value) {
    if (modal.dataset.resultSettled === 'true') return;
    modal.dataset.resultSettled = 'true';
    modal.pendingResult = value;
    adapter.hide();
}

function bindLockModalLifecycle({ modal, adapter, resolve }) {
    modal.addEventListener('sanpo:modal-hidden', () => {
        const value = modal.dataset.resultSettled === 'true' ? modal.pendingResult : null;
        modal.remove();
        resolve(value);
    }, { once: true });
    adapter.show();
}

function requestPassphrasePanel(message, isPassword = true) {
    return new Promise(resolve => {
        const parts = createLockModalBase('ロック解除', message);
        const input = createPassphraseInput({
            label: isPassword ? '合言葉' : '入力',
            isPassword,
            autocomplete: isPassword ? 'current-password' : 'off'
        });
        parts.body.appendChild(input);
        const submit = () => settleLockModal({ ...parts, resolve }, input.value.trim());
        parts.submit.addEventListener('click', submit);
        input.addEventListener('keydown', event => {
            if (event.key === 'Enter') {
                event.preventDefault();
                submit();
            }
        });
        bindLockModalLifecycle({ ...parts, resolve });
    });
}

function requestLockSetupPanel() {
    return new Promise(resolve => {
        const parts = createLockModalBase('編集ロック', 'ロックする範囲と合言葉を設定してください。');
        parts.submit.textContent = 'ロックする';

        const scopeGroup = document.createElement('fieldset');
        scopeGroup.className = 'lock-scope-group';
        const legend = document.createElement('legend');
        legend.textContent = 'ロックする機能';
        scopeGroup.appendChild(legend);

        const createScopeOption = (id, label) => {
            const input = document.createElement('cds-checkbox');
            input.id = id;
            input.checked = true;
            input.setAttribute('checked', '');
            input.setAttribute('label-text', label);
            input.setAttribute('aria-label', label);
            return input;
        };
        const allocation = createScopeOption('lockScopeAllocation', '車割・班割');
        const settlement = createScopeOption('lockScopeSettlement', '精算');
        scopeGroup.append(allocation, settlement);

        const first = createPassphraseInput({ label: '合言葉', isPassword: true, autocomplete: 'new-password' });
        const second = createPassphraseInput({ label: '合言葉（確認）', isPassword: true, autocomplete: 'new-password' });
        const error = document.createElement('cds-inline-notification');
        error.className = 'passphrase-error';
        error.kind = 'error';
        error.setAttribute('kind', 'error');
        error.setAttribute('low-contrast', '');
        error.setAttribute('hide-close-button', '');
        error.hidden = true;

        const showError = message => {
            error.replaceChildren();
            const title = document.createElement('span');
            title.slot = 'title';
            title.textContent = '入力内容を確認してください';
            const subtitle = document.createElement('span');
            subtitle.slot = 'subtitle';
            subtitle.textContent = message;
            error.append(title, subtitle);
            error.hidden = false;
        };

        parts.body.append(scopeGroup, first, second, error);
        const submit = () => {
            const scopes = { allocation: !!allocation.checked, settlement: !!settlement.checked };
            const passphrase = first.value.trim();
            const confirmation = second.value.trim();
            if (!scopes.allocation && !scopes.settlement) return showError('ロックする機能を1つ以上選んでください。');
            if (!passphrase) return showError('合言葉を入力してください。');
            if (passphrase !== confirmation) return showError('合言葉が一致しません。');
            settleLockModal({ ...parts, resolve }, { passphrase, scopes });
        };
        parts.submit.addEventListener('click', submit);
        [first, second].forEach(input => input.addEventListener('input', () => { error.hidden = true; }));
        second.addEventListener('keydown', event => {
            if (event.key === 'Enter') {
                event.preventDefault();
                submit();
            }
        });
        bindLockModalLifecycle({ ...parts, resolve });
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
