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
    preview.style.display = 'block';
    preview.innerHTML = html;
}

function clearBatchPasteUi() {
    const pasteArea = byId('googleFormPasteArea');
    const preview = byId('googleFormImportPreview');
    if (pasteArea) pasteArea.value = '';
    if (preview) {
        preview.style.display = 'none';
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
        ? `<div class="form-import-warnings"><div class="form-import-warnings-title"><i class="fas fa-triangle-exclamation" aria-hidden="true"></i>確認してください</div><ul>${warnings.map(w => `<li>${escapeHtml(w)}</li>`).join('')}</ul></div>`
        : '<div class="form-import-ok"><i class="fas fa-circle-check" aria-hidden="true"></i>大きな警告はありません。</div>';
    const reflectedHtml = reflected
        ? '<div class="form-import-reflected"><i class="fas fa-arrow-down" aria-hidden="true"></i>既存の入力欄へ反映しました。内容を確認してから「登録内容で更新」を押してください。</div>'
        : '';
    const gradeSourceText = result.gradeSource === 'studentId'
        ? '学籍番号から推定'
        : (result.gradeSource === 'grade' ? '学年列を使用' : '学年列なし');

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
            <div>学年：${escapeHtml(result.columnText?.grade || 'なし')}<span class="form-import-source-chip">${escapeHtml(gradeSourceText)}</span></div>
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
        warning.style.display = 'none';
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
window.applyGoogleFormPasteImport = applyGoogleFormPasteImport;

window.openBatchModal = () => {
    const data = getData();
    
    let members = [];
    let grade1 = [], grade2 = [], grade3 = [], grade4 = [];
    let drivers = [];

    function pushGradeName(name, grade) {
        if (grade === 1) grade1.push(name);
        else if (grade === 2) grade2.push(name);
        else if (grade === 3) grade3.push(name);
        else if (grade === 4) grade4.push(name);
        else members.push(name);
    }

    data.waiting.forEach(m => pushGradeName(m.name, m.grade));

    data.cars.forEach(c => {
        drivers.push(c.name);
        if (c.driverGrade) pushGradeName(c.name, parseInt(c.driverGrade) || 0);
        c.members.forEach(m => {
            if(m && m.name) pushGradeName(m.name, m.grade);
        });
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
    if (!warning) return;
    if (!messages.length) {
        warning.style.display = 'none';
        warning.textContent = '';
        return;
    }
    warning.style.display = 'block';
    warning.innerHTML = `<div class="batch-warning-title">${escapeHtml(title)}</div><ul>${messages.map(message => `<li>${escapeHtml(message)}</li>`).join('')}</ul>`;
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
    
    const currentData = getData();
    
    const existingMembers = new Map();
    const existingDrivers = new Map();
    const memberLocations = new Map();

    currentData.waiting.forEach(mem => {
        const key = normalize(mem.name);
        existingMembers.set(key, mem);
        memberLocations.set(key, {type: 'waiting'});
    });

    currentData.cars.forEach(car => {
        const carKey = normalize(car.name);
        existingDrivers.set(carKey, car);
        car.members.forEach((mem, index) => {
             if(mem && mem.name) {
                 const key = normalize(mem.name);
                 existingMembers.set(key, mem);
                 memberLocations.set(key, {type: 'car', carName: car.name, slot: index});
             }
        });
    });

    const newDriversList = new Set(d.map(normalize));

    $('#waiting-list').innerHTML = '';
    $('#cars-container').innerHTML = '';

    const gradeMap = new Map();
    g1.forEach(n => gradeMap.set(normalize(n), 1));
    g2.forEach(n => gradeMap.set(normalize(n), 2));
    g3.forEach(n => gradeMap.set(normalize(n), 3));
    g4.forEach(n => gradeMap.set(normalize(n), 4));
    m.forEach(n => { if(!gradeMap.has(normalize(n))) gradeMap.set(normalize(n), 0); });

    d.forEach(driverName => {
        const key = normalize(driverName);
        const driverGrade = gradeMap.get(key) || 0;
        if(existingDrivers.has(key)) {
            const oldCar = existingDrivers.get(key);
            addCar(driverName, oldCar.capacity, [], oldCar.driverMemo, oldCar.driverGender, driverGrade || oldCar.driverGrade || 0);
        } else {
            addCar(driverName, (typeof getDefaultGroupCapacityForActivePlan === 'function' ? getDefaultGroupCapacityForActivePlan() : 3), [], '', 'unknown', driverGrade);
            detectGender(driverName);
        }
    });

    const carBoxes = Array.from($$('.car-box'));
    const gradeNames = [...m, ...g1, ...g2, ...g3, ...g4]
        .filter(name => !newDriversList.has(normalize(name)));

    gradeNames.forEach(name => {
        placeMember(name, gradeMap.get(normalize(name)) || 0);
    });

    function placeMember(name, grade) {
        const key = normalize(name);
        if (existingMembers.has(key)) {
            const oldData = existingMembers.get(key);
            const loc = memberLocations.get(key);
            oldData.grade = grade;

            if (loc.type === 'car' && newDriversList.has(normalize(loc.carName))) {
                const targetCarBox = carBoxes.find(b => normalize($('.driver-name-disp', b).innerText) === normalize(loc.carName));
                if (targetCarBox) {
                    const slots = $$('.seat-slot', targetCarBox);
                    if(slots[loc.slot] && slots[loc.slot].children.length === 0) {
                        addMember(name, oldData.memo, oldData.gender, grade, slots[loc.slot], oldData.locked);
                    } else {
                        const emptySlot = Array.from(slots).find(s => s.children.length === 0);
                        if(emptySlot) {
                             addMember(name, oldData.memo, oldData.gender, grade, emptySlot, oldData.locked);
                        } else {
                             addMember(name, oldData.memo, oldData.gender, grade, $('#waiting-list'), oldData.locked);
                        }
                    }
                } else {
                     addMember(name, oldData.memo, oldData.gender, grade, $('#waiting-list'), oldData.locked);
                }
            } else {
                addMember(name, oldData.memo, oldData.gender, grade, $('#waiting-list'), oldData.locked);
            }
        } else {
            addMember(name, '', 'unknown', grade, $('#waiting-list'));
            detectGender(name);
        }
    }

    save(); 
    modals.batch.hide();
}
window.executeBatch = executeBatch;
