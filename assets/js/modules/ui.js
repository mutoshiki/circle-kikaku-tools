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
    syncVisible: false
  };

  const STATUS_NOTIFICATIONS = Object.freeze({
    success: Object.freeze({ kind: 'success', iconDescription: '成功' }),
    error: Object.freeze({ kind: 'error', iconDescription: 'エラー' }),
    warning: Object.freeze({ kind: 'warning', iconDescription: '警告' }),
    info: Object.freeze({ kind: 'info', iconDescription: '情報' }),
    neutral: Object.freeze({ kind: 'info', iconDescription: '情報' })
  });
  const DEFAULT_TOAST_DURATION = 5000;
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
      clearTimeout(state.syncTimer);
      state.syncTimer = null;
    }
  }

  function createStatusToast(message, tone, slot = 'status') {
    const notification = STATUS_NOTIFICATIONS[tone] || STATUS_NOTIFICATIONS.neutral;
    const toast = document.createElement('cds-toast-notification');
    const subtitle = document.createElement('span');
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
    toast.setAttribute('title', slot === 'sync' ? '保存と同期' : 'お知らせ');
    const title = document.createElement('span');
    title.slot = 'title';
    title.textContent = slot === 'sync' ? '保存と同期' : 'お知らせ';
    subtitle.slot = 'subtitle';
    subtitle.textContent = String(message);
    toast.append(title, subtitle);
    toast.addEventListener('cds-notification-closed', () => removeToast(toast, slot), { once: true });
    ensureNotificationRegion().prepend(toast);
    requestAnimationFrame(() => {
      if (toast.isConnected) toast.classList.add('visible');
    });
    return toast;
  }

  function showStatus(message, options = {}) {
    if (!message) return;
    const requestedTone = String(options.tone || 'neutral').toLowerCase();
    const tone = STATUS_NOTIFICATIONS[requestedTone] ? requestedTone : 'neutral';
    const duration = Number.isFinite(options.duration) ? Math.max(800, options.duration) : DEFAULT_TOAST_DURATION;
    removeToast(state.statusToast || document.getElementById('appStatusToast'), 'status');
    const toast = createStatusToast(message, tone, 'status');
    state.statusToast = toast;
    state.statusTimer = setTimeout(() => removeToast(toast, 'status'), duration);
  }

  function syncTone(kind, message) {
    if (kind === 'error') return 'error';
    if (kind === 'connected') return 'success';
    if (String(message).includes('保留')) return 'warning';
    return 'info';
  }

  function showSyncToast(kind, message, { persistent = false } = {}) {
    removeToast(state.syncToast || document.getElementById('appSyncStatusToast'), 'sync');
    const toast = createStatusToast(message, syncTone(kind, message), 'sync');
    state.syncToast = toast;
    state.syncVisible = true;
    if (!persistent) state.syncTimer = setTimeout(() => removeToast(toast, 'sync'), DEFAULT_TOAST_DURATION);
  }

  function setSyncStatus(kind = 'neutral', message = '') {
    ensureNotificationRegion();
    const nextMessage = String(message || '保存済み');
    const previousKind = state.syncKind;
    const previousVisible = state.syncVisible;
    const changed = previousKind !== kind || state.syncMessage !== nextMessage;
    state.syncKind = kind;
    state.syncMessage = nextMessage;
    if (!changed) return;

    clearTimeout(state.syncDelayTimer);
    state.syncDelayTimer = null;

    if (kind === 'saving') {
      // Routine saves are usually shorter than a perceptible notification. Carbon warns
      // against excessive notifications, so only surface progress when it lasts long enough.
      state.syncDelayTimer = setTimeout(() => {
        if (state.syncKind !== 'saving') return;
        showSyncToast('saving', nextMessage, { persistent: true });
      }, SYNC_PROGRESS_DELAY);
      return;
    }

    if (kind === 'connected') {
      // Do not announce every fast autosave. Completion is useful only when progress was
      // actually visible or the app is recovering from a non-connected state.
      if (previousVisible || ['error', 'local', 'saving'].includes(previousKind) && previousKind !== 'saving') {
        showSyncToast('connected', nextMessage);
      } else {
        removeToast(state.syncToast, 'sync');
      }
      return;
    }

    if (kind === 'error') {
      showSyncToast('error', nextMessage, { persistent: true });
      return;
    }

    if (kind === 'local') {
      const isDeferred = /保留|同期中/.test(nextMessage);
      showSyncToast('local', nextMessage, { persistent: isDeferred });
      return;
    }

    removeToast(state.syncToast, 'sync');
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

  ensureNotificationRegion();
  window.AppUI = { confirm, alert, showStatus, setSyncStatus, showUndoBar, hideUndoBar };
  window.showAppNotice = (message, isError = false) => showStatus(message, { tone: isError ? 'error' : 'neutral' });
  window.showMiniToast = (message, tone = 'neutral') => showStatus(message, { tone, duration: DEFAULT_TOAST_DURATION });
})();
