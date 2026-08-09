// Batch import feature
// Owns participant registration modal reset, Google Forms paste reflection, and bulk import execution.

function getBatchNameNormalizer() {
    return window.SanpoFormImportParser?.normalizeNameForCompare || (value => String(value || '').replace(/[\s\u3000\t\r\n]+/g, '').trim());
}

function cleanBatchDisplayName(value) {
    return String(value || '').replace(/　/g, ' ').replace(/\s+/g, ' ').trim();
}

function setBatchPreviewVisible(html, tone = 'info') {
    const preview = byId('googleFormImportPreview');
    if (!preview) return;
    preview.className = `form-import-preview form-import-preview--${tone}`;
    preview.hidden = false;
    preview.innerHTML = html;
}

function clearBatchPasteUi() {
    const pasteArea = byId('googleFormPasteArea');
    const preview = byId('googleFormImportPreview');
    if (pasteArea) pasteArea.value = '';
    if (preview) {
        preview.hidden = true;
        preview.innerHTML = '';
        preview.className = 'form-import-preview';
    }
}

function hasManualBatchFieldContent() {
    return ['batchMembers', 'batchGrade1', 'batchGrade2', 'batchGrade3', 'batchGrade4', 'batchDrivers']
        .some(id => trimBatchFieldValue(id));
}

function trimBatchFieldValue(id) {
    return String(byId(id)?.value || '').trim();
}

function renderGoogleFormImportPreview(result, reflected = false) {
    const counts = result.counts || { total: 0, grade1: 0, grade2: 0, grade3: 0, grade4: 0, noGrade: 0, drivers: 0 };
    const warnings = [
        ...(result.errors || []),
        ...(result.warnings || [])
    ];
    const warningHtml = warnings.length
        ? `<div class="form-import-warnings"><div class="form-import-warnings-title"><span data-carbon-icon="warning--alt" aria-hidden="true"></span>確認してください</div><ul>${warnings.map(w => `<li>${escapeHtml(w)}</li>`).join('')}</ul></div>`
        : '<div class="form-import-ok"><span data-carbon-icon="checkmark--filled" aria-hidden="true"></span>大きな警告はありません。</div>';
    const reflectedHtml = reflected
        ? '<div class="form-import-reflected"><span data-carbon-icon="arrow--down" aria-hidden="true"></span>既存の入力欄へ反映しました。内容を確認してから「登録内容で更新」を押してください。</div>'
        : '';
    const gradeSourceText = result.gradeSource === 'studentId'
        ? '学籍番号から推定'
        : (result.gradeSource === 'grade' ? '学年列を使用' : '学年列なし');
    const gradeSourceKey = ['studentId', 'grade'].includes(result.gradeSource) ? result.gradeSource : 'none';
    const gradeSourceTagAttributes = window.SanpoTagTypes?.attributes('importSource', gradeSourceKey, 'sm') || 'type="gray" size="sm"';

    return `
        <div class="form-import-preview-title">読み取り結果（登録前の確認）</div>
        <div class="form-import-result-grid">
            <div><span>参加者</span><strong>${counts.total || 0}名</strong></div>
            <div><span>1年生</span><strong>${counts.grade1 || 0}名</strong></div>
            <div><span>2年生</span><strong>${counts.grade2 || 0}名</strong></div>
            <div><span>3年生</span><strong>${counts.grade3 || 0}名</strong></div>
            <div><span>4年生</span><strong>${counts.grade4 || 0}名</strong></div>
            <div><span>学年なし</span><strong>${counts.noGrade || 0}名</strong></div>
            <div><span>車出し</span><strong>${counts.drivers || 0}名</strong></div>
        </div>
        <div class="form-import-column-list">
            <div>名前列：${escapeHtml(result.columnText?.name || 'なし')}</div>
            <div>学年：${escapeHtml(result.columnText?.grade || 'なし')}<cds-tag class="form-import-source-chip carbon-display-tag" ${gradeSourceTagAttributes}>${escapeHtml(gradeSourceText)}</cds-tag></div>
            <div>学籍番号列：${escapeHtml(result.columnText?.studentId || 'なし')}</div>
            <div>車出し列：${escapeHtml(result.columnText?.driver || 'なし')}</div>
        </div>
        ${reflectedHtml}
        ${warningHtml}
    `;
}

function reflectGoogleFormImportResult(result) {
    const groups = result.groups || {};
    byId('batchMembers').value = (groups.members || []).join('\n');
    byId('batchGrade1').value = (groups.grade1 || []).join('\n');
    byId('batchGrade2').value = (groups.grade2 || []).join('\n');
    byId('batchGrade3').value = (groups.grade3 || []).join('\n');
    byId('batchGrade4').value = (groups.grade4 || []).join('\n');
    byId('batchDrivers').value = (groups.drivers || []).join('\n');

    const warning = byId('batchDuplicateWarning');
    if (warning) {
        warning.hidden = true;
        warning.textContent = '';
    }
}

async function applyGoogleFormPasteImport() {
    const parser = window.SanpoFormImportParser;
    const pasteArea = byId('googleFormPasteArea');
    if (!parser || !pasteArea) return;

    const result = parser.parseSpreadsheetImport(pasteArea.value);
    if (!result.ok) {
        setBatchPreviewVisible(renderGoogleFormImportPreview(result, false), 'error');
        return;
    }
    if (!result.people.length) {
        const emptyResult = {
            ...result,
            errors: ['名前が入っている回答行が見つかりません。'],
            counts: result.counts || {}
        };
        setBatchPreviewVisible(renderGoogleFormImportPreview(emptyResult, false), 'error');
        return;
    }

    if (hasManualBatchFieldContent()) {
        const confirmed = await appConfirm('既存の参加者登録欄に内容があります。自動判別した内容で入力欄を上書きしますか？\n登録はまだ実行されません。内容を確認してから「登録内容で更新」を押してください。', {
            title: '入力欄を上書きしますか？',
            okText: '上書きして読み込む'
        });
        if (!confirmed) {
            setBatchPreviewVisible(renderGoogleFormImportPreview(result, false), 'info');
            return;
        }
    }

    reflectGoogleFormImportResult(result);
    setBatchPreviewVisible(renderGoogleFormImportPreview(result, true), result.warnings?.length ? 'warning' : 'success');
}
window.SanpoApp?.exposeCompat?.('applyGoogleFormPasteImport', applyGoogleFormPasteImport);

function openBatchModal() {
    const canonical = window.SanpoCanonicalState?.get?.();
    const participants = canonical?.participants || {};
    const carAllocation = canonical?.allocations?.car;
    const driverIds = new Set(Object.values(carAllocation?.groups || {}).map(group => group?.ownerId).filter(Boolean));
    const members = [];
    const grade1 = [], grade2 = [], grade3 = [], grade4 = [];
    const drivers = [];

    const pushGradeName = (name, grade) => {
        if (grade === 1) grade1.push(name);
        else if (grade === 2) grade2.push(name);
        else if (grade === 3) grade3.push(name);
        else if (grade === 4) grade4.push(name);
        else members.push(name);
    };

    Object.entries(participants).forEach(([id, participant]) => {
        if (!participant?.name) return;
        pushGradeName(participant.name, parseInt(participant.grade) || 0);
        if (driverIds.has(id)) drivers.push(participant.name);
    });

    $('#batchMembers').value = members.join('\n');
    $('#batchGrade1').value = grade1.join('\n');
    $('#batchGrade2').value = grade2.join('\n');
    $('#batchGrade3').value = grade3.join('\n');
    $('#batchGrade4').value = grade4.join('\n');
    $('#batchDrivers').value = drivers.join('\n');
    clearBatchPasteUi();
    modals.batch.show();
}
window.SanpoApp?.exposeCompat?.('openBatchModal', openBatchModal);

function getBatchFieldLines(selector) {
    return $(selector).value.split(/\n/).map(cleanBatchDisplayName).filter(Boolean);
}

function collectManualBatchEntries() {
    const fields = [
        { id: '#batchMembers', group: '同乗者', type: 'member', grade: 0 },
        { id: '#batchGrade1', group: '1年生', type: 'grade', grade: 1 },
        { id: '#batchGrade2', group: '2年生', type: 'grade', grade: 2 },
        { id: '#batchGrade3', group: '3年生', type: 'grade', grade: 3 },
        { id: '#batchGrade4', group: '4年生', type: 'grade', grade: 4 },
        { id: '#batchDrivers', group: '車出し', type: 'driver', grade: null }
    ];
    const normalize = getBatchNameNormalizer();
    return fields.flatMap(field => getBatchFieldLines(field.id).map(name => ({
        ...field,
        name,
        normalizedName: normalize(name)
    }))).filter(entry => entry.normalizedName);
}

function findManualBatchIssues(entries) {
    const grouped = new Map();
    entries.forEach(entry => {
        if (!grouped.has(entry.normalizedName)) grouped.set(entry.normalizedName, []);
        grouped.get(entry.normalizedName).push(entry);
    });

    const blocking = [];
    const warnings = [];
    grouped.forEach(items => {
        const displayNames = Array.from(new Set(items.map(item => item.name)));
        const firstName = displayNames[0];
        const groups = items.map(item => item.group);
        const uniqueGroups = Array.from(new Set(groups));
        const duplicatedGroups = uniqueGroups.filter(group => groups.filter(g => g === group).length > 1);
        const nonDriverGroups = items.filter(item => item.type !== 'driver').map(item => item.group);
        const uniqueNonDriverGroups = Array.from(new Set(nonDriverGroups));
        const driverCount = items.filter(item => item.type === 'driver').length;

        duplicatedGroups.forEach(group => blocking.push(`${firstName}：${group}欄の中で重複しています。`));
        if (uniqueNonDriverGroups.length > 1) {
            blocking.push(`${firstName}：${uniqueNonDriverGroups.join('・')}に重複しています。学年欄同士、または同乗者欄と学年欄の重複を直してください。`);
        }
        if (driverCount > 1) blocking.push(`${firstName}：車出し欄の中で重複しています。`);
        if (displayNames.length > 1) {
            warnings.push(`${displayNames.join(' / ')}：表記ゆれの可能性があります。空白の違いを確認してください。`);
        }
    });
    return { blocking, warnings };
}

function showBatchDuplicateWarning(messages, title = '重複の可能性があります') {
    const warning = byId('batchDuplicateWarning');
    const titleEl = byId('batchDuplicateWarningTitle');
    const bodyEl = byId('batchDuplicateWarningBody');
    if (!warning || !titleEl || !bodyEl) return;
    if (!messages.length) {
        warning.hidden = true;
        bodyEl.replaceChildren();
        return;
    }
    warning.kind = title.includes('表記ゆれ') ? 'warning' : 'error';
    warning.setAttribute('kind', warning.kind);
    titleEl.textContent = title;
    const list = document.createElement('ul');
    messages.forEach(message => {
        const item = document.createElement('li');
        item.textContent = message;
        list.appendChild(item);
    });
    bodyEl.replaceChildren(list);
    warning.hidden = false;
}

async function executeBatch() {
    const normalize = getBatchNameNormalizer();
    const m = getBatchFieldLines('#batchMembers');
    const g1 = getBatchFieldLines('#batchGrade1');
    const g2 = getBatchFieldLines('#batchGrade2');
    const g3 = getBatchFieldLines('#batchGrade3');
    const g4 = getBatchFieldLines('#batchGrade4');
    const d = getBatchFieldLines('#batchDrivers');
    const allEntries = collectManualBatchEntries();
    const batchIssues = findManualBatchIssues(allEntries);
    const noticeMessages = [...batchIssues.blocking, ...batchIssues.warnings];
    showBatchDuplicateWarning(noticeMessages, batchIssues.blocking.length ? '重複の可能性があります' : '表記ゆれの可能性があります');
    if (batchIssues.blocking.length) {
        await appAlert(batchIssues.blocking.join('\n') + '\n重複を直してから登録してください。\n※学年欄 + 車出し欄の同じ名前は正常扱いです。', { title: '重複があります' });
        return;
    }
    if (batchIssues.warnings.length) {
        const proceed = await appConfirm(batchIssues.warnings.join('\n') + '\nこのまま登録してもよいですか？', {
            title: '表記ゆれの確認',
            okText: 'このまま登録'
        });
        if (!proceed) return;
    }

    const canonical = window.SanpoCanonicalState?.get?.() || window.SanpoCanonicalState?.set?.({});
    const oldParticipants = { ...(canonical.participants || {}) };
    const oldByName = new Map(Object.entries(oldParticipants).map(([id, participant]) => [normalize(participant?.name), { id, participant }]));
    const gradeMap = new Map();
    g1.forEach(name => gradeMap.set(normalize(name), 1));
    g2.forEach(name => gradeMap.set(normalize(name), 2));
    g3.forEach(name => gradeMap.set(normalize(name), 3));
    g4.forEach(name => gradeMap.set(normalize(name), 4));
    m.forEach(name => { if (!gradeMap.has(normalize(name))) gradeMap.set(normalize(name), 0); });

    const requestedNames = [];
    [...m, ...g1, ...g2, ...g3, ...g4, ...d].forEach(name => {
        const key = normalize(name);
        if (key && !requestedNames.some(item => item.key === key)) requestedNames.push({ key, name });
    });
    // Deleted participant ids are reserved forever for this room. Participant ids are
    // the foreign keys used by allocations and settlement, so reusing a tombstoned id
    // would let a delayed write from an old phone attach itself to a newly registered
    // person with the same display name. Reserve tombstones while allocating ids, then
    // record every roster removal before replacing the participant master.
    const tombstones = canonical.participantTombstones || (canonical.participantTombstones = {});
    const newParticipants = {};
    const tombstonePlaceholders = new Set(Object.keys(tombstones));
    tombstonePlaceholders.forEach(id => {
        newParticipants[id] = { id, name: '__deleted__', updatedAt: Number(tombstones[id]?.deletedAt || 0) };
    });
    const newParticipantIds = [];
    requestedNames.forEach(({ key, name }) => {
        const previous = oldByName.get(key);
        const existing = previous?.participant || {};
        const id = window.SanpoCanonicalState.ensureParticipant(newParticipants, {
            name,
            memo: existing.memo || '',
            gender: existing.gender || 'unknown',
            grade: gradeMap.get(key) || existing.grade || 0,
            locked: !!existing.locked,
            flag: normalizePersonFlag(existing.flag)
        }, previous?.id || '');
        if (!previous && id) newParticipantIds.push(id);
    });
    tombstonePlaceholders.forEach(id => {
        if (newParticipants[id]?.name === '__deleted__') delete newParticipants[id];
    });
    const deletionTime = Date.now();
    Object.keys(oldParticipants).forEach(id => {
        if (!newParticipants[id]) tombstones[id] = { deletedAt: deletionTime };
    });
    canonical.participants = newParticipants;

    const driverIds = new Set(d.map(name => window.SanpoCanonicalState.findParticipantIdByName(newParticipants, name)).filter(Boolean));
    const carAllocation = canonical.allocations?.car || { id: 'plan-car', type: 'car', name: '車割', groups: {}, placements: {}, lastAutoAssignLabel: '' };
    const existingGroups = carAllocation.groups || {};
    const existingPlacements = carAllocation.placements || {};
    const nextGroups = {};
    const nextPlacements = {};
    let groupOrder = 0;

    driverIds.forEach(id => {
        const existingGroup = Object.values(existingGroups).find(group => group?.ownerId === id);
        const groupId = existingGroup?.id || `g_car_${id}`;
        nextGroups[groupId] = {
            id: groupId,
            ownerId: id,
            capacity: Math.max(1, parseInt(existingGroup?.capacity) || 3),
            order: groupOrder++,
            createdAt: Number(existingGroup?.createdAt || Date.now()),
            updatedAt: Date.now()
        };
        nextPlacements[id] = { kind: 'driver', groupId, order: nextGroups[groupId].order, updatedAt: Date.now() };
    });

    let waitingOrder = 0;
    Object.keys(newParticipants).forEach(id => {
        if (driverIds.has(id)) return;
        const previous = existingPlacements[id];
        const previousGroup = previous?.groupId && nextGroups[previous.groupId];
        if (previous?.kind === 'member' && previousGroup) {
            nextPlacements[id] = { kind: 'member', groupId: previous.groupId, order: Number(previous.order) || 0, updatedAt: Date.now() };
        } else {
            nextPlacements[id] = { kind: 'waiting', groupId: '', order: waitingOrder++, updatedAt: Date.now() };
        }
    });
    carAllocation.groups = nextGroups;
    carAllocation.placements = nextPlacements;
    carAllocation.updatedAt = Date.now();
    canonical.allocations.car = carAllocation;

    // 班割は同じ参加者マスターを参照するだけ。削除されたIDを除き、新規参加者だけ未割り当てへ加える。
    window.SanpoCanonicalState.ensureAllParticipantsPlaced(canonical.allocations.team, newParticipants);
    canonical.settlement = window.SanpoCanonicalState.settlementToStorage(
        window.SanpoCanonicalState.settlementToUi(canonical.settlement || {}, oldParticipants),
        newParticipants
    );

    carPlans = window.SanpoCanonicalState.projectPlans(canonical);
    renderActiveCarPlanToDom();
    updateUI();
    save();
    modals.batch.hide({ reason: 'submit' });
    window.markParticipantRegistrationGuidanceReady?.();

    // New participants are visible in either allocation because both project the same roster.
    newParticipantIds.forEach(id => {
        const name = newParticipants[id]?.name;
        if (name) detectGender(name);
    });
}
window.SanpoApp?.exposeCompat?.('executeBatch', executeBatch);
