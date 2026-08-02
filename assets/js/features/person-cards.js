// Person and car card rendering feature
// Owns member/driver badge HTML and card creation helpers.

function genderBadgeHtml(gender) {
    return '';
}

function gradeGenderClass(gender) {
    if (gender === 'male') return 'grade-male';
    if (gender === 'female') return 'grade-female';
    return 'grade-unknown';
}

function renderGradeBadge(grade, gender = 'unknown') {
    const n = parseInt(grade) || 0;
    if (n <= 0) return '';
    const gradeText = `${n}年`;
    const tagAttributes = window.SanpoTagTypes?.attributes('grade', gender, 'sm', gradeText) || 'type="gray" size="sm"';
    return `<cds-tag class="grade-badge carbon-display-tag ${gradeGenderClass(gender)}" data-grade="${n}" ${tagAttributes}>${gradeText}</cds-tag>`;
}

function renderPersonFlag(flag) {
    const value = normalizePersonFlag(flag);
    const labels = { blue: '青のしるし', purple: '紫のしるし', yellow: '黄のしるし', red: '赤のしるし', none: 'しるしなし' };
    return `<span class="person-flag" data-flag="${value}" title="${labels[value]}" aria-label="${labels[value]}"><span data-carbon-icon="flag" aria-hidden="true"></span></span>`;
}

function addMember(n, m='', g='unknown', grade=0, parent=$('#waiting-list'), locked=false, flag='none') {
    const name = String(n || '').trim();
    if(!name) return;
    
    const div = ce('div', 'member-card');
    div.dataset.name = name;
    div.dataset.gender = g;
    div.dataset.grade = grade;
    div.dataset.locked = locked;
    div.dataset.flag = normalizePersonFlag(flag);
    
    const safeName = escapeHtml(name);
    const safeMemo = escapeHtml(m || '');
    const gradeHtml = renderGradeBadge(grade, g);
    const genderHtml = genderBadgeHtml(g);
    div.innerHTML = `
        <div class="member-main-line">
            <div class="member-name-text">${safeName}</div>
            ${renderPersonFlag(flag)}
            ${genderHtml}
            ${gradeHtml}
            <cds-icon-button type="button" kind="ghost" size="lg" class="member-menu-btn action-btn" title="メニュー" aria-label="メンバー操作メニュー"><span data-carbon-icon="overflow-menu-vertical" slot="icon" aria-hidden="true"></span></cds-icon-button>
        </div>
        <div class="memo-popup" style="display:${m?'block':'none'}">${safeMemo}</div>
    `;
    parent.appendChild(div);
    if (!isRestoringCarPlans && !window.__suspendCardUpdateUi) updateUI();
    return div;
}
window.addMember = addMember;

function addCar(n, cap, mems=[], dm='', dg='unknown', dgrade=0, dflag='none') {
    const name = String(n || '').trim();
    const fallbackCapacity = typeof getDefaultGroupCapacityForActivePlan === 'function' ? getDefaultGroupCapacityForActivePlan() : 3;
    const c = getInt(cap) || fallbackCapacity;
    if(!name) return;

    const col = ce('div', 'col-12 col-md-6 col-lg-4');
    const safeName = escapeHtml(name);
    const safeMemo = escapeHtml(dm || '');
    const driverGradeHtml = renderGradeBadge(dgrade, dg);
    const driverGenderHtml = genderBadgeHtml(dg);
    const groupSuffix = typeof getActiveGroupSuffix === 'function' ? getActiveGroupSuffix() : '車';
    let slotsHtml = `
        <div class="driver-seat" data-gender="${dg}" data-name="${safeName}" data-grade="${dgrade || 0}" data-flag="${normalizePersonFlag(dflag)}">
            <div class="member-main-line driver-main-line">
                <div class="driver-name-disp ">${safeName}</div>
                ${renderPersonFlag(dflag)}
                ${driverGenderHtml}
                ${driverGradeHtml}
                <cds-icon-button type="button" kind="ghost" size="lg" class="driver-menu-btn action-btn" title="車出しメニュー" aria-label="車出し操作メニュー"><span data-carbon-icon="overflow-menu-vertical" slot="icon" aria-hidden="true"></span></cds-icon-button>
            </div>
            <div class="memo-popup driver-memo-text" style="display:${dm?'block':'none'}">${safeMemo}</div>
        </div>
    `;
    for(let i=0; i<c; i++) slotsHtml += `<div class="seat-slot"></div>`;

    col.innerHTML = `
        <div class="car-box" data-capacity="${c}">
            <div class="car-header">
                <span class="car-name-label">${safeName}${groupSuffix}</span>
                <cds-button type="button" kind="ghost" size="lg" class="capacity-badge capacity-edit-btn" data-action="edit-capacity" title="定員を変更" aria-label="定員を変更">
                    <span class="capacity-count">0/${c}</span><span data-carbon-icon="edit" aria-hidden="true"></span>
                </cds-button>
                <cds-icon-button type="button" kind="danger--ghost" size="lg" class="car-delete-btn car-return-btn action-btn delete-btn" title="車出しを解除して待機に戻す" aria-label="車出しを解除して待機に戻す">
                    <span data-carbon-icon="undo" aria-hidden="true"></span>
                </cds-icon-button>
            </div>
            <div class="car-layout-grid">${slotsHtml}</div>
        </div>
    `;
    $('#cars-container').appendChild(col);

    $$('.seat-slot', col).forEach((slot, i) => {
        setupSortable(slot);
        if(mems[i]) addMember(mems[i].name, mems[i].memo, mems[i].gender, mems[i].grade||0, slot, mems[i].locked, mems[i].flag);
    });
    if (!isRestoringCarPlans && !window.__suspendCardUpdateUi) updateUI();
}
window.addCar = addCar;
window.normalizePersonFlag = normalizePersonFlag;
window.renderPersonFlag = renderPersonFlag;

function editCapacity(el) {
    const box = el.closest('.car-box');
    handleEdit('capacity', { closest: (s) => s ? box.closest(s) : box, val: () => box.dataset.capacity });
};
window.editCapacity = editCapacity;
