// Sheet viewport pan, zoom, and timetable editing interactions.

let sheetScale = 1, sheetX = 0, sheetY = 0;
let isPanning = false, panStartX = 0, panStartY = 0, panOriginX = 0, panOriginY = 0;
let lastPinchDist = 0;
let sheetUserAdjusted = false;

function applySheetTransform() {
    const canvas = byId('sheet-canvas');
    if (canvas) canvas.style.transform = `translate(${sheetX}px,${sheetY}px) scale(${sheetScale})`;
}

function getSheetContentWidth(canvas) {
    if (!canvas?.children.length) return 0;
    return Math.max(
        ...Array.from(canvas.children).map(child => child.scrollWidth || child.offsetWidth || 0),
        canvas.scrollWidth || 0
    );
}

function getInitialSheetX(area, contentWidth, scale) {
    if (!area || area.clientWidth <= 640) return 0;
    return Math.max(0, Math.round((area.clientWidth - contentWidth * scale) / 2));
}

function fitInitialSheetScale() {
    if (sheetUserAdjusted) return;
    const area = byId('sheet-view-area');
    const canvas = byId('sheet-canvas');
    if (!area || !canvas || !canvas.children.length) return;
    const contentWidth = getSheetContentWidth(canvas);
    const availableWidth = Math.max(0, area.clientWidth - 20);
    if (!contentWidth || !availableWidth) return;
    const isCompact = area.clientWidth <= 640;
    const minScale = isCompact ? 0.74 : 0.92;
    const maxScale = isCompact ? 0.88 : 1;
    sheetScale = Math.min(1, Math.min(maxScale, Math.max(minScale, availableWidth / contentWidth)));
    sheetX = getInitialSheetX(area, contentWidth, sheetScale);
    sheetY = 0;
    applySheetTransform();
}

function markSheetAdjusted() {
    sheetUserAdjusted = true;
}

function zoomIn() { markSheetAdjusted(); sheetScale = Math.min(sheetScale * 1.25, 4); applySheetTransform(); }
function zoomOut() { markSheetAdjusted(); sheetScale = Math.max(sheetScale / 1.25, 0.3); applySheetTransform(); }
function resetZoom() {
    markSheetAdjusted();
    const area = byId('sheet-view-area');
    const canvas = byId('sheet-canvas');
    sheetScale = 1;
    sheetX = getInitialSheetX(area, getSheetContentWidth(canvas), sheetScale);
    sheetY = 0;
    applySheetTransform();
}
window.zoomIn = zoomIn; window.zoomOut = zoomOut; window.resetZoom = resetZoom;

D.addEventListener('DOMContentLoaded', () => {
    const area = byId('sheet-view-area');
    if (!area) return;
    const preventSheetTextSelection = e => {
        if (isSheetDragHandle(e.target)) e.preventDefault();
    };

    area.addEventListener('contextmenu', preventSheetTextSelection);
    area.addEventListener('selectstart', preventSheetTextSelection);
    area.addEventListener('touchstart', () => {
        if (quickEditMode && currentView === 'sheet' && window.getSelection) {
            window.getSelection()?.removeAllRanges();
        }
    }, { passive: true });

    area.addEventListener('click', event => {
        const action = event.target.closest?.('[data-action]')?.dataset?.action;
        if (action === 'add-sheet-timetable-row') {
            event.preventDefault();
            addSheetTimetableEditRow();
            syncSheetToMainData({ refresh: false, persist: true });
        }
        if (action === 'delete-sheet-timetable-row') {
            event.preventDefault();
            deleteSheetTimetableEditRow(event.target.closest('[data-action]'));
            syncSheetToMainData({ refresh: false, persist: true });
        }
    });

    area.addEventListener('input', event => {
        if (!event.target.closest?.('.sheet-timetable-input')) return;
        syncSheetTimetableToOverview();
        clearTimeout(window.__sheetTimetableSaveTimer);
        window.__sheetTimetableSaveTimer = setTimeout(() => {
            syncSheetToMainData({ refresh: false, persist: true });
        }, 250);
    });

    area.addEventListener('mousedown', e => {
        if (isSheetInteractiveTarget(e.target) || isSheetDragHandle(e.target)) return;
        markSheetAdjusted();
        isPanning = true; panStartX = e.clientX; panStartY = e.clientY;
        panOriginX = sheetX; panOriginY = sheetY;
        area.style.cursor = 'grabbing';
    });
    D.addEventListener('mousemove', e => {
        if (!isPanning) return;
        sheetX = panOriginX + (e.clientX - panStartX);
        sheetY = panOriginY + (e.clientY - panStartY);
        applySheetTransform();
    });
    D.addEventListener('mouseup', () => { isPanning = false; area.style.cursor = ''; });

    area.addEventListener('wheel', e => {
        e.preventDefault();
        markSheetAdjusted();
        const factor = e.deltaY < 0 ? 1.1 : 0.9;
        const rect = area.getBoundingClientRect();
        const mx = e.clientX - rect.left, my = e.clientY - rect.top;
        sheetX = mx - (mx - sheetX) * factor;
        sheetY = my - (my - sheetY) * factor;
        sheetScale = Math.max(0.3, Math.min(4, sheetScale * factor));
        applySheetTransform();
    }, { passive: false });

    area.addEventListener('touchstart', e => {
        if (isSheetInteractiveTarget(e.target) || isSheetDragHandle(e.target)) return;
        markSheetAdjusted();
        if (e.touches.length === 1) {
            isPanning = true;
            panStartX = e.touches[0].clientX; panStartY = e.touches[0].clientY;
            panOriginX = sheetX; panOriginY = sheetY;
        } else if (e.touches.length === 2) {
            isPanning = false;
            lastPinchDist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
        }
    }, { passive: true });

    area.addEventListener('touchmove', e => {
        e.preventDefault();
        if (e.touches.length === 1 && isPanning) {
            sheetX = panOriginX + (e.touches[0].clientX - panStartX);
            sheetY = panOriginY + (e.touches[0].clientY - panStartY);
            applySheetTransform();
        } else if (e.touches.length === 2) {
            const dist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            if (lastPinchDist > 0) {
                const factor = dist / lastPinchDist;
                const rect = area.getBoundingClientRect();
                const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
                const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
                sheetX = cx - (cx - sheetX) * factor;
                sheetY = cy - (cy - sheetY) * factor;
                sheetScale = Math.max(0.3, Math.min(4, sheetScale * factor));
                applySheetTransform();
            }
            lastPinchDist = dist;
        }
    }, { passive: false });

    area.addEventListener('touchend', () => { isPanning = false; lastPinchDist = 0; });
});
