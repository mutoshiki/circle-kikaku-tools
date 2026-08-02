// Share and small selection helpers
// Owns copy fallback, room URL copy, and grade button selection.

function showCopyFallback(message, text) {
    let box = byId('copy-fallback');
    if (!box) {
        box = document.createElement('div');
        box.id = 'copy-fallback';
        box.className = 'copy-fallback-panel';
        document.body.appendChild(box);
    }
    box.innerHTML = '';

    const label = document.createElement('div');
    label.className = 'copy-fallback-label';
    label.textContent = message;

    const textarea = document.createElement('cds-textarea');
    textarea.className = 'copy-fallback-textarea';
    textarea.readOnly = true;
    textarea.value = text;
    textarea.label = 'コピーする内容';
    textarea.hideLabel = true;
    textarea.setAttribute('aria-label', 'コピーする内容');

    const close = document.createElement('cds-button');
    close.type = 'button';
    close.kind = 'secondary';
    close.size = 'lg';
    close.className = 'copy-fallback-close';
    close.textContent = '閉じる';
    close.addEventListener('click', () => box.remove());

    box.append(label, textarea, close);
    textarea.focus();
    void textarea.updateComplete.then(() => textarea.shadowRoot?.querySelector('textarea')?.select());
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
