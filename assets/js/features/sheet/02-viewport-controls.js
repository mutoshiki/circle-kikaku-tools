// Sheet viewport pan, zoom, and timetable editing interactions.

let sheetScale = 1;
let isPanning = false;
let panStartX = 0;
let panStartY = 0;
let panOriginLeft = 0;
let panOriginTop = 0;
let lastPinchDist = 0;
let lastPinchCenterX = 0;
let lastPinchCenterY = 0;
let sheetUserAdjusted = false;

function getSheetViewport() {
    return byId('sheet-canvas');
}

function getSheetContent() {
    return byId('sheet-content');
}

function clampSheetScale(value) {
    return Math.max(0.3, Math.min(4, Number(value) || 1));
}

function applySheetScale() {
    const content = getSheetContent();
    if (!content) return;
    content.style.transform = 'none';
    content.style.zoom = String(sheetScale);
}

function setSheetScale(nextScale, options = {}) {
    const viewport = getSheetViewport();
    const content = getSheetContent();
    if (!viewport || !content) return;

    const previousScale = sheetScale || 1;
    const rect = viewport.getBoundingClientRect();
    const targetFocalX = Number.isFinite(options.clientX) ? options.clientX - rect.left : viewport.clientWidth / 2;
    const targetFocalY = Number.isFinite(options.clientY) ? options.clientY - rect.top : viewport.clientHeight / 2;
    const sourceFocalX = Number.isFinite(options.sourceClientX) ? options.sourceClientX - rect.left : targetFocalX;
    const sourceFocalY = Number.isFinite(options.sourceClientY) ? options.sourceClientY - rect.top : targetFocalY;
    const contentX = (viewport.scrollLeft + sourceFocalX) / previousScale;
    const contentY = (viewport.scrollTop + sourceFocalY) / previousScale;

    sheetScale = clampSheetScale(nextScale);
    applySheetScale();

    viewport.scrollTo({
        left: Math.max(0, contentX * sheetScale - targetFocalX),
        top: Math.max(0, contentY * sheetScale - targetFocalY),
        behavior: 'auto'
    });
}

function getSheetContentWidth(content = getSheetContent()) {
    if (!content?.children.length) return 0;
    const previousZoom = content.style.zoom;
    content.style.zoom = '1';
    const width = Math.max(
        ...Array.from(content.children).map(child => child.scrollWidth || child.offsetWidth || 0),
        content.scrollWidth || 0
    );
    content.style.zoom = previousZoom;
    return width;
}

function fitInitialSheetScale() {
    if (sheetUserAdjusted) return;
    const viewport = getSheetViewport();
    const content = getSheetContent();
    if (!viewport || !content || !content.children.length) return;

    const contentWidth = getSheetContentWidth(content);
    const availableWidth = Math.max(0, viewport.clientWidth - 24);
    if (!contentWidth || !availableWidth) return;

    const compact = viewport.clientWidth <= 640;
    const minScale = compact ? 0.58 : 0.88;
    const maxScale = compact ? 0.9 : 1;
    sheetScale = Math.min(maxScale, Math.max(minScale, availableWidth / contentWidth));
    applySheetScale();
    viewport.scrollTo({ top: 0, left: 0, behavior: 'auto' });
}

function markSheetAdjusted() {
    sheetUserAdjusted = true;
}

D.addEventListener('DOMContentLoaded', () => {
    const area = byId('sheet-view-area');
    const viewport = getSheetViewport();
    if (!area || !viewport) return;

    const preventSheetTextSelection = event => {
        if (isSheetDragHandle(event.target)) event.preventDefault();
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

    viewport.addEventListener('mousedown', event => {
        if (event.button !== 0 || isSheetInteractiveTarget(event.target) || isSheetDragHandle(event.target)) return;
        markSheetAdjusted();
        isPanning = true;
        panStartX = event.clientX;
        panStartY = event.clientY;
        panOriginLeft = viewport.scrollLeft;
        panOriginTop = viewport.scrollTop;
        viewport.classList.add('is-panning');
        event.preventDefault();
    });
    D.addEventListener('mousemove', event => {
        if (!isPanning) return;
        viewport.scrollLeft = panOriginLeft - (event.clientX - panStartX);
        viewport.scrollTop = panOriginTop - (event.clientY - panStartY);
    });
    D.addEventListener('mouseup', () => {
        isPanning = false;
        viewport.classList.remove('is-panning');
    });

    viewport.addEventListener('wheel', event => {
        if (!event.ctrlKey && !event.metaKey) return;
        event.preventDefault();
        markSheetAdjusted();
        const factor = event.deltaY < 0 ? 1.1 : 0.9;
        setSheetScale(sheetScale * factor, { clientX: event.clientX, clientY: event.clientY });
    }, { passive: false });

    viewport.addEventListener('touchstart', event => {
        if (isSheetInteractiveTarget(event.target) || isSheetDragHandle(event.target)) return;
        if (event.touches.length !== 2) return;
        markSheetAdjusted();
        lastPinchDist = Math.hypot(
            event.touches[0].clientX - event.touches[1].clientX,
            event.touches[0].clientY - event.touches[1].clientY
        );
        lastPinchCenterX = (event.touches[0].clientX + event.touches[1].clientX) / 2;
        lastPinchCenterY = (event.touches[0].clientY + event.touches[1].clientY) / 2;
        event.preventDefault();
    }, { passive: false });

    viewport.addEventListener('touchmove', event => {
        if (event.touches.length !== 2 || lastPinchDist <= 0) return;
        event.preventDefault();
        const dist = Math.hypot(
            event.touches[0].clientX - event.touches[1].clientX,
            event.touches[0].clientY - event.touches[1].clientY
        );
        const clientX = (event.touches[0].clientX + event.touches[1].clientX) / 2;
        const clientY = (event.touches[0].clientY + event.touches[1].clientY) / 2;
        setSheetScale(sheetScale * (dist / lastPinchDist), {
            sourceClientX: lastPinchCenterX,
            sourceClientY: lastPinchCenterY,
            clientX,
            clientY
        });
        lastPinchDist = dist;
        lastPinchCenterX = clientX;
        lastPinchCenterY = clientY;
    }, { passive: false });

    const finishPinch = event => {
        if (event.touches.length >= 2) return;
        lastPinchDist = 0;
        lastPinchCenterX = 0;
        lastPinchCenterY = 0;
    };
    viewport.addEventListener('touchend', finishPinch, { passive: true });
    viewport.addEventListener('touchcancel', finishPinch, { passive: true });

    window.addEventListener('resize', () => {
        if (!sheetUserAdjusted) requestAnimationFrame(fitInitialSheetScale);
    });
});
