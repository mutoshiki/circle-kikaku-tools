// Participant announcement copy generator for managed-form projects.
(() => {
  'use strict';

  const APPLICATION_KIND = 'formApplicationSync';
  const APPLICATION_VERSION = 2;
  const FIXED_MEETING_PLACE = 'サークルボックス前';
  const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];
  let observer = null;
  let itineraryRowSequence = 0;

  const byId = id => document.getElementById(id);

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

  function hasPendingSelection() {
    const apply = byId('formApplicantApplyBtn');
    if (!apply || applicationSync() === null) return false;
    return !apply.disabled && !apply.hasAttribute('disabled');
  }

  function committedParticipants(room = canonical(), sync = applicationSync(room)) {
    if (!room || !sync) return [];
    const applicantsByName = new Map();
    Object.values(sync.applicants || {}).forEach(applicant => {
      const key = normalizedName(applicant?.name);
      if (!key) return;
      const entries = applicantsByName.get(key) || [];
      entries.push(applicant);
      applicantsByName.set(key, entries);
    });

    return Object.values(room.participants || {})
      .filter(person => String(person?.name || '').trim())
      .map(person => {
        const matches = applicantsByName.get(normalizedName(person.name)) || [];
        const applicant = matches.length === 1 ? matches[0] : null;
        return {
          name: String(person.name || '').trim(),
          grade: Math.max(0, Math.min(4, parseInt(person.grade ?? applicant?.grade, 10) || 0)),
          canDrive: Boolean(applicant?.canDrive)
        };
      })
      .sort((a, b) => (b.grade - a.grade) || a.name.localeCompare(b.name, 'ja'));
  }

  function formatEventDate(value) {
    const raw = String(value || '').trim();
    const match = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(raw);
    if (!match) return '';
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(year, month - 1, day, 12, 0, 0);
    if (Number.isNaN(date.getTime())) return '';
    return `${month}月${day}日(${WEEKDAYS[date.getDay()]})`;
  }

  function projectName(sync = applicationSync(), room = canonical()) {
    const raw = String(sync?.title || room?.roomName || '').trim() || '企画';
    return raw.endsWith('企画') ? raw : `${raw}企画`;
  }

  function sourceEventDate(sync = applicationSync(), room = canonical()) {
    return String(sync?.eventDate || sync?.date || room?.eventDate || room?.date || '').trim();
  }

  function selectedEventDate(sync = applicationSync(), room = canonical()) {
    const input = byId('announcementEventDate');
    return input ? String(input.value || '').trim() : sourceEventDate(sync, room);
  }

  function eventDateLabel(sync = applicationSync(), room = canonical()) {
    return formatEventDate(selectedEventDate(sync, room));
  }

  function announcementTitle() {
    const sync = applicationSync();
    return `【参加者発表】${eventDateLabel(sync)}${projectName(sync)}`;
  }

  function announcementSubject(sync = applicationSync(), room = canonical()) {
    return `${eventDateLabel(sync, room)}${projectName(sync, room)}`;
  }

  function participantLines(participants) {
    const sections = [];
    [4, 3, 2, 1].forEach(grade => {
      const people = participants.filter(person => person.grade === grade);
      if (!people.length) return;
      sections.push(`${grade}年\n${people.map(person => `${person.canDrive ? '○' : ''}${person.name}`).join('   ')}`);
    });
    const unknown = participants.filter(person => ![1, 2, 3, 4].includes(person.grade));
    if (unknown.length) {
      sections.push(`学年未設定\n${unknown.map(person => `${person.canDrive ? '○' : ''}${person.name}`).join('   ')}`);
    }
    return sections.join('\n\n');
  }

  function fieldValue(id) {
    return String(byId(id)?.value || '').trim();
  }

  function participantCountMatchesApplicants(participantCount, applicantCount, responseCount) {
    const total = applicantCount || Number(responseCount || 0);
    return participantCount > 0 && total > 0 && participantCount === total;
  }

  function defaultApplicationMessage(room = canonical(), sync = applicationSync(room)) {
    const participants = committedParticipants(room, sync);
    const applicantCount = Object.keys(sync?.applicants || {}).length;
    const allAccepted = participantCountMatchesApplicants(participants.length, applicantCount, sync?.responseCount);
    return allAccepted
      ? '今回は応募してくださった方全員が参加できることになりました。\nご応募ありがとうございました！'
      : 'たくさんのご応募ありがとうございました！';
  }

  function hasDrivers(participants) {
    return participants.some(person => person.canDrive);
  }

  function itineraryEntries() {
    return Array.from(document.querySelectorAll('#announcementItineraryList .participant-announcement-itinerary__row'))
      .map(row => ({
        time: String(row.querySelector('[data-itinerary-time]')?.value || '').trim(),
        step: String(row.querySelector('[data-itinerary-step]')?.value || '').trim()
      }))
      .filter(entry => entry.time || entry.step);
  }

  function itineraryLine(entry) {
    return [entry.time, entry.step].filter(Boolean).join(' ');
  }

  function bodyText({ allowPlaceholder = false } = {}) {
    const room = canonical();
    const sync = applicationSync(room);
    const participants = committedParticipants(room, sync);
    if (!sync || !participants.length) return '';

    const time = fieldValue('announcementMeetingTime');
    const opening = fieldValue('announcementOpening');
    const supplement = fieldValue('announcementSupplement');
    const itinerary = itineraryEntries();
    const contact = fieldValue('announcementContact');
    const closing = fieldValue('announcementClosing');
    const meetingTime = time || (allowPlaceholder ? '［集合時間］' : '');
    const lines = [];

    if (opening) lines.push(opening, '');
    lines.push(`${announcementSubject(sync, room)}の参加者を発表します。`);
    lines.push(defaultApplicationMessage(room, sync));
    if (supplement) lines.push(supplement);

    lines.push('', '【参加者】');
    if (hasDrivers(participants)) lines.push('○は車出し');
    lines.push('', participantLines(participants), '', `以上${participants.length}名です。`);
    lines.push('', `当日は${meetingTime}に${FIXED_MEETING_PLACE}に集合してください。`);

    if (itinerary.length) {
      lines.push('', '～大まかな予定～');
      itinerary.forEach((entry, index) => {
        const line = itineraryLine(entry);
        if (!line) return;
        if (index > 0) lines.push('  ↓');
        lines.push(line);
      });
    }
    if (contact) lines.push('', '質問がありましたら', `${contact} までお願いします。`);
    if (closing) lines.push('', closing);
    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  function setComponentValue(element, value) {
    if (!element) return;
    if (element.value !== value) element.value = value;
    if (element.getAttribute('value') !== value) element.setAttribute('value', value);
  }

  function setPreviewText(id, value) {
    const element = byId(id);
    if (element && element.textContent !== value) element.textContent = value;
  }

  function updatePreview() {
    setPreviewText('announcementTitlePreview', announcementTitle());
    setPreviewText('announcementBodyPreview', bodyText({ allowPlaceholder: true }));
  }

  function validateMeetingTime({ focus = false } = {}) {
    const timeInput = byId('announcementMeetingTime');
    const invalid = !fieldValue('announcementMeetingTime');
    if (timeInput) {
      timeInput.dataset.touched = 'true';
      timeInput.toggleAttribute('invalid', invalid);
      if (invalid) timeInput.setAttribute('invalid-text', '集合時間を入力してください。');
      else timeInput.removeAttribute('invalid-text');
      if (invalid && focus) timeInput.focus?.();
    }
    return !invalid;
  }

  function showStep(step) {
    const editing = step !== 'preview';
    const fields = byId('announcementEditStep');
    const preview = byId('announcementPreviewStep');
    const heading = byId('announcementModalHeading');
    if (fields) fields.hidden = !editing;
    if (preview) preview.hidden = editing;
    if (heading) heading.textContent = editing ? '参加者発表文を作成' : '参加者発表文を確認';
    if (!editing) updatePreview();
  }

  function toggleAdvanced() {
    const section = byId('announcementAdvancedFields');
    const button = byId('announcementAdvancedToggleBtn');
    if (!section || !button) return;
    const expanded = section.hidden;
    section.hidden = !expanded;
    button.setAttribute('aria-expanded', String(expanded));
    button.textContent = expanded ? '調整項目を閉じる' : '文章をさらに調整';
  }

  function createItineraryRow() {
    const row = document.createElement('div');
    const rowNumber = ++itineraryRowSequence;
    row.className = 'participant-announcement-itinerary__row';
    row.dataset.itineraryRow = String(rowNumber);
    row.innerHTML = `
      <cds-text-input data-itinerary-time type="time" size="lg" label="時間"></cds-text-input>
      <cds-text-input data-itinerary-step type="text" size="lg" label="予定" placeholder="例：登山開始"></cds-text-input>
      <cds-button data-itinerary-remove kind="ghost" size="sm" type="button" aria-label="この予定を削除">削除</cds-button>`;

    row.querySelectorAll('[data-itinerary-time], [data-itinerary-step]').forEach(input => {
      input.addEventListener('input', updatePreview);
      input.addEventListener('change', updatePreview);
    });
    row.querySelector('[data-itinerary-remove]')?.addEventListener('click', () => {
      row.remove();
      updatePreview();
    });
    return row;
  }

  function addItineraryRow({ focus = true } = {}) {
    const list = byId('announcementItineraryList');
    if (!list) return null;
    const row = createItineraryRow();
    list.appendChild(row);
    updatePreview();
    if (focus) window.setTimeout(() => row.querySelector('[data-itinerary-time]')?.focus?.(), 0);
    return row;
  }

  function ensureModal() {
    let modal = byId('participantAnnouncementModal');
    if (modal) return modal;

    modal = document.createElement('cds-modal');
    modal.id = 'participantAnnouncementModal';
    modal.className = 'participant-announcement-modal app-modal app-modal--scroll';
    modal.setAttribute('size', 'md');
    modal.setAttribute('has-scrolling-content', '');
    modal.setAttribute('aria-label', '参加者発表文を作成');
    modal.innerHTML = `
      <cds-modal-header>
        <cds-modal-heading id="announcementModalHeading" data-modal-primary-focus tabindex="-1">参加者発表文を作成</cds-modal-heading>
        <cds-modal-close-button id="announcementCloseIcon" close-button-label="閉じる"></cds-modal-close-button>
      </cds-modal-header>
      <cds-modal-body class="app-modal-body participant-announcement-body" no-fade>
        <div class="participant-announcement-layout">
          <section id="announcementEditStep" class="participant-announcement-fields" aria-label="発表文の入力">
            <cds-text-input id="announcementEventDate" type="date" size="lg" label="実施日（任意）"></cds-text-input>
            <cds-text-input id="announcementMeetingTime" type="time" size="lg" required label="集合時間"></cds-text-input>

            <section class="participant-announcement-itinerary" aria-labelledby="announcementItineraryHeading">
              <div class="participant-announcement-itinerary__heading">
                <h3 id="announcementItineraryHeading">大まかな予定（任意）</h3>
                <cds-button id="announcementAddItineraryBtn" kind="tertiary" size="sm" type="button">予定を追加</cds-button>
              </div>
              <div id="announcementItineraryList" class="participant-announcement-itinerary__list" aria-label="大まかな予定"></div>
            </section>

            <cds-textarea id="announcementSupplement" rows="3" label="補足事項（任意）" placeholder="例：天候によっては中止する場合があります。温泉に寄るので着替え・タオルを持ってきてください。"></cds-textarea>

            <div class="participant-announcement-advanced-toggle">
              <cds-button id="announcementAdvancedToggleBtn" kind="ghost" size="sm" type="button" aria-expanded="false">文章をさらに調整</cds-button>
            </div>
            <section id="announcementAdvancedFields" class="participant-announcement-advanced" aria-label="文章の追加調整" hidden>
              <cds-textarea id="announcementOpening" rows="2" label="冒頭のひとこと（任意）" placeholder="例：お疲れ様です！〇〇です。"></cds-textarea>
              <cds-text-input id="announcementContact" type="email" size="lg" label="連絡先（任意）" placeholder="例：sampokai25@gmail.com"></cds-text-input>
              <cds-textarea id="announcementClosing" rows="2" label="最後のひとこと（任意）" placeholder="例：それでは当日よろしくお願いします！"></cds-textarea>
            </section>

            <div class="participant-announcement-edit-actions">
              <cds-button id="announcementPreviewBtn" kind="primary" size="lg" type="button">発表文を確認</cds-button>
            </div>
          </section>

          <section id="announcementPreviewStep" class="participant-announcement-preview" aria-label="発表文プレビュー" hidden>
            <div class="participant-announcement-preview__topbar">
              <cds-button id="announcementEditBtn" kind="ghost" size="sm" type="button">編集に戻る</cds-button>
            </div>
            <div class="participant-announcement-preview__block">
              <div class="participant-announcement-preview__heading">
                <h3>タイトル</h3>
                <cds-button id="announcementCopyTitleBtn" kind="tertiary" size="sm" type="button">コピー</cds-button>
              </div>
              <div id="announcementTitlePreview" class="participant-announcement-output participant-announcement-output--title" aria-label="タイトル"></div>
            </div>
            <div class="participant-announcement-preview__block participant-announcement-preview__block--body">
              <div class="participant-announcement-preview__heading">
                <h3>本文</h3>
                <cds-button id="announcementCopyBodyBtn" kind="primary" size="sm" type="button">本文をコピー</cds-button>
              </div>
              <pre id="announcementBodyPreview" class="participant-announcement-output participant-announcement-output--body" aria-label="本文"></pre>
            </div>
          </section>
        </div>
      </cds-modal-body>`;
    document.body.appendChild(modal);

    setComponentValue(byId('announcementEventDate'), sourceEventDate());
    // Keep the meeting time deliberately empty. Autofocusing a time input on iOS can
    // make the current time look selected even though the organizer never chose it.
    setComponentValue(byId('announcementMeetingTime'), '');
    byId('announcementMeetingTime')?.removeAttribute('value');

    ['announcementEventDate', 'announcementMeetingTime', 'announcementSupplement', 'announcementOpening', 'announcementContact', 'announcementClosing'].forEach(id => {
      const input = byId(id);
      input?.addEventListener('input', updatePreview);
      input?.addEventListener('change', updatePreview);
    });
    byId('announcementMeetingTime')?.addEventListener('blur', event => {
      if (!event.currentTarget.value) {
        event.currentTarget.dataset.touched = 'true';
        validateMeetingTime();
      }
    });
    byId('announcementAddItineraryBtn')?.addEventListener('click', () => addItineraryRow());
    byId('announcementAdvancedToggleBtn')?.addEventListener('click', toggleAdvanced);
    byId('announcementPreviewBtn')?.addEventListener('click', () => {
      if (!validateMeetingTime({ focus: true })) return;
      showStep('preview');
      window.setTimeout(() => byId('announcementEditBtn')?.focus?.(), 0);
    });
    byId('announcementEditBtn')?.addEventListener('click', () => {
      showStep('edit');
      window.setTimeout(() => byId('announcementMeetingTime')?.focus?.(), 0);
    });
    byId('announcementCopyTitleBtn')?.addEventListener('click', () => void copyText(announcementTitle(), 'タイトル'));
    byId('announcementCopyBodyBtn')?.addEventListener('click', () => void copyBody());
    byId('announcementCloseIcon')?.addEventListener('click', () => closeModal(modal));
    return modal;
  }

  function openModal(modal) {
    const adapter = window.AppModalAdapter?.getOrCreateInstance?.(modal);
    if (adapter?.show) adapter.show();
    else {
      modal.open = true;
      modal.setAttribute('open', '');
    }
  }

  function closeModal(modal) {
    const adapter = window.AppModalAdapter?.getOrCreateInstance?.(modal);
    if (adapter?.hide) adapter.hide();
    else {
      modal.open = false;
      modal.removeAttribute('open');
    }
  }

  function openAnnouncement() {
    const state = availability();
    if (!state.enabled) {
      if (state.reason) window.AppUI?.showStatus?.(state.reason, { tone: 'warning' });
      return;
    }
    const modal = ensureModal();
    showStep('edit');
    updatePreview();
    openModal(modal);
  }

  function availability() {
    const sync = applicationSync();
    const participantCount = Object.keys(canonical()?.participants || {}).length;
    if (!sync) return { visible: false, enabled: false, reason: '' };
    if (!participantCount) return { visible: false, enabled: false, reason: '参加者を確定してから作成できます。' };
    if (hasPendingSelection()) return { visible: false, enabled: false, reason: '参加者の変更を保存してから作成できます。' };
    return { visible: true, enabled: true, reason: '確定した参加者から発表文を作成します。' };
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
          <p>らくらく連絡網に投稿する参加者発表文を作成します。</p>
        </div>
        <cds-button id="participantAnnouncementOpenBtn" kind="tertiary" size="lg" type="button">発表文を作成</cds-button>`;
      status.insertAdjacentElement('afterend', panel);
      byId('participantAnnouncementOpenBtn')?.addEventListener('click', openAnnouncement);
    }
    return panel;
  }

  function refreshAction() {
    const state = availability();
    let panel = byId('participantAnnouncementPanel');
    if (!state.visible) {
      panel?.remove();
      return false;
    }
    panel = ensureActionPanel();
    if (!panel) return false;
    const button = byId('participantAnnouncementOpenBtn');
    if (button) {
      const disabled = !state.enabled;
      const currentlyDisabled = button.disabled || button.hasAttribute('disabled');
      if (currentlyDisabled !== disabled) button.disabled = disabled;
      button.toggleAttribute('disabled', disabled);
      button.setAttribute('title', state.reason);
    }
    if (byId('participantAnnouncementModal')) updatePreview();
    return true;
  }

  async function copyText(text, label) {
    const value = String(text || '');
    if (!value) return;
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(value);
      else throw new Error('clipboard-unavailable');
    } catch (_) {
      const buffer = document.createElement('div');
      buffer.textContent = value;
      buffer.contentEditable = 'true';
      buffer.setAttribute('aria-hidden', 'true');
      buffer.style.position = 'fixed';
      buffer.style.inset = '0 auto auto -10000px';
      document.body.appendChild(buffer);
      const range = document.createRange();
      range.selectNodeContents(buffer);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      const copied = document.execCommand('copy');
      selection?.removeAllRanges();
      buffer.remove();
      if (!copied) throw new Error('コピーできませんでした。');
    }
    window.AppUI?.showStatus?.(`${label}をコピーしました。`, { tone: 'success' });
  }

  async function copyBody() {
    if (!validateMeetingTime({ focus: true })) {
      showStep('edit');
      return;
    }
    await copyText(bodyText(), '本文');
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
    open: openAnnouncement,
    refresh: refreshAction,
    title: announcementTitle,
    body: () => bodyText(),
    fixedMeetingPlace: FIXED_MEETING_PLACE
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
