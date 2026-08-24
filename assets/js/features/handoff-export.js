// Organizer-only handoff CSV export for managed Google Form projects.
// The capability token is received once in the launch URL, stored only on this device,
// and stripped immediately so ordinary project share links never include it.
(() => {
  'use strict';

  const ENDPOINT = 'https://script.google.com/macros/s/AKfycbw0R5VgBdSLS8aRDJDw7GUIEfHlXRZ6rPrOgjXmO2N7LvhuoGyS_opUCFTCSiUiDZw5/exec';
  const TOKEN_PARAM = 'handoff';
  const TOKEN_STORAGE_PREFIX = 'SANPO_HANDOFF_EXPORT_TOKEN_V1:';
  const APPLICATION_KIND = 'formApplicationSync';
  const APPLICATION_VERSION = 2;
  const JSONP_TIMEOUT_MS = 20000;
  let sessionToken = '';
  let exportInFlight = false;
  let observer = null;

  const byId = id => document.getElementById(id);

  function currentProjectId() {
    return String(new URL(window.location.href).searchParams.get('room') || '').trim();
  }

  function tokenStorageKey(projectId = currentProjectId()) {
    return `${TOKEN_STORAGE_PREFIX}${projectId}`;
  }

  function validToken(value) {
    return /^h_[A-Za-z0-9_-]{48,160}$/.test(String(value || ''));
  }

  function captureLaunchToken() {
    const url = new URL(window.location.href);
    const token = String(url.searchParams.get(TOKEN_PARAM) || '');
    const projectId = String(url.searchParams.get('room') || '');
    if (!projectId || !validToken(token)) return;

    sessionToken = token;
    try {
      window.localStorage.setItem(tokenStorageKey(projectId), token);
    } catch (_) {
      // Safari private storage can fail. Keep the token for this page session instead.
    }

    url.searchParams.delete(TOKEN_PARAM);
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  }

  function storedToken() {
    if (validToken(sessionToken)) return sessionToken;
    try {
      const value = window.localStorage.getItem(tokenStorageKey()) || '';
      return validToken(value) ? value : '';
    } catch (_) {
      return '';
    }
  }

  function canonical() {
    return window.SanpoCanonicalState?.get?.() || null;
  }

  function applicationSync(room = canonical()) {
    const sync = room?.meta?.applicationSync;
    return sync?.kind === APPLICATION_KIND && Number(sync.version || 0) === APPLICATION_VERSION ? sync : null;
  }

  function normalizedName(value) {
    return String(value || '').normalize('NFKC').replace(/[\s\u3000]+/g, '').toLocaleLowerCase('ja');
  }

  function committedExportSelection() {
    const room = canonical();
    const sync = applicationSync(room);
    if (!room || !sync) return { responseKeys: [], manualNames: [], ambiguousNames: [] };

    const applicantsByName = new Map();
    Object.entries(sync.applicants || {}).forEach(([responseKey, applicant]) => {
      const key = normalizedName(applicant?.name);
      if (!key) return;
      const entries = applicantsByName.get(key) || [];
      entries.push({ responseKey, applicant });
      applicantsByName.set(key, entries);
    });

    const responseKeys = [];
    const manualNames = [];
    const ambiguousNames = [];
    Object.values(room.participants || {}).forEach(participant => {
      const name = String(participant?.name || '').trim();
      if (!name) return;
      const candidates = applicantsByName.get(normalizedName(name)) || [];
      if (candidates.length === 1) {
        responseKeys.push(candidates[0].responseKey);
      } else if (candidates.length > 1) {
        // The current planning state intentionally contains no student number or response
        // identity. Never guess which same-name applicant was accepted: exporting both
        // could disclose another applicant's student number.
        ambiguousNames.push(name);
      } else {
        manualNames.push(name);
      }
    });

    return { responseKeys, manualNames, ambiguousNames };
  }

  function hasPendingSelection() {
    const apply = byId('formApplicantApplyBtn');
    if (!apply || applicationSync() === null) return false;
    return !apply.disabled && !apply.hasAttribute('disabled');
  }

  function availability() {
    const sync = applicationSync();
    const token = storedToken();
    const participantCount = Object.keys(canonical()?.participants || {}).length;
    if (!sync) return { enabled: false, reason: '応募フォームと自動連携した企画で利用できます。' };
    if (!token) {
      return {
        enabled: false,
        reason: 'この端末には作成権限がありません。応募フォーム作成後に表示される「この企画をサークル企画ツールで開く」から開いた端末で作成できます。'
      };
    }
    if (hasPendingSelection()) return { enabled: false, reason: '参加者の変更を保存してから作成できます。' };
    if (!participantCount) return { enabled: false, reason: '参加者を確定してから作成できます。' };
    const selection = committedExportSelection();
    if (selection.ambiguousNames.length) {
      return { enabled: false, reason: `同名の応募者（${selection.ambiguousNames.join('・')}）を安全に判別できないため作成できません。` };
    }
    return { enabled: true, reason: '学務提出書類作成ツールに読み込む引き継ぎデータを作成します。' };
  }

  function ensureExportButton() {
    const toolbar = byId('participantsSelectionToolbar');
    if (!toolbar) return null;
    let button = byId('handoffExportBtn');
    if (!button) {
      button = document.createElement('cds-button');
      button.id = 'handoffExportBtn';
      button.className = 'handoff-export-button';
      button.setAttribute('kind', 'ghost');
      button.setAttribute('size', 'lg');
      button.setAttribute('type', 'button');
      button.textContent = '引き継ぎデータを作成';
      const filter = byId('participantsFilterToggle');
      toolbar.insertBefore(button, filter || null);
      button.addEventListener('click', () => void exportHandoff());
    }
    return button;
  }

  function updateExportButton() {
    const button = ensureExportButton();
    if (!button) return false;
    const state = availability();
    const disabled = exportInFlight || !state.enabled;
    button.disabled = disabled;
    button.toggleAttribute('disabled', disabled);
    button.setAttribute('title', exportInFlight ? '引き継ぎデータを作成しています。' : state.reason);
    button.setAttribute('aria-label', exportInFlight ? '引き継ぎデータを作成中' : `引き継ぎデータを作成。${state.reason}`);
    const label = exportInFlight ? '作成中…' : '引き継ぎデータを作成';
    if (button.textContent !== label) button.textContent = label;

    const reason = byId('handoffExportReason');
    if (reason) {
      const showReason = !exportInFlight && !state.enabled;
      if (reason.textContent !== state.reason) reason.textContent = state.reason;
      reason.hidden = !showReason;
    }
    return true;
  }

  function setStatus(message, tone = 'info') {
    const status = byId('formApplicantStatus');
    if (status && status.textContent !== String(message || '')) status.textContent = String(message || '');
    if (message) window.AppUI?.showStatus?.(String(message), { tone });
  }

  function jsonpRequest(params) {
    return new Promise((resolve, reject) => {
      const callback = `__sanpoHandoff_${Date.now()}_${Math.random().toString(36).slice(2)}`.replace(/[^A-Za-z0-9_$]/g, '_');
      const script = document.createElement('script');
      let settled = false;
      let timeoutId = 0;

      const cleanup = () => {
        script.remove();
        try { delete window[callback]; } catch (_) { window[callback] = undefined; }
      };
      const finish = (handler, value) => {
        if (settled) return;
        settled = true;
        if (timeoutId) window.clearTimeout(timeoutId);
        cleanup();
        handler(value);
      };

      window[callback] = payload => finish(resolve, payload);
      script.onerror = () => finish(reject, new Error('引き継ぎデータの作成先へ接続できませんでした。'));

      const url = new URL(ENDPOINT);
      Object.entries({ ...params, callback, _: Date.now() }).forEach(([key, value]) => url.searchParams.set(key, String(value)));
      if (url.toString().length > 7800) {
        cleanup();
        reject(new Error('参加者データが大きすぎるため書き出せません。参加者数を確認してください。'));
        return;
      }
      script.src = url.toString();
      script.async = true;
      timeoutId = window.setTimeout(() => finish(reject, new Error('引き継ぎデータの作成がタイムアウトしました。')), JSONP_TIMEOUT_MS);
      document.head.appendChild(script);
    });
  }

  function csvCell(value) {
    return `"${String(value ?? '').replace(/"/g, '""')}"`;
  }

  function downloadParticipantCsv(filename, participants) {
    const rows = [['学籍番号', '氏名']].concat(
      participants.map(person => [String(person?.studentId || ''), String(person?.name || '')])
    );
    const csv = '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = String(filename || '参加者.csv');
    anchor.rel = 'noopener';
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);
  }

  async function exportHandoff() {
    if (exportInFlight) return;
    const state = availability();
    if (!state.enabled) {
      setStatus(state.reason, 'warning');
      updateExportButton();
      return;
    }

    const projectId = currentProjectId();
    const token = storedToken();
    const selection = committedExportSelection();
    if (selection.ambiguousNames.length) {
      setStatus(`同名の応募者（${selection.ambiguousNames.join('・')}）を安全に判別できないため作成できません。`, 'error');
      return;
    }
    if (!projectId || (!selection.responseKeys.length && !selection.manualNames.length)) {
      setStatus('参加者を確定してから作成してください。', 'warning');
      return;
    }

    exportInFlight = true;
    updateExportButton();
    setStatus('引き継ぎデータを作成しています…');
    try {
      let formParticipants = [];
      let filename = `${String(applicationSync()?.title || '企画').replace(/[\\/:*?"<>|]/g, '_')}_参加者.csv`;
      if (selection.responseKeys.length) {
        const payload = await jsonpRequest({
          action: 'handoff-export',
          projectId,
          token,
          responses: selection.responseKeys.join(',')
        });
        if (!payload?.ok) throw new Error(payload?.error || '引き継ぎデータを作成できませんでした。');
        if (!Array.isArray(payload.participants)) throw new Error('参加者データを読み取れませんでした。');
        formParticipants = payload.participants;
        filename = payload.filename || filename;
      }

      const participants = formParticipants.concat(
        selection.manualNames.map(name => ({ studentId: '', name }))
      );
      if (!participants.length) throw new Error('参加者データが空です。');
      downloadParticipantCsv(filename, participants);
      setStatus(`${participants.length}人の引き継ぎデータを作成しました。`, 'success');
    } catch (error) {
      setStatus(error?.message || '引き継ぎデータを作成できませんでした。', 'error');
    } finally {
      exportInFlight = false;
      updateExportButton();
    }
  }

  function installObserver() {
    if (observer) return;
    observer = new MutationObserver(() => queueMicrotask(updateExportButton));
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['disabled']
    });
    window.addEventListener('sanpo:canonical-room-changed', updateExportButton);
  }

  function start() {
    captureLaunchToken();
    updateExportButton();
    installObserver();
    const timer = window.setInterval(() => {
      if (!updateExportButton()) return;
      window.clearInterval(timer);
    }, 150);
  }

  window.SanpoHandoffExport = Object.freeze({
    export: exportHandoff,
    refresh: updateExportButton,
    hasCapability: () => Boolean(storedToken())
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
