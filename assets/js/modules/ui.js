(function () {
  const state = {
    confirmModal: null,
    alertModal: null,
    undoTimer: null,
    undoAction: null,
    statusTimer: null,
    statusToast: null
  };

  const STATUS_NOTIFICATIONS = Object.freeze({
    success: Object.freeze({ kind: 'success', iconDescription: '成功' }),
    error: Object.freeze({ kind: 'error', iconDescription: 'エラー' }),
    warning: Object.freeze({ kind: 'warning', iconDescription: '警告' }),
    info: Object.freeze({ kind: 'info', iconDescription: '情報' }),
    neutral: Object.freeze({ kind: 'info', iconDescription: '情報' })
  });

  function ensureConfirmModal() {
    let el = document.getElementById('appConfirmModal');
    if (!el) {
      el = document.createElement('cds-modal');
      el.id = 'appConfirmModal';
      el.className = 'app-modal app-decision-modal';
      el.setAttribute('size', 'xs');
      el.setAttribute('aria-label', '確認');
      el.innerHTML = `
        <div class="modal-dialog modal-dialog-centered modal-sm">
          <div class="modal-content">
            <div class="modal-header py-2">
              <h6 class="modal-title mb-0" id="appConfirmModalTitle">確認</h6>
              <cds-modal-close-button data-modal-close close-button-label="閉じる"></cds-modal-close-button>
            </div>
            <div class="modal-body"><div class="app-decision-message"></div></div>
            <div class="modal-footer">
              <cds-button type="button" kind="secondary" size="lg" data-role="cancel">キャンセル</cds-button>
              <cds-button type="button" kind="primary" size="lg" data-role="ok">実行</cds-button>
            </div>
          </div>
        </div>`;
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
        <div class="modal-dialog modal-dialog-centered modal-sm">
          <div class="modal-content">
            <div class="modal-header py-2">
              <h6 class="modal-title mb-0" id="appAlertModalTitle">お知らせ</h6>
              <cds-modal-close-button data-modal-close close-button-label="閉じる"></cds-modal-close-button>
            </div>
            <div class="modal-body"><div class="app-decision-message"></div></div>
            <div class="modal-footer modal-footer--single">
              <cds-button type="button" kind="primary" size="lg" data-role="ok">OK</cds-button>
            </div>
          </div>
        </div>`;
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
    const title = el.querySelector('.modal-title');
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
      const finish = value => {
        if (done) return;
        done = true;
        ok.removeEventListener('click', onOk);
        cancel.removeEventListener('click', onCancel);
        el.removeEventListener('sanpo:modal-hidden', onHidden);
        resolve(value);
      };
      const onOk = () => { state.confirmModal.hide(); finish(true); };
      const onCancel = () => { state.confirmModal.hide(); finish(false); };
      const onHidden = () => finish(false);
      ok.addEventListener('click', onOk);
      cancel.addEventListener('click', onCancel);
      el.addEventListener('sanpo:modal-hidden', onHidden, { once: true });
      state.confirmModal.show();
    });
  }

  function alert(message, options = {}) {
    if (!window.AppModalAdapter) { window.alert(String(message || '')); return Promise.resolve(); }
    const el = ensureAlertModal();
    const title = el.querySelector('.modal-title');
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

  function removeStatusToast(toast) {
    if (!toast) return;
    toast.classList.remove('visible');
    toast.removeAttribute('open');
    toast.remove();
    if (state.statusToast !== toast) return;
    state.statusToast = null;
    if (state.statusTimer !== null) clearTimeout(state.statusTimer);
    state.statusTimer = null;
  }

  function createStatusToast(message, tone) {
    const notification = STATUS_NOTIFICATIONS[tone] || STATUS_NOTIFICATIONS.neutral;
    const { kind } = notification;
    const toast = document.createElement('cds-toast-notification');
    const subtitle = document.createElement('span');
    toast.id = 'appStatusToast';
    toast.className = 'app-status-toast';
    toast.dataset.tone = tone;
    toast.setAttribute('kind', kind);
    toast.setAttribute('open', '');
    toast.setAttribute('role', kind === 'error' ? 'alert' : 'status');
    toast.setAttribute('aria-live', kind === 'error' ? 'assertive' : 'polite');
    toast.setAttribute('aria-atomic', 'true');
    toast.ariaLabel = '通知を閉じる';
    toast.setAttribute('status-icon-description', notification.iconDescription);
    subtitle.slot = 'subtitle';
    subtitle.textContent = String(message);
    toast.appendChild(subtitle);
    toast.addEventListener('cds-notification-closed', () => removeStatusToast(toast), { once: true });
    document.body.appendChild(toast);
    return toast;
  }

  function showStatus(message, options = {}) {
    if (!message) return;
    const requestedTone = String(options.tone || 'neutral').toLowerCase();
    const tone = STATUS_NOTIFICATIONS[requestedTone] ? requestedTone : 'neutral';
    const duration = Number.isFinite(options.duration) ? Math.max(800, options.duration) : 2200;
    removeStatusToast(state.statusToast || document.getElementById('appStatusToast'));
    const toast = createStatusToast(message, tone);
    state.statusToast = toast;
    requestAnimationFrame(() => {
      if (state.statusToast !== toast || !toast.isConnected) return;
      toast.classList.add('visible');
    });
    state.statusTimer = setTimeout(() => removeStatusToast(toast), duration);
  }

  function setSyncStatus(kind = 'neutral', message = '') {
    const badge = document.getElementById('syncStatusBadge');
    if (!badge) return;
    const label = badge.querySelector('.sync-status-label');
    badge.dataset.status = kind;
    if (label) label.textContent = message || '保存済み';
    badge.classList.add('is-visible');
    clearTimeout(state.syncStatusTimer);
    state.syncStatusTimer = setTimeout(() => {
      if (!badge.matches(':hover, :focus-within')) badge.classList.remove('is-visible');
    }, 1700);
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
    // Store the current action on the persistent node as well. This keeps the
    // handler correct if the browser restores the DOM while modules re-run.
    bar.undoAction = onUndo;
    bar.classList.add('visible');
    clearTimeout(state.undoTimer);
    state.undoTimer = setTimeout(hideUndoBar, 9000);
  }

  function hideUndoBar() {
    const bar = document.getElementById('appUndoBar');
    if (bar) bar.classList.remove('visible');
  }

  window.AppUI = { confirm, alert, showStatus, setSyncStatus, showUndoBar, hideUndoBar };
  window.showAppNotice = (message, isError = false) => showStatus(message, { tone: isError ? 'error' : 'neutral' });
  window.showMiniToast = (message, tone = 'neutral') => showStatus(message, { tone, duration: 1800 });
})();
