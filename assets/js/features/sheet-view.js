// Sheet view feature
// Owns view switching, announcement sheet rendering, quick edit drag, pan and zoom.

let currentView = 'sheet';
async function switchView(view) {
    if (currentView === 'sheet' && view !== 'sheet' && quickEditMode && typeof completeQuickEdit === 'function') {
        completeQuickEdit({ showNotice: false, rerender: false });
    }
    if (view !== 'sheet' && editLockEnabled && !hasTrustedEditAccess()) {
        const label = view === 'seisan' ? '精算' : '編集';
        if (!(await verifyEditPassphrase(`${label}を開くには合言葉を入力してください`))) return;
    }
    currentView = view;
    document.body.classList.toggle('view-mode-list', view === 'list');
    document.body.classList.toggle('view-mode-sheet', view === 'sheet');
    document.body.classList.toggle('view-mode-seisan', view === 'seisan');
    const listArea = byId('top-area');
    const sheetArea = byId('sheet-view-area');
    const bottomTray = byId('bottom-tray');
    const tabList = byId('tab-list');
    const tabSheet = byId('tab-sheet');
    const tabSeisan = byId('tab-seisan');
    const seisanArea = byId('seisan-view-area');

    if (view === 'seisan') {
        document.body.classList.remove('sheet-mode');
        listArea.style.display = 'none';
        bottomTray.style.display = 'none';
        sheetArea.classList.remove('active');
        seisanArea.classList.add('active');
        tabList.classList.remove('active');
        tabSheet.classList.remove('active');
        tabSeisan.classList.add('active');
        updateQuickEditButton();
        renderSettlementView();
        return;
    }

    seisanArea.classList.remove('active');
    tabSeisan.classList.remove('active');

    if (view === 'sheet') {
        document.body.classList.add('sheet-mode');
        listArea.style.display = 'none';
        bottomTray.style.display = 'none';
        sheetArea.classList.add('active');
        tabList.classList.remove('active');
        tabSheet.classList.add('active');
        updateQuickEditButton();
        renderSheetView();
        showSheetHint();
    } else {
        document.body.classList.remove('sheet-mode');
        listArea.style.display = '';
        bottomTray.style.display = '';
        sheetArea.classList.remove('active');
        tabList.classList.add('active');
        tabSheet.classList.remove('active');
        updateQuickEditButton();
    }
}
window.switchView = switchView;

function showSheetHint() {
    const hint = byId('sheet-hint');
    hint.classList.add('visible');
    setTimeout(() => hint.classList.remove('visible'), 3000);
}

function isSheetDragHandle(target) {
    return quickEditMode && hasTrustedEditAccess() && !!target.closest('.sheet-chip.draggable, .sheet-dropzone, .sheet-waiting-list');
}

function isSheetInteractiveTarget(target) {
    return !!target?.closest?.('button, a, input, textarea, select, [role="button"]');
}

function renderSheetPlain(member) {
    return window.SanpoApp.templates.sheet.plainMember(member, { escapeHtml, renderGradeBadge });
}

function renderSheetChip(member) {
    return window.SanpoApp.templates.sheet.memberChip(member, {
        escapeHtml,
        renderGradeBadge,
        isDraggable: currentMember => !currentMember.locked && hasTrustedEditAccess() && quickEditMode
    });
}


function cleanupSheetEditArtifacts() {
    document.querySelectorAll('.manual-sheet-drag-float').forEach(node => node.remove());
    document.querySelectorAll('.manual-sheet-drag-source').forEach(node => node.classList.remove('manual-sheet-drag-source'));
    document.querySelectorAll('.drop-target').forEach(node => node.classList.remove('drop-target'));
    D.body.classList.remove('manual-sheet-dragging');
    if (manualSheetDrag) manualSheetDrag = null;
    isDraggingCards = false;
}
window.cleanupSheetEditArtifacts = cleanupSheetEditArtifacts;

function setupSheetSortables() {
    clearSheetSortables();
    // 発表ビューのクイック編集も setupManualSheetDrag() に一本化しています。
    // 旧 Sortable 実装はスクロール・ピンチ操作と競合するため、ここでは初期化しません。
    return null;
}


function renderSheetEmptyHtml() {
    return window.SanpoApp.templates.sheet.empty();
}

function createSheetLabelColumn(maxSeats, template) {
    const labelCol = document.createElement('div');
    labelCol.className = 'sheet-car-col sheet-label-col';
    labelCol.innerHTML = window.SanpoApp.templates.sheet.labelColumn(maxSeats, template);
    return labelCol;
}

function renderSheetCarColumnHtml(car, maxSeats, template, isEditablePlan, groupIndex = 0) {
    return window.SanpoApp.templates.sheet.carColumn({
        car,
        maxSeats,
        template,
        groupIndex,
        quickEditMode: quickEditMode && isEditablePlan,
        helpers: {
            escapeHtml,
            renderGradeBadge,
            isDraggable: currentMember => !currentMember.locked && hasTrustedEditAccess() && quickEditMode
        }
    });
}

function createSheetCarColumn(car, maxSeats, template, isEditablePlan, groupIndex = 0) {
    const col = document.createElement('div');
    col.className = 'sheet-car-col';
    col.innerHTML = renderSheetCarColumnHtml(car, maxSeats, template, isEditablePlan, groupIndex);
    return col;
}

function renderSheetWaitingHtml(data, isEditablePlan) {
    return window.SanpoApp.templates.sheet.waitingColumn({
        data,
        quickEditMode: quickEditMode && isEditablePlan,
        helpers: {
            escapeHtml,
            renderGradeBadge,
            isDraggable: currentMember => !currentMember.locked && hasTrustedEditAccess() && quickEditMode
        }
    });
}

function createSheetWaitingColumn(data, isEditablePlan) {
    const waitCol = document.createElement('div');
    waitCol.className = 'sheet-wait-block';
    waitCol.innerHTML = renderSheetWaitingHtml(data, isEditablePlan);
    return waitCol;
}

function createSheetPlanSection(plan, index) {
    const template = typeof getCarPlanTemplateConfig === 'function'
        ? getCarPlanTemplateConfig(plan)
        : { sectionTitle: '車割', ownerLabel: '車出し', memberLabel: '席', groupSuffix: '車', ownerIcon: 'fa-car' };
    const section = document.createElement('section');
    section.className = 'sheet-plan-section';
    section.dataset.planId = plan.id || `plan-${index}`;

    const displayName = String(plan.name || template.sectionTitle || '').trim() || template.sectionTitle;
    const heading = document.createElement('div');
    heading.className = 'sheet-plan-heading';
    heading.textContent = template.sectionTitle;
    section.appendChild(heading);

    const cars = Array.isArray(plan.cars) ? plan.cars : [];
    const waiting = Array.isArray(plan.waiting) ? plan.waiting : [];
    const isEditablePlan = true;

    if (cars.length) {
        const maxSeats = Math.max(1, ...cars.map(c => parseInt(c.capacity) || 0));
        const table = document.createElement('div');
        table.className = 'sheet-plan-table';
        // 発表ビューでは左端の行見出し列（車割 / 車出し / 席1...、班 / 班員1...）を出さず、
        // 各カード列を左端から並べる。
        cars.forEach((car, carIndex) => table.appendChild(createSheetCarColumn(car, maxSeats, template, isEditablePlan, carIndex)));
        section.appendChild(table);
    }

    if (waiting.length) {
        section.appendChild(createSheetWaitingColumn({ waiting }, isEditablePlan));
    }

    if (!cars.length && !waiting.length) {
        const empty = document.createElement('div');
        empty.className = 'sheet-plan-empty';
        empty.textContent = 'まだ配置がありません';
        section.appendChild(empty);
    }

    return section;
}


function getSheetTimetableItems() {
    const snapshot = window.SanpoOverview?.getSnapshot?.() || window.SanpoApp?.state?.getSnapshot?.()?.overview || {};
    const items = Array.isArray(snapshot.timetableItems) ? snapshot.timetableItems : [];
    return items
        .map(item => ({
            time: String(item?.time || '').trim(),
            title: String(item?.title || '').trim()
        }))
        .filter(item => item.time || item.title);
}

function linkifySheetTimetableText(value = '') {
    const text = String(value || '');
    const urlPattern = /https?:\/\/[^\s<>"]+/gi;
    let html = '';
    let lastIndex = 0;
    for (const match of text.matchAll(urlPattern)) {
        const url = match[0];
        const index = match.index || 0;
        html += escapeHtml(text.slice(lastIndex, index));
        try {
            const parsed = new URL(url);
            if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
                const safeUrl = escapeHtml(url);
                html += `<a class="sheet-timetable-link" href="${safeUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a>`;
            } else {
                html += escapeHtml(url);
            }
        } catch {
            html += escapeHtml(url);
        }
        lastIndex = index + url.length;
    }
    html += escapeHtml(text.slice(lastIndex));
    return html;
}

function createSheetTimetableEditRow(item = {}) {
    const time = escapeHtml(String(item?.time || '').slice(0, 5));
    const title = escapeHtml(String(item?.title || ''));
    return `
        <div class="sheet-timetable-edit-row">
            <input class="sheet-timetable-input time" type="time" data-field="time" value="${time}" aria-label="時刻">
            <input class="sheet-timetable-input title" type="text" data-field="title" value="${title}" placeholder="内容" aria-label="内容">
            <button class="sheet-timetable-delete" type="button" data-action="delete-sheet-timetable-row" aria-label="行を削除">
                <i class="fas fa-xmark" aria-hidden="true"></i>
            </button>
        </div>`;
}

function createSheetTimetableSection() {
    const items = getSheetTimetableItems();
    if (!quickEditMode && !items.length) return null;
    const section = document.createElement('section');
    section.className = 'sheet-plan-section sheet-timetable-section';
    if (quickEditMode) {
        const editItems = items.length ? items : [{ time: '', title: '' }];
        section.innerHTML = `
            <div class="sheet-plan-heading sheet-timetable-heading">タイムテーブル</div>
            <div class="sheet-timetable-card sheet-timetable-card--edit">
                <div class="sheet-timetable-edit-list">
                    ${editItems.map(item => createSheetTimetableEditRow(item)).join('')}
                </div>
                <button class="sheet-timetable-add" type="button" data-action="add-sheet-timetable-row">
                    <i class="fas fa-plus" aria-hidden="true"></i><span>行を追加</span>
                </button>
            </div>`;
        return section;
    }
    section.innerHTML = `
        <div class="sheet-plan-heading sheet-timetable-heading">タイムテーブル</div>
        <div class="sheet-timetable-card">
            ${items.map(item => `
                <div class="sheet-timetable-row">
                    <div class="sheet-timetable-time">${item.time ? escapeHtml(item.time) : '—'}</div>
                    <div class="sheet-timetable-title">${linkifySheetTimetableText(item.title)}</div>
                </div>
            `).join('')}
        </div>`;
    return section;
}

function getSheetTimetableDraftItems() {
    const rows = Array.from(document.querySelectorAll('.sheet-timetable-edit-row'));
    return rows.map(row => ({
        time: String(row.querySelector('[data-field="time"]')?.value || '').slice(0, 5),
        title: String(row.querySelector('[data-field="title"]')?.value || '').trim()
    })).filter(item => item.time || item.title);
}

function syncSheetTimetableToOverview() {
    const section = document.querySelector('.sheet-timetable-section');
    if (!section || !section.querySelector('.sheet-timetable-edit-row')) return;
    const current = window.SanpoOverview?.getSnapshot?.() || window.SanpoApp?.state?.getSnapshot?.()?.overview || {};
    const next = {
        ...current,
        timetableItems: getSheetTimetableDraftItems()
    };
    window.SanpoOverview?.applySnapshot?.(next, { skipRender: true });
}

function addSheetTimetableEditRow() {
    const list = document.querySelector('.sheet-timetable-edit-list');
    if (!list) return;
    list.insertAdjacentHTML('beforeend', createSheetTimetableEditRow());
    list.lastElementChild?.querySelector('[data-field="time"], [data-field="title"]')?.focus({ preventScroll: true });
}

function deleteSheetTimetableEditRow(button) {
    const list = button?.closest?.('.sheet-timetable-edit-list');
    const row = button?.closest?.('.sheet-timetable-edit-row');
    row?.remove();
    if (list && !list.querySelector('.sheet-timetable-edit-row')) {
        list.insertAdjacentHTML('beforeend', createSheetTimetableEditRow());
    }
}

function syncSheetPlanWidths() {
    let widestPlanWidth = 0;
    document.querySelectorAll('.sheet-plan-section:not(.sheet-timetable-section)').forEach(section => {
        const table = section.querySelector('.sheet-plan-table');
        const waitBlock = section.querySelector('.sheet-wait-block');
        if (!table || !waitBlock) return;
        const width = Math.ceil(table.scrollWidth || table.offsetWidth || 0);
        if (width > 0) {
            widestPlanWidth = Math.max(widestPlanWidth, width);
            section.style.setProperty('--sheet-plan-width', `${width}px`);
            waitBlock.style.width = `${width}px`;
        }
    });
    const canvas = byId('sheet-canvas');
    if (canvas && widestPlanWidth > 0) {
        canvas.style.setProperty('--sheet-plan-content-width', `${widestPlanWidth}px`);
    }
}

function renderSheetView() {
    // createSheetPlanSection() keeps using createSheetCarColumn and createSheetWaitingColumn.
    const canvas = byId('sheet-canvas');
    if (!canvas) return;
    if (!manualSheetDrag) cleanupSheetEditArtifacts();
    clearSheetSortables();
    canvas.innerHTML = '';
    updateQuickEditButton();
    const data = getData({ skipDomSync: true });
    updateSheetSummary(data);

    const plans = typeof getCarPlansSnapshot === 'function' ? getCarPlansSnapshot({ skipDomSync: true }) : [data];
    const visiblePlans = plans.filter(plan => (plan.cars || []).length || (plan.waiting || []).length);

    if (!visiblePlans.length) {
        canvas.innerHTML = renderSheetEmptyHtml();
        return;
    }

    visiblePlans
        .sort((a, b) => {
            const typeA = typeof normalizeCarPlanTemplateType === 'function' ? normalizeCarPlanTemplateType(a.templateType) : 'car';
            const typeB = typeof normalizeCarPlanTemplateType === 'function' ? normalizeCarPlanTemplateType(b.templateType) : 'car';
            return (typeA === 'car' ? 0 : 1) - (typeB === 'car' ? 0 : 1);
        })
        .forEach((plan, index) => canvas.appendChild(createSheetPlanSection(plan, index)));
    const timetableSection = createSheetTimetableSection();
    if (timetableSection) canvas.appendChild(timetableSection);
    syncSheetPlanWidths();
    requestAnimationFrame(syncSheetPlanWidths);
    requestAnimationFrame(fitInitialSheetScale);

    setupSheetSortables();
}
