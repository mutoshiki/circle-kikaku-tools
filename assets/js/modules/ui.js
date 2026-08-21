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
    syncHadPendingState: false
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
    toast.setAttribute('title', title);
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
      return { title: '保存しています', subtitle: '変更内容を共有データへ保存しています。', tone: 'info' };
    }
    if (kind === 'connected') {
      if (/再送|保留/.test(raw)) {
        return { title: '保存を再開しました', subtitle: '保留していた変更を保存しました。', tone: 'success' };
      }
      return { title: '保存しました', subtitle: '変更内容は最新の状態です。', tone: 'success' };
    }
    if (kind === 'local') {
      if (/保留|入力中|編集中|再試行|通信|同期中/.test(raw)) {
        return { title: '変更を一時的に保留しています', subtitle: '操作が終わるか接続が戻ると、自動で同期します。', tone: 'warning' };
      }
      return { title: 'この端末に保存しました', subtitle: '共有先にはまだ送信していません。', tone: 'info' };
    }
    if (kind === 'error') {
      if (/新版|未対応/.test(raw)) {
        return { title: 'この共有データを開けません', subtitle: 'アプリを更新してから、もう一度開いてください。', tone: 'error' };
      }
      if (/拒否|権限|permission/i.test(raw)) {
        return { title: 'この変更を保存できません', subtitle: '共有リンクの編集権限を確認してください。', tone: 'error' };
      }
      if (/transaction|準備|初期化/i.test(raw) || window.__sanpoSyncWaitingForTransport) {
        return { title: '同期の準備をしています', subtitle: '準備が整い次第、変更を自動で保存します。', tone: 'warning' };
      }
      return { title: '変更を保存できませんでした', subtitle: '接続を確認すると、自動で再試行します。', tone: 'error' };
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

    if (kind === 'saving') {
      state.syncDelayTimer = setTimeout(() => {
        if (state.syncKind !== 'saving') return;
        showSyncToast('saving', nextMessage, { persistent: true });
      }, SYNC_PROGRESS_DELAY);
      return;
    }

    if (kind === 'connected') {
      const recoveredFromProblem = state.syncHadPendingState || ['local', 'error'].includes(previousKind) || ['local', 'error'].includes(previousVisibleKind);
      const explicitReplay = /再送|保留/.test(nextMessage);
      state.syncHadPendingState = false;
      // A routine autosave can be triggered by navigation, opening a settings modal, or a
      // no-op projection update. Do not announce those. Success is only useful after an
      // actual pending/error state or an explicit replay of queued changes.
      if (recoveredFromProblem || explicitReplay) {
        showSyncToast('connected', explicitReplay ? nextMessage : '保留していた変更を再送しました');
      } else {
        removeToast(state.syncToast, 'sync');
      }
      return;
    }

    if (kind === 'error') {
      state.syncHadPendingState = true;
      const copy = syncCopy(kind, nextMessage);
      showSyncToast(kind, nextMessage, { persistent: copy.tone === 'error' });
      return;
    }

    if (kind === 'local') {
      const isDeferred = /保留|入力中|編集中|再試行|通信|同期中/.test(nextMessage);
      if (isDeferred) {
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

  ensureNotificationRegion();
  window.AppUI = { confirm, alert, showStatus, setSyncStatus, showUndoBar, hideUndoBar };
  window.showAppNotice = (message, isError = false) => showStatus(message, { tone: isError ? 'error' : 'neutral' });
  window.showMiniToast = (message, tone = 'neutral') => showStatus(message, { tone, duration: DEFAULT_TOAST_DURATION });
})();
