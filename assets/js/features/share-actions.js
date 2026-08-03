// Share and small selection helpers
// Owns copy fallback, room URL copy, and grade button selection.

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

function copyUrl() {
    navigator.clipboard.writeText(window.location.href).then(() => {
        showAppNotice('共有リンクをコピーしました。参加者は発表ビューで開きます');
    }).catch(() => {
        showCopyFallback('共有リンクをコピーしてください', window.location.href);
    });
}

function selectGrade(btn) {
    if (!btn) return;
    document.querySelectorAll('.grade-select-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
}
window.SanpoApp?.exposeCompat?.('selectGrade', selectGrade);
window.SanpoApp?.exposeCompat?.('showCopyFallback', showCopyFallback);
window.SanpoApp?.exposeCompat?.('copyUrl', copyUrl);
window.SanpoApp?.registerActions?.({
    'copy-url': () => copyUrl()
});
