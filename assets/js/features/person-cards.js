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
    return `<span class="person-flag" data-flag="${value}" aria-label="${labels[value]}"><span data-carbon-icon="flag" aria-hidden="true"></span></span>`;
}

function renderPersonMenuIcon(icon) {
    return `<span data-carbon-icon="${icon}" slot="render-icon" aria-hidden="true"></span>`;
}

function renderPersonChoiceSubmenu({ label, icon, action, choices }) {
    return `<cds-menu-item class="person-pop-item person-pop-item--submenu" label="${escapeHtml(label)}">
        ${renderPersonMenuIcon(icon)}
        <cds-menu-item-group slot="submenu">
          ${choices.map(choice => `<cds-menu-item class="person-pop-item" label="${escapeHtml(choice.label)}" data-person-choice="${action}" data-choice-value="${escapeHtml(choice.value)}"${choice.flag ? ` data-flag-choice="${escapeHtml(choice.value)}"` : ''}>${renderPersonMenuIcon(choice.icon)}</cds-menu-item>`).join('')}
        </cds-menu-item-group>
      </cds-menu-item>`;
}

function renderPersonOverflowMenu({ name, isDriver = false, inWaiting = false, locked = false } = {}) {
    const safeLabel = escapeHtml(`${name || '参加者'}の操作`);
    const common = [
      `<cds-menu-item class="person-pop-item" label="メモ" data-person-action="memo">${renderPersonMenuIcon('notebook')}</cds-menu-item>`,
      renderPersonChoiceSubmenu({ label: 'しるし', icon: 'flag', action: 'flag', choices: [
        { value: 'none', label: 'しるしなし', icon: 'close--outline', flag: true },
        { value: 'blue', label: '青', icon: 'flag', flag: true },
        { value: 'purple', label: '紫', icon: 'flag', flag: true },
        { value: 'yellow', label: '黄', icon: 'flag', flag: true },
        { value: 'red', label: '赤', icon: 'flag', flag: true }
      ] })
    ];
    if (!isDriver) {
      common.push(`<cds-menu-item class="person-pop-item" label="${locked ? '固定解除' : '固定'}" data-person-action="lock">${renderPersonMenuIcon(locked ? 'unlocked' : 'locked')}</cds-menu-item>`);
      common.push(`<cds-menu-item class="person-pop-item" label="${inWaiting ? '削除' : '戻す'}" data-person-action="return" kind="${inWaiting ? 'danger' : 'default'}">${renderPersonMenuIcon(inWaiting ? 'trash-can' : 'undo')}</cds-menu-item>`);
    }
    common.push(renderPersonChoiceSubmenu({ label: '学年', icon: 'education', action: 'grade', choices: [
      { value: '0', label: '未設定', icon: 'subtract' },
      { value: '1', label: '1年', icon: 'number--1' },
      { value: '2', label: '2年', icon: 'number--2' },
      { value: '3', label: '3年', icon: 'number--3' },
      { value: '4', label: '4年', icon: 'number--4' }
    ] }));
    common.push(renderPersonChoiceSubmenu({ label: '性別', icon: 'user-multiple', action: 'gender', choices: [
      { value: 'male', label: '男性', icon: 'gender--male' },
      { value: 'female', label: '女性', icon: 'gender--female' },
      { value: 'unknown', label: '未設定', icon: 'help' }
    ] }));
    common.push(`<cds-menu-item class="person-pop-item" label="名前変更" data-person-action="name">${renderPersonMenuIcon('edit')}</cds-menu-item>`);
    return `<cds-overflow-menu type="button" kind="ghost" size="lg" class="${isDriver ? 'driver-menu-btn' : 'member-menu-btn'} person-overflow-menu action-btn" label="${safeLabel}" aria-label="${safeLabel}" enable-v12-overflowmenu enter-delay-ms="86400000" leave-delay-ms="0">
        <span data-carbon-icon="overflow-menu-vertical" slot="icon" aria-hidden="true"></span>
        <cds-menu class="person-pop-menu" aria-label="${safeLabel}">${common.join('')}</cds-menu>
      </cds-overflow-menu>`;
}
window.renderPersonOverflowMenu = renderPersonOverflowMenu;

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
            <div class="person-meta">${renderPersonFlag(flag)}${genderHtml}${gradeHtml}</div>
            ${renderPersonOverflowMenu({ name, isDriver: false, inWaiting: parent?.id === 'waiting-list', locked })}
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

    const col = ce('div', 'allocation-grid-item');
    const safeName = escapeHtml(name);
    const safeMemo = escapeHtml(dm || '');
    const driverGradeHtml = renderGradeBadge(dgrade, dg);
    const driverGenderHtml = genderBadgeHtml(dg);
    const groupSuffix = typeof getActiveGroupSuffix === 'function' ? getActiveGroupSuffix() : '車';
    let slotsHtml = `
        <div class="driver-seat" data-gender="${dg}" data-name="${safeName}" data-grade="${dgrade || 0}" data-flag="${normalizePersonFlag(dflag)}">
            <div class="member-main-line driver-main-line">
                <div class="driver-name-disp ">${safeName}</div>
                <div class="person-meta">${renderPersonFlag(dflag)}${driverGenderHtml}${driverGradeHtml}</div>
                ${renderPersonOverflowMenu({ name, isDriver: true })}
            </div>
            <div class="memo-popup driver-memo-text" style="display:${dm?'block':'none'}">${safeMemo}</div>
        </div>
    `;
    for(let i=0; i<c; i++) slotsHtml += `<div class="seat-slot"><span class="seat-slot-icon" data-carbon-icon="add" aria-hidden="true"></span></div>`;

    col.innerHTML = `
        <div class="car-box" data-capacity="${c}">
            <div class="car-header">
                <span class="car-name-label">${safeName}${groupSuffix}</span>
                <cds-button type="button" kind="ghost" size="lg" class="capacity-badge capacity-edit-btn" data-action="edit-capacity" aria-label="定員を変更">
                    <span class="capacity-count">0/${c}</span><span data-carbon-icon="edit" aria-hidden="true"></span>
                </cds-button>
                <cds-icon-button type="button" kind="danger--ghost" size="lg" class="car-delete-btn car-return-btn action-btn delete-btn" aria-label="車出しを解除して待機に戻す">
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
