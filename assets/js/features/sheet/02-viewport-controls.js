// Shared-view pan and zoom interactions.
// The movement model intentionally follows the legacy presentation view:
// free one-finger/mouse translation and focal-point pinch/wheel scaling.

let sheetScale = 1;
let sheetX = 0;
let sheetY = 0;
let isPanning = false;
let panStartX = 0;
let panStartY = 0;
let panOriginX = 0;
let panOriginY = 0;
let lastPinchDist = 0;
let sheetUserAdjusted = false;

function getSheetTransformTarget() {
    return byId('sheet-content');
}

function applySheetTransform() {
    const content = getSheetTransformTarget();
    if (!content) return;
    content.style.zoom = '';
    content.style.transform = `translate(${sheetX}px, ${sheetY}px) scale(${sheetScale})`;
}

function getSheetContentWidth(content = getSheetTransformTarget()) {
    if (!content?.children.length) return 0;
    const previousTransform = content.style.transform;
    content.style.transform = 'none';
    const width = Math.max(
        ...Array.from(content.children).map(child => child.scrollWidth || child.offsetWidth || 0),
        content.scrollWidth || 0
    );
    content.style.transform = previousTransform;
    return width;
}

function getInitialSheetX(area, contentWidth, scale) {
    if (!area || area.clientWidth <= 640) return 0;
    return Math.max(0, Math.round((area.clientWidth - contentWidth * scale) / 2));
}

function fitInitialSheetScale() {
    const area = byId('sheet-view-area');
    const content = getSheetTransformTarget();
    if (!area || !content || !content.children.length) return;

    // The old implementation transformed the persistent canvas, so a re-render
    // kept the user's position. Reapply the same state to the replaced inner node.
    if (sheetUserAdjusted) {
        applySheetTransform();
        return;
    }

    const contentWidth = getSheetContentWidth(content);
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

D.addEventListener('DOMContentLoaded', () => {
    const area = byId('sheet-view-area');
    if (!area) return;

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

    area.addEventListener('mousedown', event => {
        if (event.button !== 0 || isSheetInteractiveTarget(event.target) || isSheetDragHandle(event.target)) return;
        markSheetAdjusted();
        isPanning = true;
        panStartX = event.clientX;
        panStartY = event.clientY;
        panOriginX = sheetX;
        panOriginY = sheetY;
        area.classList.add('is-panning');
        event.preventDefault();
    });

    D.addEventListener('mousemove', event => {
        if (!isPanning) return;
        sheetX = panOriginX + (event.clientX - panStartX);
        sheetY = panOriginY + (event.clientY - panStartY);
        applySheetTransform();
    });

    D.addEventListener('mouseup', () => {
        isPanning = false;
        area.classList.remove('is-panning');
    });

    area.addEventListener('wheel', event => {
        if (isSheetInteractiveTarget(event.target) || isSheetDragHandle(event.target)) return;
        event.preventDefault();
        markSheetAdjusted();
        const factor = event.deltaY < 0 ? 1.1 : 0.9;
        const rect = area.getBoundingClientRect();
        const focalX = event.clientX - rect.left;
        const focalY = event.clientY - rect.top;
        sheetX = focalX - (focalX - sheetX) * factor;
        sheetY = focalY - (focalY - sheetY) * factor;
        sheetScale = Math.max(0.3, Math.min(4, sheetScale * factor));
        applySheetTransform();
    }, { passive: false });

    area.addEventListener('touchstart', event => {
        if (isSheetInteractiveTarget(event.target) || isSheetDragHandle(event.target)) return;
        markSheetAdjusted();
        if (event.touches.length === 1) {
            isPanning = true;
            panStartX = event.touches[0].clientX;
            panStartY = event.touches[0].clientY;
            panOriginX = sheetX;
            panOriginY = sheetY;
            area.classList.add('is-panning');
        } else if (event.touches.length === 2) {
            isPanning = false;
            area.classList.remove('is-panning');
            lastPinchDist = Math.hypot(
                event.touches[0].clientX - event.touches[1].clientX,
                event.touches[0].clientY - event.touches[1].clientY
            );
        }
    }, { passive: true });

    area.addEventListener('touchmove', event => {
        if (isSheetInteractiveTarget(event.target) || isSheetDragHandle(event.target)) return;
        event.preventDefault();
        if (event.touches.length === 1 && isPanning) {
            sheetX = panOriginX + (event.touches[0].clientX - panStartX);
            sheetY = panOriginY + (event.touches[0].clientY - panStartY);
            applySheetTransform();
        } else if (event.touches.length === 2) {
            const dist = Math.hypot(
                event.touches[0].clientX - event.touches[1].clientX,
                event.touches[0].clientY - event.touches[1].clientY
            );
            if (lastPinchDist > 0) {
                const factor = dist / lastPinchDist;
                const rect = area.getBoundingClientRect();
                const centerX = (event.touches[0].clientX + event.touches[1].clientX) / 2 - rect.left;
                const centerY = (event.touches[0].clientY + event.touches[1].clientY) / 2 - rect.top;
                sheetX = centerX - (centerX - sheetX) * factor;
                sheetY = centerY - (centerY - sheetY) * factor;
                sheetScale = Math.max(0.3, Math.min(4, sheetScale * factor));
                applySheetTransform();
            }
            lastPinchDist = dist;
        }
    }, { passive: false });

    const finishTouch = () => {
        isPanning = false;
        lastPinchDist = 0;
        area.classList.remove('is-panning');
    };
    area.addEventListener('touchend', finishTouch, { passive: true });
    area.addEventListener('touchcancel', finishTouch, { passive: true });

    window.addEventListener('resize', () => {
        if (!sheetUserAdjusted) requestAnimationFrame(fitInitialSheetScale);
    });
});
