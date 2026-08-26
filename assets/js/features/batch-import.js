// Batch import feature
// Owns participant registration modal reset, Google Forms paste reflection, and bulk import execution.

let batchOpeningCanonicalSnapshot = null;

function cloneBatchCanonical(value) {
    return JSON.parse(JSON.stringify(value ?? null));
}

function getBatchParticipantIndex(canonical = {}) {
    const normalize = getBatchNameNormalizer();
    return new Map(Object.entries(canonical.participants || {}).map(([id, participant]) => [normalize(participant?.name), { id, participant }]));
}

function getBatchDriverIds(canonical = {}) {
    return new Set(Object.entries(canonical.allocations?.car?.placements || {})
        .filter(([, placement]) => placement?.driver === true)
        .map(([id]) => id));
}

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
    const driverIds = new Set(Object.entries(carAllocation?.placements || {})
        .filter(([, placement]) => placement?.driver === true)
        .map(([id]) => id));
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
    // Capture the collaborative base represented by the fields. Submit computes *intent*
    // against this snapshot instead of replacing the room roster/allocation wholesale. Remote
    // additions and unrelated card moves made while this modal is open therefore survive.
    batchOpeningCanonicalSnapshot = cloneBatchCanonical(canonical);
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
    const opening = batchOpeningCanonicalSnapshot || cloneBatchCanonical(canonical) || {};
    const openingByName = getBatchParticipantIndex(opening);
    const openingDrivers = getBatchDriverIds(opening);
    const gradeMap = new Map();
    g1.forEach(name => gradeMap.set(normalize(name), 1));
    g2.forEach(name => gradeMap.set(normalize(name), 2));
    g3.forEach(name => gradeMap.set(normalize(name), 3));
    g4.forEach(name => gradeMap.set(normalize(name), 4));
    m.forEach(name => { if (!gradeMap.has(normalize(name))) gradeMap.set(normalize(name), 0); });

    const requestedNames = [];
    // The participant/grade fields are the master roster. `車出し` is only a
    // role selector for people who are still on that roster; leaving an old name
    // in the driver field must not silently keep a participant the user deleted.
    [...m, ...g1, ...g2, ...g3, ...g4].forEach(name => {
        const key = normalize(name);
        if (key && !requestedNames.some(item => item.key === key)) requestedNames.push({ key, name });
    });
    const requestedByKey = new Map(requestedNames.map(item => [item.key, item]));
    const requestedDriverKeys = new Set(d.map(normalize).filter(Boolean));
    const now = (window.SanpoClock?.now?.() ?? Date.now());
    const newParticipantIds = [];

    // Participant registration is a three-way intent editor. Only people that were visible in
    // the opening snapshot and were explicitly removed are deleted. A participant another
    // phone added while this modal was open is absent from both the opening form and this
    // client's patch, so Firebase keeps that remote participant.
    openingByName.forEach(({ id }, key) => {
        if (requestedByKey.has(key)) return;
        window.SanpoCanonicalState?.deleteParticipant?.(id, { deletedAt: now });
    });

    requestedNames.forEach(({ key, name }) => {
        const openingEntry = openingByName.get(key);
        let id = openingEntry?.id || window.SanpoCanonicalState?.findParticipantIdByName?.(canonical.participants || {}, name) || '';
        if (!id) {
            id = window.SanpoCanonicalState.ensureParticipant(canonical.participants, {
                name, memo: '', gender: 'unknown', grade: gradeMap.get(key) || 0, locked: false, flag: 'none'
            }, '', canonical.participantTombstones || {});
            if (id) newParticipantIds.push(id);
            return;
        }
        const participant = canonical.participants?.[id];
        if (!participant) return;
        const desiredGrade = gradeMap.has(key) ? Number(gradeMap.get(key) || 0) : Number(participant.grade || 0);
        const cleanName = cleanBatchDisplayName(name);
        const openingParticipant = openingEntry?.participant || participant;
        const nameChanged = cleanBatchDisplayName(openingParticipant.name) !== cleanName;
        const gradeChanged = Number(openingParticipant.grade || 0) !== desiredGrade;
        if (nameChanged || gradeChanged) {
            canonical.participants[id] = { ...participant, id, name: cleanName, grade: desiredGrade, updatedAt: now };
        }
    });

    const carAllocation = canonical.allocations?.car;
    if (carAllocation) {
        carAllocation.groups = carAllocation.groups || {};
        carAllocation.placements = carAllocation.placements || {};
        let allocationChanged = false;
        const requestedDriverIds = new Set([...requestedDriverKeys].map(key => {
            // Resolve through the participant represented by the opening form first. A different
            // phone may rename that participant while this modal remains open; the unchanged
            // driver line still refers to the same participant ID, not a new/unknown name.
            const openingEntry = openingByName.get(key);
            if (openingEntry?.id && canonical.participants?.[openingEntry.id]) return openingEntry.id;
            const requested = requestedByKey.get(key);
            return requested ? window.SanpoCanonicalState.findParticipantIdByName(canonical.participants || {}, requested.name) : '';
        }).filter(Boolean));

        // Driver status is also intent-based: only a status that differs from the opening form
        // is changed. Unrelated remote moves/groups are not regenerated or timestamped.
        const openingParticipantIds = new Set(Object.keys(opening.participants || {}));
        const allRelevantIds = new Set([...openingParticipantIds, ...requestedDriverIds]);
        allRelevantIds.forEach(id => {
            if (!canonical.participants?.[id]) return;
            const wasDriver = openingDrivers.has(id);
            const wantsDriver = requestedDriverIds.has(id);
            if (wasDriver === wantsDriver) return;

            const ownedGroupEntry = Object.entries(carAllocation.groups).find(([, group]) => group?.ownerId === id);
            if (wantsDriver) {
                const groupId = ownedGroupEntry?.[0] || `g_car_${id}`;
                const previousGroup = ownedGroupEntry?.[1];
                carAllocation.groups[groupId] = previousGroup || {
                    id: groupId, ownerId: id, capacity: 3, order: Object.keys(carAllocation.groups).length, createdAt: now, updatedAt: now
                };
                if (previousGroup) carAllocation.groups[groupId] = { ...previousGroup, ownerId: id, updatedAt: now };
                carAllocation.placements[id] = { kind: 'member', driver: true, groupId, order: Number(carAllocation.groups[groupId].order || 0), updatedAt: now };
                allocationChanged = true;
                return;
            }

            if (ownedGroupEntry) {
                const [groupId] = ownedGroupEntry;
                delete carAllocation.groups[groupId];
                Object.entries(carAllocation.placements).forEach(([memberId, placement]) => {
                    if (placement?.groupId !== groupId || memberId === id) return;
                    carAllocation.placements[memberId] = { kind: 'waiting', driver: placement?.driver === true, groupId: '', order: Number.MAX_SAFE_INTEGER, updatedAt: now };
                });
            }
            carAllocation.placements[id] = { kind: 'waiting', driver: false, groupId: '', order: Number.MAX_SAFE_INTEGER, updatedAt: now };
            allocationChanged = true;
        });

        window.SanpoCanonicalState.ensureAllParticipantsPlaced(carAllocation, canonical.participants || {});
        if (allocationChanged) carAllocation.updatedAt = now;
    }
    window.SanpoCanonicalState.ensureAllParticipantsPlaced(canonical.allocations?.team, canonical.participants || {});
    canonical.settlement = window.SanpoCanonicalState.settlementToStorage(
        window.SanpoCanonicalState.settlementToUi(canonical.settlement || {}, canonical.participants || {}),
        canonical.participants || {}
    );

    carPlans = window.SanpoCanonicalState.projectPlans(canonical);
    // Canonical state is already complete.  Do not rebuild the allocation DOM underneath an
    // open Carbon modal before its footer click finishes; save the model first, close the modal,
    // then project the canonical state back to the screen.
    const previousSuspend = !!window.__suspendActiveDomPlanSync;
    window.__suspendActiveDomPlanSync = true;
    try { save(); }
    finally { window.__suspendActiveDomPlanSync = previousSuspend; }
    modals.batch.hide({ reason: 'submit' });
    batchOpeningCanonicalSnapshot = null;
    queueMicrotask(() => {
        renderActiveCarPlanToDom();
        updateUI();
    });
    window.markParticipantRegistrationGuidanceReady?.();
}
window.SanpoApp?.exposeCompat?.('executeBatch', executeBatch);
