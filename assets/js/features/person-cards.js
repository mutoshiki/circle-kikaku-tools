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
    return `<span class="grade-badge ${gradeGenderClass(gender)}" data-grade="${n}">${n}年</span>`;
}

function addMember(n, m='', g='unknown', grade=0, parent=$('#waiting-list'), locked=false) {
    const name = String(n || '').trim();
    if(!name) return;
    
    const div = ce('div', 'member-card');
    div.dataset.name = name;
    div.dataset.gender = g;
    div.dataset.grade = grade;
    div.dataset.locked = locked;
    
    const safeName = escapeHtml(name);
    const safeMemo = escapeHtml(m || '');
    const gradeHtml = renderGradeBadge(grade, g);
    const genderHtml = genderBadgeHtml(g);
    div.innerHTML = `
        <div class="member-main-line">
            <div class="member-name-text">${safeName}</div>
            ${genderHtml}
            ${gradeHtml}
            <button type="button" class="member-menu-btn action-btn" title="メニュー" aria-label="メンバー操作メニュー"><i class="fas fa-ellipsis-vertical" aria-hidden="true"></i></button>
        </div>
        <div class="memo-popup" style="display:${m?'block':'none'}">${safeMemo}</div>
    `;
    parent.appendChild(div);
    if (!isRestoringCarPlans && !window.__suspendCardUpdateUi) updateUI();
    return div;
}
window.addMember = addMember;

function addCar(n, cap, mems=[], dm='', dg='unknown', dgrade=0) {
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
        <div class="driver-seat" data-gender="${dg}" data-name="${safeName}" data-grade="${dgrade || 0}">
            <div class="member-main-line driver-main-line">
                <div class="driver-name-disp fw-bold">${safeName}</div>
                ${driverGenderHtml}
                ${driverGradeHtml}
                <button type="button" class="driver-menu-btn action-btn" title="車出しメニュー" aria-label="車出し操作メニュー"><i class="fas fa-ellipsis-vertical" aria-hidden="true"></i></button>
            </div>
            <div class="memo-popup driver-memo-text" style="display:${dm?'block':'none'}">${safeMemo}</div>
        </div>
    `;
    for(let i=0; i<c; i++) slotsHtml += `<div class="seat-slot"></div>`;

    col.innerHTML = `
        <div class="car-box" data-capacity="${c}">
            <div class="car-header">
                <span class="car-name-label">${safeName}${groupSuffix}</span>
                <button type="button" class="capacity-badge capacity-edit-btn" data-action="edit-capacity" title="定員を変更" aria-label="定員を変更">
                    <span class="capacity-count">0/${c}</span><i class="fas fa-pen" aria-hidden="true"></i>
                </button>
                <button type="button" class="car-delete-btn car-return-btn action-btn delete-btn" title="車出しを解除して待機に戻す" aria-label="車出しを解除して待機に戻す">
                    <i class="fas fa-reply" aria-hidden="true"></i>
                </button>
            </div>
            <div class="car-layout-grid">${slotsHtml}</div>
        </div>
    `;
    $('#cars-container').appendChild(col);

    $$('.seat-slot', col).forEach((slot, i) => {
        setupSortable(slot);
        if(mems[i]) addMember(mems[i].name, mems[i].memo, mems[i].gender, mems[i].grade||0, slot, mems[i].locked);
    });
    if (!isRestoringCarPlans && !window.__suspendCardUpdateUi) updateUI();
}
window.addCar = addCar;

function editCapacity(el) {
    const box = el.closest('.car-box');
    handleEdit('capacity', { closest: (s) => s ? box.closest(s) : box, val: () => box.dataset.capacity });
};
window.editCapacity = editCapacity;
