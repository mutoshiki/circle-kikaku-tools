// Periodic history snapshot scheduler.
// Split from app.js during S-4 cleanup.

function startHistoryAutosave() {
    setInterval(() => {
        if (isRemoteUpdate || !dbRef) return;
        const currentData = getData();
        let hist = window.SanpoHistory?.read(roomId) || safeLocalGet('syawari_history_' + roomId, []);
        if (hist.length > 0) {
            if (JSON.stringify(hist[0].data) === JSON.stringify(currentData)) return;
        }
        hist.unshift({ time: Date.now(), data: currentData });
        if (hist.length > 20) hist = hist.slice(0, 20);
        (window.SanpoHistory?.write(roomId, hist) || safeLocalSet('syawari_history_' + roomId, hist));
    }, 60000);
}
