// Share and small selection helpers
// Owns purpose-specific room links, native sharing, copy fallback, and grade selection.

function showCopyFallback(message, text) {
    byId('copy-fallback')?.remove();

    const modal = document.createElement('cds-modal');
    modal.id = 'copy-fallback';
    modal.className = 'app-modal copy-fallback-modal';
    modal.size = 'sm';
    modal.setAttribute('size', 'sm');
    modal.setAttribute('aria-label', message || 'コピー');

    const header = document.createElement('cds-modal-header');
    const heading = document.createElement('cds-modal-heading');
    heading.id = 'copy-fallback-title';
    heading.dataset.modalPrimaryFocus = '';
    heading.tabIndex = -1;
    heading.textContent = message || 'コピー';
    const close = document.createElement('cds-modal-close-button');
    close.setAttribute('close-button-label', '閉じる');
    close.dataset.modalClose = '';
    header.append(heading, close);

    const body = document.createElement('cds-modal-body');
    body.className = 'app-modal-body copy-fallback-body';
    const textarea = document.createElement('cds-textarea');
    textarea.className = 'copy-fallback-textarea';
    textarea.readOnly = true;
    textarea.value = text;
    textarea.rows = 5;
    textarea.label = 'コピーする内容';
    textarea.setAttribute('label', 'コピーする内容');
    body.appendChild(textarea);

    const footer = document.createElement('cds-modal-footer');
    const done = document.createElement('cds-modal-footer-button');
    done.kind = 'primary';
    done.type = 'button';
    done.dataset.modalClose = '';
    done.textContent = '閉じる';
    footer.appendChild(done);
    modal.append(header, body, footer);
    document.body.appendChild(modal);

    const adapter = window.AppModalAdapter.getOrCreateInstance(modal);
    modal.addEventListener('sanpo:modal-hidden', () => modal.remove(), { once: true });
    adapter.show();
    Promise.resolve(textarea.updateComplete).then(() => {
        textarea.shadowRoot?.querySelector('textarea')?.select();
    });
}

const SHARE_PREVIEW_VERSION = '824cb76665ac-c4a994eef616';

const SHARE_LINK_TYPES = Object.freeze({
    presentation: Object.freeze({
        path: 'share/presentation/',
        title: '車割・班割',
        modalLabel: '車割・班割（発表用リンク）',
        icon: 'table'
    }),
    settlement: Object.freeze({
        path: 'share/settlement/',
        title: '精算',
        modalLabel: '精算用リンク',
        icon: 'calculator'
    })
});

function getAppBaseUrl() {
    const base = new URL('./', window.location.href);
    base.search = '';
    base.hash = '';
    return base;
}

function createPurposeShareUrl(type) {
    const config = SHARE_LINK_TYPES[type];
    if (!config) throw new Error(`Unknown share link type: ${type}`);

    const url = new URL(config.path, getAppBaseUrl());
    url.searchParams.set('preview', SHARE_PREVIEW_VERSION);
    const activeRoomId = typeof roomId === 'string' && roomId
        ? roomId
        : new URLSearchParams(window.location.search).get('room');
    if (activeRoomId) url.searchParams.set('room', activeRoomId);
    return url.toString();
}

async function copyShareLink(type) {
    const config = SHARE_LINK_TYPES[type];
    if (!config) return;
    const url = createPurposeShareUrl(type);

    try {
        await navigator.clipboard.writeText(url);
        showAppNotice(`${config.title}のリンクをコピーしました`);
    } catch (_) {
        showCopyFallback(`${config.title}のリンクをコピー`, url);
    }
}

async function sharePurposeLink(type) {
    const config = SHARE_LINK_TYPES[type];
    if (!config) return;
    const url = createPurposeShareUrl(type);

    if (typeof navigator.share !== 'function') {
        await copyShareLink(type);
        return;
    }

    try {
        await navigator.share({ title: `${config.title}｜サークル企画ツール`, url });
    } catch (error) {
        if (error?.name !== 'AbortError') {
            showCopyFallback(`${config.title}のリンクを共有`, url);
        }
    }
}

function createShareLinkOption(type) {
    const config = SHARE_LINK_TYPES[type];
    const section = document.createElement('section');
    section.className = 'share-link-option';

    const title = document.createElement('div');
    title.className = 'share-link-option-title';
    title.innerHTML = `<span data-carbon-icon="${config.icon}" aria-hidden="true"></span><span>${config.modalLabel}</span>`;

    const actions = document.createElement('div');
    actions.className = 'share-link-option-actions';

    const copy = document.createElement('cds-button');
    copy.kind = 'secondary';
    copy.size = 'md';
    copy.type = 'button';
    copy.innerHTML = '<span data-carbon-icon="copy" slot="icon" aria-hidden="true"></span><span>コピー</span>';
    copy.addEventListener('click', () => copyShareLink(type));

    const share = document.createElement('cds-button');
    share.kind = 'primary';
    share.size = 'md';
    share.type = 'button';
    share.innerHTML = '<span data-carbon-icon="launch" slot="icon" aria-hidden="true"></span><span>共有</span>';
    share.addEventListener('click', () => sharePurposeLink(type));

    actions.append(copy, share);
    section.append(title, actions);
    return section;
}

function openShareLinksModal() {
    byId('share-links-modal')?.remove();

    const modal = document.createElement('cds-modal');
    modal.id = 'share-links-modal';
    modal.className = 'app-modal share-links-modal';
    modal.size = 'sm';
    modal.setAttribute('size', 'sm');
    modal.setAttribute('aria-label', '共有リンク');

    const header = document.createElement('cds-modal-header');
    const heading = document.createElement('cds-modal-heading');
    heading.id = 'share-links-modal-title';
    heading.dataset.modalPrimaryFocus = '';
    heading.tabIndex = -1;
    heading.textContent = '共有リンク';
    const close = document.createElement('cds-modal-close-button');
    close.setAttribute('close-button-label', '閉じる');
    close.dataset.modalClose = '';
    header.append(heading, close);

    const body = document.createElement('cds-modal-body');
    body.className = 'app-modal-body share-links-modal-body';
    body.append(
        createShareLinkOption('presentation'),
        createShareLinkOption('settlement')
    );

    modal.append(header, body);
    document.body.appendChild(modal);
    window.SanpoCarbon?.renderCarbonIcons(modal);

    const adapter = window.AppModalAdapter.getOrCreateInstance(modal);
    modal.addEventListener('sanpo:modal-hidden', () => modal.remove(), { once: true });
    adapter.show();
}

// Compatibility name retained because the existing header event calls copyUrl().
function copyUrl() {
    openShareLinksModal();
}

function selectGrade(btn) {
    if (!btn) return;
    document.querySelectorAll('.grade-select-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
}

window.SanpoApp?.exposeCompat?.('selectGrade', selectGrade);
window.SanpoApp?.exposeCompat?.('showCopyFallback', showCopyFallback);
window.SanpoApp?.exposeCompat?.('createPurposeShareUrl', createPurposeShareUrl);
window.SanpoApp?.exposeCompat?.('openShareLinksModal', openShareLinksModal);
window.SanpoApp?.exposeCompat?.('copyUrl', copyUrl);
window.SanpoApp?.registerActions?.({
    'copy-url': () => openShareLinksModal()
});
