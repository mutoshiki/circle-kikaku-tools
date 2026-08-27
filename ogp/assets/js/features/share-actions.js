// Share and small selection helpers.
// Sharing points to the ordinary room URL so all views use one consistent entry.

function createSharedViewUrl() {
    const url = new URL('./', window.location.href);
    url.search = '';
    url.hash = '';
    const activeRoomId = typeof roomId === 'string' && roomId
        ? roomId
        : new URLSearchParams(window.location.search).get('room');
    if (activeRoomId) url.searchParams.set('room', activeRoomId);
    return url.toString();
}

function showShareCopyStatus(message, tone = 'neutral') {
    if (window.AppUI?.showStatus) {
        window.AppUI.showStatus(message, { tone, duration: 2200 });
        return;
    }
    window.showMiniToast?.(message, tone);
}

async function copyUrl() {
    const url = createSharedViewUrl();
    try {
        if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable');
        await navigator.clipboard.writeText(url);
        showShareCopyStatus('リンクをコピーしました', 'success');
        return true;
    } catch (_) {
        showShareCopyStatus('リンクをコピーできませんでした', 'error');
        return false;
    }
}

function selectGrade(btn) {
    if (!btn) return;
    document.querySelectorAll('.grade-select-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
}

window.SanpoApp?.exposeCompat?.('selectGrade', selectGrade);
window.SanpoApp?.exposeCompat?.('createSharedViewUrl', createSharedViewUrl);
window.SanpoApp?.exposeCompat?.('copyUrl', copyUrl);
window.SanpoApp?.registerActions?.({ 'copy-url': () => copyUrl() });
