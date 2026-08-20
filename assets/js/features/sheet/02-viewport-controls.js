// Shared-view pan, zoom, and vertical-scroll affordances.
// Desktop retains the legacy direct manipulation canvas. Responsive layouts
// use the browser's native vertical scroll path instead of transformed panning.

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

function usesResponsiveSheetViewport(area = byId('sheet-view-area')) {
    return !!area && area.clientWidth < 1056;
}

function getSheetVerticalScrollHost(area = byId('sheet-view-area')) {
    if (!area) return null;
    return usesResponsiveSheetViewport(area) ? area : byId('sheet-canvas');
}

function updateSheetScrollAffordance(area = byId('sheet-view-area')) {
    if (!area) return;
    const host = getSheetVerticalScrollHost(area);
    if (!host || !area.classList.contains('active')) {
        area.classList.remove('sheet-has-more-below');
        return;
    }
    const maxScrollTop = Math.max(0, host.scrollHeight - host.clientHeight);
    const hasMoreBelow = maxScrollTop > 8 && host.scrollTop < maxScrollTop - 8;
    area.classList.toggle('sheet-has-more-below', hasMoreBelow);
}
window.updateSheetScrollAffordance = updateSheetScrollAffordance;

function syncSheetTimetableTextareaExpansion(host, forceActive = false) {
    if (!host?.matches?.('cds-textarea.sheet-timetable-input.title')) return;
    const value = String(host.value || host.getAttribute('value') || '');
    const shouldExpand = forceActive || value.includes('\n') || value.length > 18;
    host.classList.toggle('is-expanded', shouldExpand);
    host.rows = shouldExpand ? 4 : 1;
    host.setAttribute('rows', shouldExpand ? '4' : '1');
}

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
    if (!area) return 0;
    return Math.max(0, Math.round((area.clientWidth - contentWidth * scale) / 2));
}

function fitInitialSheetScale({ fitAll = false } = {}) {
    const area = byId('sheet-view-area');
    const content = getSheetTransformTarget();
    if (!area || !content || !content.children.length) return;

    if (usesResponsiveSheetViewport(area)) {
        sheetScale = 1;
        sheetX = 0;
        sheetY = 0;
        sheetUserAdjusted = false;
        area.classList.remove('sheet-needs-pan', 'sheet-fit-active', 'is-panning');
        content.style.zoom = '';
        content.style.transform = 'none';
        requestAnimationFrame(() => updateSheetScrollAffordance(area));
        return;
    }

    // The old implementation transformed the persistent canvas, so a re-render
    // kept the user's position. Reapply the same state to the replaced inner node.
    if (sheetUserAdjusted) {
        applySheetTransform();
        requestAnimationFrame(() => updateSheetScrollAffordance(area));
        return;
    }

    const contentWidth = getSheetContentWidth(content);
    const availableWidth = Math.max(0, area.clientWidth - 20);
    if (!contentWidth || !availableWidth) return;
    const isCompact = area.clientWidth <= 640;
    const maxScale = isCompact ? 0.9 : 1;
    const minScale = fitAll ? (isCompact ? 0.62 : 0.72) : (isCompact ? 0.9 : 0.84);
    const fitScale = availableWidth / contentWidth;
    sheetScale = Math.min(maxScale, Math.max(minScale, fitScale));
    sheetX = getInitialSheetX(area, contentWidth, sheetScale);
    sheetY = 0;
    area.classList.toggle('sheet-needs-pan', contentWidth * sheetScale > availableWidth + 4);
    area.classList.add('sheet-fit-active');
    applySheetTransform();
    requestAnimationFrame(() => updateSheetScrollAffordance(area));
}

function markSheetAdjusted() {
    sheetUserAdjusted = true;
    const area = byId('sheet-view-area');
    area?.classList.remove('sheet-fit-active');
}

D.addEventListener('DOMContentLoaded', () => {
    const area = byId('sheet-view-area');
    if (!area) return;

    const canvas = byId('sheet-canvas');
    const updateScrollAffordance = () => updateSheetScrollAffordance(area);
    area.addEventListener('scroll', updateScrollAffordance, { passive: true });
    canvas?.addEventListener('scroll', updateScrollAffordance, { passive: true });
    if (typeof ResizeObserver === 'function') {
        const scrollAffordanceObserver = new ResizeObserver(() => requestAnimationFrame(updateScrollAffordance));
        scrollAffordanceObserver.observe(area);
        if (canvas) scrollAffordanceObserver.observe(canvas);
    }
    requestAnimationFrame(updateScrollAffordance);

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
            // A newly-added empty row is an editing affordance, not persisted data.
            // Persisting it immediately normalizes the empty item away and re-renders
            // the sheet, making the row disappear before the user can type into it.
        }
        if (action === 'delete-sheet-timetable-row') {
            event.preventDefault();
            deleteSheetTimetableEditRow(event.target.closest('[data-action]'));
            syncSheetToMainData({ refresh: false, persist: true });
        }
    });

    area.addEventListener('focusin', event => {
        const titleField = event.target.closest?.('.sheet-timetable-input.title');
        if (titleField) syncSheetTimetableTextareaExpansion(titleField, true);
    });

    area.addEventListener('focusout', event => {
        const titleField = event.target.closest?.('.sheet-timetable-input.title');
        if (titleField) syncSheetTimetableTextareaExpansion(titleField, false);
    });

    area.addEventListener('input', event => {
        if (!event.target.closest?.('.sheet-timetable-input')) return;
        if (event.target.matches?.('.sheet-timetable-input.title')) syncSheetTimetableTextareaExpansion(event.target, true);
        if (event.isComposing) return;
        syncSheetTimetableToOverview();
        clearTimeout(window.__sheetTimetableSaveTimer);
        window.__sheetTimetableSaveTimer = setTimeout(() => {
            syncSheetToMainData({ refresh: false, persist: true });
        }, 250);
    });

    area.addEventListener('mousedown', event => {
        if (usesResponsiveSheetViewport(area) || event.button !== 0 || isSheetInteractiveTarget(event.target) || isSheetDragHandle(event.target)) return;
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
        if (usesResponsiveSheetViewport(area) || isSheetInteractiveTarget(event.target) || isSheetDragHandle(event.target)) return;
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
        if (usesResponsiveSheetViewport(area) || isSheetInteractiveTarget(event.target) || isSheetDragHandle(event.target)) return;
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
        if (usesResponsiveSheetViewport(area) || isSheetInteractiveTarget(event.target) || isSheetDragHandle(event.target)) return;
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
        requestAnimationFrame(updateScrollAffordance);
    });
});
