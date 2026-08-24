// Participant announcement text generator for managed-form projects.
(() => {
  'use strict';

  const APPLICATION_KIND = 'formApplicationSync';
  const APPLICATION_VERSION = 2;
  const FIXED_MEETING_PLACE = 'サークルボックス前';
  let modalAdapter = null;
  let observer = null;

  const byId = id => document.getElementById(id);

  function canonical() {
    return window.SanpoCanonicalState?.get?.() || null;
  }

  function applicationSync(room = canonical()) {
    const sync = room?.meta?.applicationSync;
    return sync?.kind === APPLICATION_KIND && Number(sync.version || 0) === APPLICATION_VERSION ? sync : null;
  }

  function hasPendingSelection() {
    const apply = byId('formApplicantApplyBtn');
    if (!apply || !applicationSync()) return false;
    return !apply.disabled && !apply.hasAttribute('disabled');
  }

  function availability() {
    const room = canonical();
    const sync = applicationSync(room);
    const participantCount = Object.keys(room?.participants || {}).length;
    if (!sync) return { visible: false, enabled: false, reason: '' };
    if (!participantCount) return { visible: false, enabled: false, reason: '参加者を確定してから作成できます。' };
    if (hasPendingSelection()) return { visible: true, enabled: false, reason: '参加者を更新してから作成できます。' };
    return { visible: true, enabled: true, reason: '確定した参加者から発表文を作成します。' };
  }

  function normalizedName(value) {
    return String(value || '').normalize('NFKC').replace(/[\s\u3000]+/g, '').toLocaleLowerCase('ja');
  }

  function applicantByName(sync) {
    const map = new Map();
    Object.values(sync?.applicants || {}).forEach(applicant => {
      const key = normalizedName(applicant?.name);
      if (!key) return;
      const entries = map.get(key) || [];
      entries.push(applicant);
      map.set(key, entries);
    });
    return map;
  }

  function committedParticipants() {
    const room = canonical();
    const sync = applicationSync(room);
    if (!room || !sync) return [];
    const applicants = applicantByName(sync);
    return Object.values(room.participants || {})
      .map(participant => {
        const candidates = applicants.get(normalizedName(participant?.name)) || [];
        const applicant = candidates[0] || null;
        return {
          name: String(participant?.name || '').trim(),
          grade: Math.max(0, Math.min(4, parseInt(participant?.grade ?? applicant?.grade, 10) || 0)),
          canDrive: candidates.some(item => Boolean(item?.canDrive))
        };
      })
      .filter(person => person.name)
      .sort((a, b) => (b.grade - a.grade) || a.name.localeCompare(b.name, 'ja'));
  }

  function formatEventDate(value) {
    const text = String(value || '').trim();
    const match = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(text);
    if (!match) return text;
    return `${Number(match[2])}月${Number(match[3])}日`;
  }

  function planLabel() {
    const room = canonical();
    const sync = applicationSync(room);
    const title = String(sync?.title || room?.roomName || '').trim() || '企画';
    return /企画$/.test(title) ? title : `${title}企画`;
  }

  function participantLines(people) {
    const lines = [];
    [4, 3, 2, 1].forEach(grade => {
      const members = people.filter(person => person.grade === grade);
      if (!members.length) return;
      lines.push(`${grade}年`);
      lines.push(members.map(person => `${person.canDrive ? '○' : ''}${person.name}`).join('   '));
      lines.push('');
    });
    const unknown = people.filter(person => !person.grade);
    if (unknown.length) {
      lines.push('その他');
      lines.push(unknown.map(person => `${person.canDrive ? '○' : ''}${person.name}`).join('   '));
      lines.push('');
    }
    return lines;
  }

  function fieldValue(id) {
    return String(byId(id)?.value || '').trim();
  }

  function buildAnnouncement() {
    const room = canonical();
    const sync = applicationSync(room);
    const people = committedParticipants();
    const meetTime = fieldValue('participantAnnouncementMeetTime');
    const opening = fieldValue('participantAnnouncementOpening');
    const weather = fieldValue('participantAnnouncementWeather');
    const schedule = fieldValue('participantAnnouncementSchedule');
    const notes = fieldValue('participantAnnouncementNotes');
    const contact = fieldValue('participantAnnouncementContact');
    const date = formatEventDate(sync?.eventDate);
    const allAccepted = people.length > 0 && Number(sync?.responseCount || 0) > 0 && people.length === Number(sync.responseCount);
    const lines = ['皆様、お疲れ様です！'];

    if (opening) lines.push('', opening);
    lines.push('', `以前募集した${date ? `${date} ` : ''}${planLabel()}の参加者を発表します。`);
    if (allAccepted) {
      lines.push('今回は応募した方全員が参加出来ることになりました。沢山のご応募ありがとうございました！');
    } else {
      lines.push('沢山のご応募ありがとうございました！');
    }
    if (weather) lines.push(weather);

    lines.push('', '【参加者発表】※敬称略  ○は車出し', '');
    lines.push(...participantLines(people));
    lines.push(`以上${people.length}名になります`);

    if (meetTime) {
      lines.push('', `当日の集合時間は${meetTime}です。`, `集合場所は${FIXED_MEETING_PLACE}です。`, '遅れないようによろしくお願いします！');
    }

    if (schedule) lines.push('', '～ざっくり予定～', schedule);
    if (notes) lines.push('', notes);
    if (contact) lines.push('', 'なにか質問ありましたら', `${contact} までお願いします。`);

    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  function ensureModal() {
    let modal = byId('participantAnnouncementModal');
    if (modal) return modal;

    modal = document.createElement('cds-modal');
    modal.id = 'participantAnnouncementModal';
    modal.className = 'app-modal app-modal--wide app-modal--scroll participant-announcement-modal';
    modal.setAttribute('size', 'lg');
    modal.setAttribute('has-scrolling-content', '');
    modal.setAttribute('aria-label', '参加者発表文を作成');
    modal.innerHTML = `
      <cds-modal-header>
        <cds-modal-heading data-modal-primary-focus id="participantAnnouncementModalTitle" class="app-modal-heading" tabindex="-1">参加者発表文を作成</cds-modal-heading>
        <cds-modal-close-button data-modal-close close-button-label="閉じる"></cds-modal-close-button>
      </cds-modal-header>
      <cds-modal-body class="app-modal-body participant-announcement-body" no-fade>
        <div class="participant-announcement-layout">
          <section class="participant-announcement-fields" aria-label="発表文の入力">
            <cds-text-input id="participantAnnouncementMeetTime" type="time" size="lg" label="集合時間" required></cds-text-input>
            <div class="participant-announcement-fixed-field">
              <span class="participant-announcement-fixed-label">集合場所</span>
              <strong>${FIXED_MEETING_PLACE}</strong>
            </div>
            <cds-textarea id="participantAnnouncementOpening" rows="2" label="冒頭のひとこと（任意）" placeholder="例：なんだか眠くてたまらない秋山です。"></cds-textarea>
            <cds-textarea id="participantAnnouncementWeather" rows="2" label="天候不良時の対応（任意）" placeholder="例：当日の天気が悪い場合は中止か別の企画になることをご了承ください。"></cds-textarea>
            <cds-textarea id="participantAnnouncementSchedule" rows="7" label="ざっくり予定（任意）" placeholder="例：西友で買い物、移動\n↓\n9:00 登山開始\n↓\n温泉、晩ごはん"></cds-textarea>
            <cds-textarea id="participantAnnouncementNotes" rows="3" label="持ち物・補足（任意）" placeholder="例：着替えやタオル、お金の用意をお願いします。"></cds-textarea>
            <cds-text-input id="participantAnnouncementContact" type="text" size="lg" label="連絡先（任意）" placeholder="例：25f3003j@shinshu-u.ac.jp"></cds-text-input>
          </section>
          <section class="participant-announcement-preview" aria-labelledby="participantAnnouncementPreviewTitle">
            <h4 id="participantAnnouncementPreviewTitle">プレビュー</h4>
            <pre id="participantAnnouncementPreview" aria-live="polite"></pre>
          </section>
        </div>
      </cds-modal-body>
      <cds-modal-footer class="app-modal-footer">
        <cds-modal-footer-button data-modal-close kind="secondary" type="button">閉じる</cds-modal-footer-button>
        <cds-modal-footer-button id="participantAnnouncementCopyBtn" kind="primary" type="button" disabled>発表文をコピー</cds-modal-footer-button>
      </cds-modal-footer>`;
    document.body.appendChild(modal);

    modal.querySelectorAll('cds-text-input, cds-textarea').forEach(control => {
      control.addEventListener('input', updatePreview);
      control.addEventListener('change', updatePreview);
    });
    byId('participantAnnouncementCopyBtn')?.addEventListener('click', () => void copyAnnouncement());
    return modal;
  }

  function updatePreview() {
    const preview = byId('participantAnnouncementPreview');
    const text = buildAnnouncement();
    if (preview && preview.textContent !== text) preview.textContent = text;
    const meetTime = fieldValue('participantAnnouncementMeetTime');
    const meetInput = byId('participantAnnouncementMeetTime');
    const copy = byId('participantAnnouncementCopyBtn');
    const invalid = !meetTime;
    if (meetInput) {
      meetInput.toggleAttribute('invalid', invalid);
      if (invalid) meetInput.setAttribute('invalid-text', '集合時間は必須です。');
      else meetInput.removeAttribute('invalid-text');
    }
    if (copy) {
      const alreadyDisabled = copy.disabled || copy.hasAttribute('disabled');
      if (alreadyDisabled !== invalid) copy.disabled = invalid;
      copy.toggleAttribute('disabled', invalid);
    }
  }

  function openModal() {
    const state = availability();
    if (!state.enabled) {
      if (state.reason) window.AppUI?.showStatus?.(state.reason, { tone: 'warning' });
      refreshAction();
      return;
    }
    const modal = ensureModal();
    updatePreview();
    if (!modalAdapter && window.AppModalAdapter) modalAdapter = window.AppModalAdapter.getOrCreateInstance(modal);
    if (modalAdapter) modalAdapter.show();
    else modal.setAttribute('open', '');
  }

  async function copyText(text) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    textarea.remove();
    if (!ok) throw new Error('コピーできませんでした。');
  }

  async function copyAnnouncement() {
    const meetTime = fieldValue('participantAnnouncementMeetTime');
    updatePreview();
    if (!meetTime) {
      byId('participantAnnouncementMeetTime')?.focus?.();
      window.AppUI?.showStatus?.('集合時間を入力してください。', { tone: 'warning' });
      return;
    }
    try {
      await copyText(buildAnnouncement());
      window.AppUI?.showStatus?.('参加者発表文をコピーしました。', { tone: 'success' });
    } catch (error) {
      window.AppUI?.showStatus?.(error?.message || '発表文をコピーできませんでした。', { tone: 'error' });
    }
  }

  function ensureActionPanel() {
    const status = byId('formApplicantStatus');
    if (!status) return null;
    let panel = byId('participantAnnouncementPanel');
    if (!panel) {
      panel = document.createElement('section');
      panel.id = 'participantAnnouncementPanel';
      panel.className = 'participant-announcement-panel';
      panel.setAttribute('aria-labelledby', 'participantAnnouncementPanelTitle');
      panel.innerHTML = `
        <div>
          <h3 id="participantAnnouncementPanelTitle">参加者発表</h3>
          <p id="participantAnnouncementPanelNote">確定した参加者情報から、ラクラク連絡網に投稿する文章を作成します。</p>
        </div>
        <cds-button id="participantAnnouncementOpenBtn" kind="tertiary" size="lg" type="button">発表文を作成</cds-button>`;
      status.insertAdjacentElement('afterend', panel);
      byId('participantAnnouncementOpenBtn')?.addEventListener('click', openModal);
    }
    return panel;
  }

  function refreshAction() {
    const state = availability();
    let panel = byId('participantAnnouncementPanel');
    if (!applicationSync()) {
      panel?.remove();
      return false;
    }
    panel = ensureActionPanel();
    if (!panel) return false;
    panel.hidden = !state.visible;
    const button = byId('participantAnnouncementOpenBtn');
    if (button) {
      const disabled = !state.enabled;
      const alreadyDisabled = button.disabled || button.hasAttribute('disabled');
      if (alreadyDisabled !== disabled) button.disabled = disabled;
      button.toggleAttribute('disabled', disabled);
      button.setAttribute('title', state.reason);
    }
    const note = byId('participantAnnouncementPanelNote');
    const noteText = state.enabled
      ? '確定した参加者情報から、ラクラク連絡網に投稿する文章を作成します。'
      : state.reason;
    if (note && note.textContent !== noteText) note.textContent = noteText;
    if (byId('participantAnnouncementModal')) updatePreview();
    return true;
  }

  function installObserver() {
    if (observer) return;
    observer = new MutationObserver(() => queueMicrotask(refreshAction));
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['disabled']
    });
    window.addEventListener('sanpo:canonical-room-changed', refreshAction);
  }

  function start() {
    refreshAction();
    installObserver();
    const timer = window.setInterval(() => {
      if (!byId('participants-view-area')) return;
      refreshAction();
      window.clearInterval(timer);
    }, 150);
  }

  window.SanpoParticipantAnnouncement = Object.freeze({
    open: openModal,
    build: buildAnnouncement,
    refresh: refreshAction,
    fixedMeetingPlace: FIXED_MEETING_PLACE
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();