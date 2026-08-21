(function () {
  const state = {
    confirmModal: null,
    alertModal: null,
    undoTimer: null,
    undoAction: null,
    statusTimer: null,
    statusToast: null,
    syncTimer: null,
    syncDelayTimer: null,
    syncToast: null,
    syncKind: 'neutral',
    syncMessage: '',
    syncVisible: false,
    syncVisibleKind: '',
    syncHadPendingState: false,
    syncSuppressUntil: 0
  };

  const STATUS_NOTIFICATIONS = Object.freeze({
    success: Object.freeze({ kind: 'success', iconDescription: '成功' }),
    error: Object.freeze({ kind: 'error', iconDescription: 'エラー' }),
    warning: Object.freeze({ kind: 'warning', iconDescription: '警告' }),
    info: Object.freeze({ kind: 'info', iconDescription: '情報' }),
    neutral: Object.freeze({ kind: 'info', iconDescription: '情報' })
  });
  const DEFAULT_TOAST_DURATION = 2400;
  const SYNC_PROGRESS_DELAY = 650;

  function ensureNotificationRegion() {
    let region = document.getElementById('appNotificationRegion');
    if (!region) {
      region = document.createElement('div');
      region.id = 'appNotificationRegion';
      region.className = 'app-notification-region';
      region.setAttribute('aria-label', 'ステータス通知');
      document.body.appendChild(region);
    }
    document.getElementById('syncStatusBadge')?.remove();
    return region;
  }

  function ensureConfirmModal() {
    let el = document.getElementById('appConfirmModal');
    if (!el) {
      el = document.createElement('cds-modal');
      el.id = 'appConfirmModal';
      el.className = 'app-modal app-decision-modal';
      el.setAttribute('size', 'xs');
      el.setAttribute('aria-label', '確認');
      el.innerHTML = `
        <cds-modal-header>
          <cds-modal-heading data-modal-primary-focus id="appConfirmModalTitle" class="app-modal-heading" tabindex="-1">確認</cds-modal-heading>
          <cds-modal-close-button data-modal-close close-button-label="閉じる"></cds-modal-close-button>
        </cds-modal-header>
        <cds-modal-body class="app-modal-body"><div class="app-decision-message"></div></cds-modal-body>
        <cds-modal-footer class="app-modal-footer">
          <cds-modal-footer-button type="button" kind="secondary" data-role="cancel">キャンセル</cds-modal-footer-button>
          <cds-modal-footer-button type="button" kind="primary" data-role="ok">実行</cds-modal-footer-button>
        </cds-modal-footer>`;
      document.body.appendChild(el);
    }
    if (!state.confirmModal && window.AppModalAdapter) state.confirmModal = window.AppModalAdapter.getOrCreateInstance(el);
    return el;
  }

  function ensureAlertModal() {
    let el = document.getElementById('appAlertModal');
    if (!el) {
      el = document.createElement('cds-modal');
      el.id = 'appAlertModal';
      el.className = 'app-modal app-decision-modal';
      el.setAttribute('size', 'xs');
      el.setAttribute('aria-label', 'お知らせ');
      el.innerHTML = `
        <cds-modal-header>
          <cds-modal-heading data-modal-primary-focus id="appAlertModalTitle" class="app-modal-heading" tabindex="-1">お知らせ</cds-modal-heading>
          <cds-modal-close-button data-modal-close close-button-label="閉じる"></cds-modal-close-button>
        </cds-modal-header>
        <cds-modal-body class="app-modal-body"><div class="app-decision-message"></div></cds-modal-body>
        <cds-modal-footer class="app-modal-footer app-modal-footer--single">
          <cds-modal-footer-button type="button" kind="primary" data-role="ok">OK</cds-modal-footer-button>
        </cds-modal-footer>`;
      document.body.appendChild(el);
    }
    if (!state.alertModal && window.AppModalAdapter) state.alertModal = window.AppModalAdapter.getOrCreateInstance(el);
    return el;
  }

  function setMessage(el, selector, message) {
    const box = el.querySelector(selector);
    if (box) box.textContent = String(message || '');
  }

  function confirm(message, options = {}) {
    if (!window.AppModalAdapter) return Promise.resolve(window.confirm(String(message || '')));
    const el = ensureConfirmModal();
    const title = el.querySelector('cds-modal-heading');
    const ok = el.querySelector('[data-role="ok"]');
    const cancel = el.querySelector('[data-role="cancel"]');
    title.textContent = options.title || '確認';
    el.setAttribute('aria-label', title.textContent);
    ok.textContent = options.okText || '実行';
    cancel.textContent = options.cancelText || 'キャンセル';
    ok.kind = options.danger ? 'danger' : 'primary';
    setMessage(el, '.app-decision-message', message);

    return new Promise(resolve => {
      let done = false;
      let requestedValue = false;
      const finish = value => {
        if (done) return;
        done = true;
        ok.removeEventListener('click', onOk);
        cancel.removeEventListener('click', onCancel);
        el.removeEventListener('sanpo:modal-hidden', onHidden);
        resolve(value);
      };
      const onOk = () => {
        requestedValue = true;
        queueMicrotask(() => state.confirmModal.hide());
      };
      const onCancel = () => {
        requestedValue = false;
        queueMicrotask(() => state.confirmModal.hide());
      };
      const onHidden = () => finish(requestedValue);
      ok.addEventListener('click', onOk);
      cancel.addEventListener('click', onCancel);
      el.addEventListener('sanpo:modal-hidden', onHidden, { once: true });
      state.confirmModal.show();
    });
  }

  function alert(message, options = {}) {
    if (!window.AppModalAdapter) { window.alert(String(message || '')); return Promise.resolve(); }
    const el = ensureAlertModal();
    const title = el.querySelector('cds-modal-heading');
    const ok = el.querySelector('[data-role="ok"]');
    title.textContent = options.title || 'お知らせ';
    el.setAttribute('aria-label', title.textContent);
    ok.textContent = options.okText || 'OK';
    setMessage(el, '.app-decision-message', message);

    return new Promise(resolve => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        ok.removeEventListener('click', onOk);
        el.removeEventListener('sanpo:modal-hidden', onHidden);
        resolve();
      };
      const onOk = () => { state.alertModal.hide(); finish(); };
      const onHidden = () => finish();
      ok.addEventListener('click', onOk);
      el.addEventListener('sanpo:modal-hidden', onHidden, { once: true });
      state.alertModal.show();
    });
  }

  function removeToast(toast, slot) {
    if (!toast) return;
    toast.classList.remove('visible');
    toast.removeAttribute('open');
    toast.remove();
    if (slot === 'status' && state.statusToast === toast) {
      state.statusToast = null;
      clearTimeout(state.statusTimer);
      state.statusTimer = null;
    }
    if (slot === 'sync' && state.syncToast === toast) {
      state.syncToast = null;
      state.syncVisible = false;
      state.syncVisibleKind = '';
      clearTimeout(state.syncTimer);
      state.syncTimer = null;
    }
  }

  function createStatusToast({ title = 'お知らせ', subtitle = '', tone = 'neutral', slot = 'status' } = {}) {
    const notification = STATUS_NOTIFICATIONS[tone] || STATUS_NOTIFICATIONS.neutral;
    const toast = document.createElement('cds-toast-notification');
    toast.id = slot === 'sync' ? 'appSyncStatusToast' : 'appStatusToast';
    toast.className = `app-status-toast app-status-toast--${slot}`;
    toast.dataset.tone = tone;
    toast.setAttribute('kind', notification.kind);
    toast.setAttribute('open', '');
    toast.setAttribute('role', notification.kind === 'error' ? 'alert' : 'status');
    toast.setAttribute('aria-live', notification.kind === 'error' ? 'assertive' : 'polite');
    toast.setAttribute('aria-atomic', 'true');
    toast.ariaLabel = '通知を閉じる';
    toast.setAttribute('status-icon-description', notification.iconDescription);
    // Carbon's toast already renders the slotted title. The native HTML title
    // attribute/property must stay empty or some versions render the heading twice.
    toast.removeAttribute('title');
    toast.title = '';
    const titleNode = document.createElement('span');
    titleNode.slot = 'title';
    titleNode.textContent = title;
    const subtitleNode = document.createElement('span');
    subtitleNode.slot = 'subtitle';
    subtitleNode.textContent = subtitle;
    toast.append(titleNode, subtitleNode);
    toast.addEventListener('cds-notification-closed', () => removeToast(toast, slot), { once: true });
    ensureNotificationRegion().prepend(toast);
    requestAnimationFrame(() => {
      if (toast.isConnected) toast.classList.add('visible');
    });
    return toast;
  }

  function genericToastCopy(message, tone, options = {}) {
    if (options.title || options.subtitle) {
      return {
        title: String(options.title || 'お知らせ'),
        subtitle: String(options.subtitle || message || '')
      };
    }
    const text = String(message || '');
    if (tone === 'success') return { title: '完了しました', subtitle: text };
    if (tone === 'error') return { title: '操作を完了できませんでした', subtitle: text };
    if (tone === 'warning') return { title: '確認してください', subtitle: text };
    return { title: 'お知らせ', subtitle: text };
  }

  function showStatus(message, options = {}) {
    if (!message && !options.title && !options.subtitle) return;
    const requestedTone = String(options.tone || 'neutral').toLowerCase();
    const tone = STATUS_NOTIFICATIONS[requestedTone] ? requestedTone : 'neutral';
    const duration = Number.isFinite(options.duration) ? Math.max(800, options.duration) : DEFAULT_TOAST_DURATION;
    removeToast(state.statusToast || document.getElementById('appStatusToast'), 'status');
    const copy = genericToastCopy(message, tone, options);
    const toast = createStatusToast({ ...copy, tone, slot: 'status' });
    state.statusToast = toast;
    state.statusTimer = setTimeout(() => removeToast(toast, 'status'), duration);
  }

  function syncCopy(kind, message) {
    const raw = String(message || '');
    if (kind === 'saving') {
      return { title: '保存しています', subtitle: '変更内容を保存しています。', tone: 'info' };
    }
    if (kind === 'connected') {
      if (/再送|保留/.test(raw)) {
        return { title: '保存しました', subtitle: '保留していた変更も反映されました。', tone: 'success' };
      }
      return { title: '保存しました', subtitle: '変更内容を反映しました。', tone: 'success' };
    }
    if (kind === 'local') {
      if (/通信|オフライン|接続/.test(raw)) {
        return { title: '接続を待っています', subtitle: '変更はこの端末に残っています。接続が戻ると自動で反映されます。', tone: 'warning' };
      }
      return { title: 'この端末に保存しました', subtitle: '変更内容は端末に残っています。', tone: 'info' };
    }
    if (kind === 'error') {
      if (/新版|未対応/.test(raw)) {
        return { title: 'この共有データを開けません', subtitle: 'アプリを更新してから、もう一度開いてください。', tone: 'error' };
      }
      if (/permission[_ -]?denied|権限/i.test(raw)) {
        return { title: '保存できませんでした', subtitle: 'この共有データを編集できるか確認してください。', tone: 'error' };
      }
      return { title: '接続を待っています', subtitle: '変更はこの端末に残っています。接続が戻ると自動で反映されます。', tone: 'warning' };
    }
    return { title: 'お知らせ', subtitle: raw, tone: 'info' };
  }

  function showSyncToast(kind, message, { persistent = false } = {}) {
    removeToast(state.syncToast || document.getElementById('appSyncStatusToast'), 'sync');
    const copy = syncCopy(kind, message);
    const toast = createStatusToast({ ...copy, slot: 'sync' });
    state.syncToast = toast;
    state.syncVisible = true;
    state.syncVisibleKind = kind;
    if (!persistent) state.syncTimer = setTimeout(() => removeToast(toast, 'sync'), DEFAULT_TOAST_DURATION);
  }

  function suppressSyncFeedback(duration = 1800) {
    state.syncSuppressUntil = Math.max(state.syncSuppressUntil, Date.now() + Math.max(0, Number(duration) || 0));
    clearTimeout(state.syncDelayTimer);
    state.syncDelayTimer = null;
    removeToast(state.syncToast || document.getElementById('appSyncStatusToast'), 'sync');
  }

  function resumeSyncFeedback() {
    state.syncSuppressUntil = 0;
  }

  function setSyncStatus(kind = 'neutral', message = '') {
    ensureNotificationRegion();
    const nextMessage = String(message || '');
    const previousKind = state.syncKind;
    const previousVisible = state.syncVisible;
    const previousVisibleKind = state.syncVisibleKind;
    const changed = previousKind !== kind || state.syncMessage !== nextMessage;
    state.syncKind = kind;
    state.syncMessage = nextMessage;
    if (!changed) return;

    clearTimeout(state.syncDelayTimer);
    state.syncDelayTimer = null;

    if (Date.now() < state.syncSuppressUntil) {
      if (kind === 'connected') state.syncHadPendingState = false;
      removeToast(state.syncToast || document.getElementById('appSyncStatusToast'), 'sync');
      return;
    }

    if (kind === 'saving') {
      state.syncDelayTimer = setTimeout(() => {
        if (state.syncKind !== 'saving' || Date.now() < state.syncSuppressUntil) return;
        showSyncToast('saving', nextMessage, { persistent: true });
      }, SYNC_PROGRESS_DELAY);
      return;
    }

    if (kind === 'connected') {
      const recoveredFromProblem = state.syncHadPendingState || ['local', 'error'].includes(previousVisibleKind);
      const completedVisibleSave = previousVisible && previousVisibleKind === 'saving';
      const explicitReplay = /再送|保留/.test(nextMessage);
      state.syncHadPendingState = false;
      if (explicitReplay || recoveredFromProblem) {
        showSyncToast('connected', explicitReplay ? nextMessage : '保留していた変更を反映しました');
      } else if (completedVisibleSave) {
        showSyncToast('connected', nextMessage);
      } else {
        removeToast(state.syncToast, 'sync');
      }
      return;
    }

    if (kind === 'error') {
      const internalRetryState = /transaction|準備|初期化|support is required|保存を拒否|再送停止|outbox|retry/i.test(nextMessage)
        || window.__sanpoSyncWaitingForTransport;
      if (internalRetryState) {
        state.syncHadPendingState = false;
        removeToast(state.syncToast, 'sync');
        return;
      }
      const compatibilityProblem = /新版|未対応/.test(nextMessage);
      const permissionProblem = /permission[_ -]?denied|権限/i.test(nextMessage);
      const actualConnectionProblem = /network|offline|disconnected|通信|接続[^。]*(切|失|不可)|タイムアウト|timeout/i.test(nextMessage);
      if (!compatibilityProblem && !permissionProblem && !actualConnectionProblem) {
        removeToast(state.syncToast, 'sync');
        return;
      }
      state.syncHadPendingState = true;
      const copy = syncCopy(kind, nextMessage);
      showSyncToast(kind, nextMessage, { persistent: copy.tone === 'error' });
      return;
    }

    if (kind === 'local') {
      const actualConnectionProblem = /network|offline|disconnected|通信|接続[^。]*(切|失|不可)|タイムアウト|timeout/i.test(nextMessage);
      if (actualConnectionProblem) {
        state.syncHadPendingState = true;
        showSyncToast('local', nextMessage, { persistent: true });
      } else {
        removeToast(state.syncToast, 'sync');
      }
      return;
    }

    if (previousVisible) removeToast(state.syncToast, 'sync');
  }

  function showUndoBar(message, onUndo) {
    let bar = document.getElementById('appUndoBar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'appUndoBar';
      bar.innerHTML = '<span></span><cds-button type="button" kind="ghost" size="lg">元に戻す</cds-button>';
      document.body.appendChild(bar);
      bar.querySelector('cds-button').addEventListener('click', () => {
        const undoAction = bar.undoAction;
        bar.undoAction = null;
        hideUndoBar();
        if (typeof undoAction === 'function') undoAction();
      });
    }
    const span = bar.querySelector('span');
    span.textContent = message || '変更しました';
    state.undoAction = onUndo;
    bar.undoAction = onUndo;
    bar.classList.add('visible');
    clearTimeout(state.undoTimer);
    state.undoTimer = setTimeout(hideUndoBar, 9000);
  }

  function hideUndoBar() {
    const bar = document.getElementById('appUndoBar');
    if (bar) bar.classList.remove('visible');
  }

  document.addEventListener('click', event => {
    const quietInteraction = event.target?.closest?.(
      '#tray-handle, #app-view-navigation cds-tab, #app-view-navigation [role="tab"], [data-action="open-settlement-gas-settings"]'
    );
    if (quietInteraction) suppressSyncFeedback(1800);
  }, true);

  ensureNotificationRegion();
  window.AppUI = { confirm, alert, showStatus, setSyncStatus, suppressSyncFeedback, resumeSyncFeedback, showUndoBar, hideUndoBar };
  window.showAppNotice = (message, isError = false) => showStatus(message, { tone: isError ? 'error' : 'neutral' });
  window.showMiniToast = (message, tone = 'neutral') => showStatus(message, { tone, duration: DEFAULT_TOAST_DURATION });
})();