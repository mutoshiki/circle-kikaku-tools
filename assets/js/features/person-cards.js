// Person and group card rendering feature.
// Owns participant badges, per-person actions, and allocation card creation helpers.

function renderGradeBadge(grade) {
    const n = parseInt(grade) || 0;
    if (n <= 0) return '';
    return `<cds-tag class="grade-badge carbon-display-tag" data-grade="${n}" type="gray" size="sm">${n}年</cds-tag>`;
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

function getAllocationRoleLabel(enabled) {
    const team = document.body.dataset.activePlanTemplate === 'team';
    if (team) return enabled ? '班長を外す' : '班長にする';
    return enabled ? '運転手を外す' : '運転手にする';
}

function renderPersonOverflowMenu({ name, inWaiting = false, locked = false, roleEnabled = false } = {}) {
    const safeLabel = escapeHtml(`${name || '参加者'}の操作`);
    const common = [
      `<cds-menu-item class="person-pop-item" label="メモ" data-person-action="memo">${renderPersonMenuIcon('notebook')}</cds-menu-item>`,
      `<cds-menu-item class="person-pop-item" label="${getAllocationRoleLabel(roleEnabled)}" data-person-action="driver">${renderPersonMenuIcon('car')}</cds-menu-item>`,
      renderPersonChoiceSubmenu({ label: 'しるし', icon: 'flag', action: 'flag', choices: [
        { value: 'none', label: 'しるしなし', icon: 'close--outline', flag: true },
        { value: 'blue', label: '青', icon: 'flag', flag: true },
        { value: 'purple', label: '紫', icon: 'flag', flag: true },
        { value: 'yellow', label: '黄', icon: 'flag', flag: true },
        { value: 'red', label: '赤', icon: 'flag', flag: true }
      ] })
    ];
    common.push(`<cds-menu-item class="person-pop-item" label="${inWaiting ? '削除' : '未割り当てに戻す'}" data-person-action="return" kind="${inWaiting ? 'danger' : 'default'}">${renderPersonMenuIcon(inWaiting ? 'trash-can' : 'undo')}</cds-menu-item>`);
    common.push(renderPersonChoiceSubmenu({ label: '学年', icon: 'education', action: 'grade', choices: [
      { value: '0', label: '未設定', icon: 'subtract' },
      { value: '1', label: '1年', icon: 'number--1' },
      { value: '2', label: '2年', icon: 'number--2' },
      { value: '3', label: '3年', icon: 'number--3' },
      { value: '4', label: '4年', icon: 'number--4' }
    ] }));
    return `<cds-overflow-menu type="button" kind="ghost" size="lg" class="person-overflow-menu action-btn" label="${safeLabel}" aria-label="${safeLabel}" enable-v12-overflowmenu autoalign menu-alignment="bottom-start" enter-delay-ms="86400000" leave-delay-ms="0">
        <span data-carbon-icon="overflow-menu-vertical" slot="icon" aria-hidden="true"></span>
        <cds-menu class="person-pop-menu" aria-label="${safeLabel}">${common.join('')}</cds-menu>
      </cds-overflow-menu>`;
}
window.renderPersonOverflowMenu = renderPersonOverflowMenu;

// The third positional argument is retained only so older local snapshots/callers can
// still restore safely. It is deliberately ignored; participant sex/gender is no longer
// part of allocation state or UI.
function addMember(n, m='', _legacyUnused='', grade=0, parent=$('#waiting-list'), locked=false, flag='none', participantId='', roleEnabled=false) {
    const name = String(n || '').trim();
    if(!name) return;

    const div = ce('div', 'member-card');
    div.dataset.name = name;
    if (participantId) div.dataset.participantId = String(participantId);
    div.dataset.grade = grade;
    div.dataset.locked = locked;
    div.dataset.flag = normalizePersonFlag(flag);
    div.dataset.driver = roleEnabled === true ? 'true' : 'false';

    const safeName = escapeHtml(name);
    const safeMemo = escapeHtml(m || '');
    div.innerHTML = `
        <div class="member-main-line">
            <div class="member-name-text">${safeName}</div>
            <div class="person-meta">${renderPersonFlag(flag)}${roleEnabled ? `<cds-tag class="driver-role-tag carbon-display-tag" type="gray" size="sm">${document.body.dataset.activePlanTemplate === 'team' ? '班長' : '運転手'}</cds-tag>` : ''}${renderGradeBadge(grade)}</div>
            ${renderPersonOverflowMenu({ name, inWaiting: parent?.id === 'waiting-list', locked, roleEnabled })}
        </div>
        <div class="memo-popup" style="display:${m?'block':'none'}">${safeMemo}</div>
    `;
    parent.appendChild(div);
    if (!isRestoringCarPlans && !window.__suspendCardUpdateUi) updateUI();
    return div;
}
window.addMember = addMember;

// The fifth positional argument is a legacy placeholder for pre-removal snapshots.
function addCar(n, cap, mems=[], dm='', _legacyUnused='', dgrade=0, dflag='none', participantId='', groupId='', ownerRoleEnabled=false, ownerLocked=false) {
    const name = String(n || '').trim();
    const fallbackCapacity = typeof getDefaultGroupCapacityForActivePlan === 'function' ? getDefaultGroupCapacityForActivePlan() : 3;
    const c = getInt(cap) || fallbackCapacity;
    if(!name) return;

    const col = ce('div', 'allocation-grid-item');
    if (participantId) col.dataset.participantId = String(participantId);
    const safeName = escapeHtml(name);
    const safeMemo = escapeHtml(dm || '');
    const groupSuffix = typeof getActiveGroupSuffix === 'function' ? getActiveGroupSuffix() : '車';
    const roleText = document.body.dataset.activePlanTemplate === 'team' ? '班長' : '運転手';
    let slotsHtml = `
        <div class="driver-seat" data-driver="${ownerRoleEnabled ? 'true' : 'false'}" data-name="${safeName}" data-participant-id="${escapeHtml(participantId || '')}" data-grade="${dgrade || 0}" data-locked="${ownerLocked ? 'true' : 'false'}" data-flag="${normalizePersonFlag(dflag)}">
            <div class="member-main-line driver-main-line">
                <div class="driver-name-disp">${safeName}</div>
                <div class="person-meta">${renderPersonFlag(dflag)}${ownerRoleEnabled ? `<cds-tag class="driver-role-tag carbon-display-tag" type="gray" size="sm">${roleText}</cds-tag>` : ''}${renderGradeBadge(dgrade)}</div>
                ${renderPersonOverflowMenu({ name, locked: ownerLocked, roleEnabled: ownerRoleEnabled })}
            </div>
            <div class="memo-popup driver-memo-text" style="display:${dm?'block':'none'}">${safeMemo}</div>
        </div>
    `;
    for(let i=0; i<c; i++) slotsHtml += `<div class="seat-slot"><cds-icon-button class="seat-add-btn" type="button" kind="ghost" size="lg" aria-label="参加者を追加" align="top"><span data-carbon-icon="add" slot="icon" aria-hidden="true"></span></cds-icon-button></div>`;

    col.innerHTML = `
        <cds-contained-list class="car-box" kind="on-page" is-inset data-capacity="${c}" data-group-id="${escapeHtml(groupId || '')}">
            <div class="car-header">
                <span class="car-name-label">${safeName}${groupSuffix}</span>
                <div class="car-capacity-actions">
                    <span class="capacity-badge capacity-display" aria-label="車の人数 0/${c}人">
                        <span class="capacity-count">0/${c}人</span>
                    </span>
                </div>
                <cds-icon-button type="button" kind="ghost" size="md" class="car-delete-btn car-return-btn delete-btn" aria-label="${document.body.dataset.activePlanTemplate === 'team' ? '班' : '車'}を削除">
                    <span data-carbon-icon="trash-can" aria-hidden="true"></span>
                </cds-icon-button>
            </div>
            <div class="car-layout-grid">${slotsHtml}</div>
        </cds-contained-list>
    `;
    $('#cars-container').appendChild(col);

    $$('.seat-slot', col).forEach((slot, i) => {
        if(mems[i]) addMember(
            mems[i].name,
            mems[i].memo,
            '',
            mems[i].grade||0,
            slot,
            mems[i].locked,
            mems[i].flag,
            mems[i].participantId || mems[i].id || '',
            mems[i].driver === true || mems[i].isDriver === true
        );
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
