(function () {
  const state = { confirmModal: null, alertModal: null, undoTimer: null, undoAction: null, statusTimer: null };

  function ensureConfirmModal() {
    let el = document.getElementById('appConfirmModal');
    if (!el) {
      el = document.createElement('div');
      el.id = 'appConfirmModal';
      el.className = 'modal fade app-decision-modal';
      el.tabIndex = -1;
      el.setAttribute('role', 'dialog');
      el.setAttribute('aria-modal', 'true');
      el.setAttribute('aria-labelledby', 'appConfirmModalTitle');
      el.innerHTML = `
        <div class="modal-dialog modal-dialog-centered modal-sm">
          <div class="modal-content">
            <div class="modal-header py-2">
              <h6 class="modal-title mb-0" id="appConfirmModalTitle">確認</h6>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="閉じる"></button>
            </div>
            <div class="modal-body"><div class="app-decision-message"></div></div>
            <div class="modal-footer py-2">
              <button type="button" class="btn btn-outline-secondary btn-sm" data-role="cancel">キャンセル</button>
              <button type="button" class="btn btn-primary btn-sm " data-role="ok">実行</button>
            </div>
          </div>
        </div>`;
      document.body.appendChild(el);
    }
    if (!state.confirmModal && window.bootstrap) state.confirmModal = new bootstrap.Modal(el);
    return el;
  }

  function ensureAlertModal() {
    let el = document.getElementById('appAlertModal');
    if (!el) {
      el = document.createElement('div');
      el.id = 'appAlertModal';
      el.className = 'modal fade app-decision-modal';
      el.tabIndex = -1;
      el.setAttribute('role', 'dialog');
      el.setAttribute('aria-modal', 'true');
      el.setAttribute('aria-labelledby', 'appAlertModalTitle');
      el.innerHTML = `
        <div class="modal-dialog modal-dialog-centered modal-sm">
          <div class="modal-content">
            <div class="modal-header py-2">
              <h6 class="modal-title mb-0" id="appAlertModalTitle">お知らせ</h6>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="閉じる"></button>
            </div>
            <div class="modal-body"><div class="app-decision-message"></div></div>
            <div class="modal-footer py-2">
              <button type="button" class="btn btn-primary btn-sm " data-role="ok">OK</button>
            </div>
          </div>
        </div>`;
      document.body.appendChild(el);
    }
    if (!state.alertModal && window.bootstrap) state.alertModal = new bootstrap.Modal(el);
    return el;
  }

  function setMessage(el, selector, message) {
    const box = el.querySelector(selector);
    if (box) box.textContent = String(message || '');
  }

  function confirm(message, options = {}) {
    if (!window.bootstrap) return Promise.resolve(window.confirm(String(message || '')));
    const el = ensureConfirmModal();
    const title = el.querySelector('.modal-title');
    const ok = el.querySelector('[data-role="ok"]');
    const cancel = el.querySelector('[data-role="cancel"]');
    title.textContent = options.title || '確認';
    ok.textContent = options.okText || '実行';
    cancel.textContent = options.cancelText || 'キャンセル';
    ok.className = `btn btn-sm ${options.danger ? 'btn-danger' : 'btn-primary'}`;
    setMessage(el, '.app-decision-message', message);

    return new Promise(resolve => {
      let done = false;
      const finish = value => {
        if (done) return;
        done = true;
        ok.removeEventListener('click', onOk);
        cancel.removeEventListener('click', onCancel);
        el.removeEventListener('hidden.bs.modal', onHidden);
        resolve(value);
      };
      const onOk = () => { state.confirmModal.hide(); finish(true); };
      const onCancel = () => { state.confirmModal.hide(); finish(false); };
      const onHidden = () => finish(false);
      ok.addEventListener('click', onOk);
      cancel.addEventListener('click', onCancel);
      el.addEventListener('hidden.bs.modal', onHidden, { once: true });
      state.confirmModal.show();
    });
  }

  function alert(message, options = {}) {
    if (!window.bootstrap) { window.alert(String(message || '')); return Promise.resolve(); }
    const el = ensureAlertModal();
    const title = el.querySelector('.modal-title');
    const ok = el.querySelector('[data-role="ok"]');
    title.textContent = options.title || 'お知らせ';
    ok.textContent = options.okText || 'OK';
    setMessage(el, '.app-decision-message', message);

    return new Promise(resolve => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        ok.removeEventListener('click', onOk);
        el.removeEventListener('hidden.bs.modal', onHidden);
        resolve();
      };
      const onOk = () => { state.alertModal.hide(); finish(); };
      const onHidden = () => finish();
      ok.addEventListener('click', onOk);
      el.addEventListener('hidden.bs.modal', onHidden, { once: true });
      state.alertModal.show();
    });
  }

  function ensureStatusToast() {
    let toast = document.getElementById('appStatusToast');
    if (toast) return toast;
    toast = document.createElement('div');
    toast.id = 'appStatusToast';
    toast.className = 'app-status-toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.setAttribute('aria-atomic', 'true');
    document.body.appendChild(toast);
    return toast;
  }

  function showStatus(message, options = {}) {
    if (!message) return;
    const toast = ensureStatusToast();
    const tone = options.tone === 'error' ? 'error' : options.tone === 'success' ? 'success' : 'neutral';
    const duration = Number.isFinite(options.duration) ? Math.max(800, options.duration) : 2200;
    toast.dataset.tone = tone;
    toast.setAttribute('role', tone === 'error' ? 'alert' : 'status');
    toast.setAttribute('aria-live', tone === 'error' ? 'assertive' : 'polite');
    toast.classList.remove('visible');
    toast.textContent = '';
    requestAnimationFrame(() => {
      toast.textContent = String(message);
      toast.classList.add('visible');
    });
    clearTimeout(state.statusTimer);
    state.statusTimer = setTimeout(() => toast.classList.remove('visible'), duration);
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
      bar.innerHTML = '<span></span><button type="button">元に戻す</button>';
      document.body.appendChild(bar);
      bar.querySelector('button').addEventListener('click', () => {
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
