// Share and small selection helpers
// Owns the canonical room link, resilient clipboard copy, and grade selection.

function createSharedViewUrl() {
    const url = new URL('./', window.location.href);
    url.search = '';
    url.hash = '';
    const activeRoomId = typeof roomId === 'string' && roomId
        ? roomId
        : new URLSearchParams(window.location.search).get('room');
    if (activeRoomId) url.searchParams.set('room', activeRoomId);
    url.searchParams.set('view', 'sheet');
    return url.toString();
}

function showShareCopyStatus(message, tone = 'neutral') {
    if (window.AppUI?.showStatus) {
        window.AppUI.showStatus(message, { tone, duration: 2200 });
        return;
    }
    window.showMiniToast?.(message, tone);
}

function legacyCopyText(text) {
    const textarea = document.createElement('textarea');
    textarea.value = String(text || '');
    textarea.setAttribute('readonly', '');
    textarea.setAttribute('aria-hidden', 'true');
    textarea.style.position = 'fixed';
    textarea.style.inset = '0 auto auto -9999px';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    let copied = false;
    try { copied = document.execCommand('copy'); }
    catch (_) { copied = false; }
    textarea.remove();
    return copied;
}

async function copyUrl() {
    const url = createSharedViewUrl();
    let copied = false;
    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(url);
            copied = true;
        }
    } catch (_) {
        copied = false;
    }
    if (!copied) copied = legacyCopyText(url);
    if (copied) {
        showShareCopyStatus('リンクをコピーしました', 'success');
        return true;
    }
    showShareCopyStatus('リンクをコピーできませんでした', 'error');
    return false;
}

function selectGrade(btn) {
    if (!btn) return;
    document.querySelectorAll('.grade-select-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
}

window.SanpoApp?.exposeCompat?.('selectGrade', selectGrade);
window.SanpoApp?.exposeCompat?.('createSharedViewUrl', createSharedViewUrl);
window.SanpoApp?.exposeCompat?.('copyUrl', copyUrl);
window.SanpoApp?.registerActions?.({
    'copy-url': () => copyUrl()
});
