// Sheet view HTML templates.
(function () {
  'use strict';

  function esc(value, helpers) {
    return (helpers?.escapeHtml || window.escapeHtml || (v => String(v ?? '')))(value);
  }

  function gradeBadge(grade, gender, helpers) {
    const n = parseInt(grade) || 0;
    if (n <= 0) return '<span class="sheet-grade-placeholder" aria-hidden="true"></span>';
    return (helpers?.renderGradeBadge || (() => ''))(grade, gender);
  }

  function normalizeTemplate(template = {}) {
    if (template && typeof template === 'object' && template.ownerLabel) return template;
    return {
      type: 'car',
      sectionTitle: '車割',
      sheetTitle: '車割',
      ownerLabel: '車出し',
      memberLabel: '席',
      groupSuffix: '車',
      ownerIcon: 'fa-car',
      planName: '車割'
    };
  }

  function plainMember(member, helpers = {}) {
    const grade = member.grade || 0;
    const flag = normalizePersonFlag(member.flag);
    return `${gradeBadge(grade, member.gender || 'unknown', helpers)}<span class="sheet-cell-text">${esc(member.name, helpers)}</span>${renderPersonFlag(flag).replace('person-flag', 'sheet-person-flag')}`;
  }

  function memberChip(member, helpers = {}) {
    const grade = member.grade || 0;
    const gender = member.gender || 'unknown';
    const draggable = !!helpers.isDraggable?.(member);
    const lockIcon = member.locked ? `<i class="fas fa-lock sheet-chip-lock" aria-hidden="true"></i>` : '';
    const flagIcon = renderPersonFlag(member.flag).replace('person-flag', 'sheet-person-flag');
    return `<div class="sheet-chip ${draggable ? 'draggable' : ''} ${member.locked ? 'locked' : ''}" data-name="${esc(member.name, helpers)}" data-gender="${gender}" data-locked="${member.locked ? 'true' : 'false'}">${gradeBadge(grade, gender, helpers)}<span class="sheet-chip-text">${esc(member.name, helpers)}</span>${flagIcon}${lockIcon}</div>`;
  }

  function empty() {
    return `
        <div class="sheet-empty-card app-empty-card">
            <div class="sheet-empty-icon"><i class="fas fa-car-side" aria-hidden="true"></i></div>
            <div class="sheet-empty-title">共有できるデータがありません</div>
            <div class="sheet-empty-text">参加者を登録し、車割または班割を作成すると共有画面へ反映されます。</div>
            <div class="seisan-empty-actions">
              <button class="seisan-btn primary" type="button" data-action="switch-list"><i class="fas fa-pen-to-square" aria-hidden="true"></i>車割・班割を開く</button>
            </div>
        </div>`;
  }

  function labelColumn(maxSeats, template = {}) {
    const cfg = normalizeTemplate(template);
    return `
        <div class="sheet-car-header sheet-label-header">${esc(cfg.planName || cfg.sectionTitle || '', helpersFromTemplate(template))}</div>
        <div class="sheet-driver-row sheet-label-row">${esc(cfg.ownerLabel, helpersFromTemplate(template))}</div>
        ${Array.from({ length: maxSeats }, (_, i) => `<div class="sheet-seat-row sheet-label-row">${esc(cfg.memberLabel, helpersFromTemplate(template))} ${i + 1}</div>`).join('')}`;
  }

  function helpersFromTemplate(template) {
    return template?.helpers || {};
  }

  function carColumn({ car, maxSeats, groupIndex = 0, quickEditMode, helpers = {}, template = {} }) {
    const cfg = normalizeTemplate(template);
    const cap = parseInt(car.capacity) || 0;
    const filled = (car.members || []).filter(Boolean).length;
    const capacityClass = filled > cap ? 'is-over' : (filled === cap ? 'is-full' : '');
    const groupTitle = `${cfg.type === 'team' ? '班' : '車'}${groupIndex + 1}`;
    let html = `<div class="sheet-car-header">${esc(groupTitle, helpers)} <span class="sheet-capacity-badge ${capacityClass}">${filled}/${cap}</span></div>`;

    const dg = car.driverGender || 'unknown';
    const dgrade = parseInt(car.driverGrade) || 0;
    html += `<div class="sheet-driver-row" data-gender="${dg}">
        ${gradeBadge(dgrade, dg, helpers)}<span class="sheet-driver-name">${esc(car.name, helpers)}</span>${renderPersonFlag(car.driverFlag).replace('person-flag', 'sheet-person-flag')}
    </div>`;

    for (let i = 0; i < cap; i++) {
      const mem = (car.members || [])[i];
      if (mem && mem.name) {
        const g = mem.gender || 'unknown';
        html += quickEditMode
          ? `<div class="sheet-seat-row" data-gender="${g}"><div class="sheet-dropzone" data-zone-type="seat" data-car-name="${esc(car.name, helpers)}" data-slot-index="${i}" data-accept-drop="${mem.locked ? 'false' : 'true'}">${memberChip(mem, helpers)}</div></div>`
          : `<div class="sheet-seat-row" data-gender="${g}">${plainMember(mem, helpers)}</div>`;
      } else {
        html += quickEditMode
          ? `<div class="sheet-seat-row empty"><div class="sheet-dropzone" data-zone-type="seat" data-car-name="${esc(car.name, helpers)}" data-slot-index="${i}" data-accept-drop="true">空き</div></div>`
          : `<div class="sheet-seat-row empty">空き</div>`;
      }
    }
    return html;
  }

  function waitingColumn({ data, quickEditMode, helpers = {} }) {
    const waiting = Array.isArray(data?.waiting) ? data.waiting : [];
    let html = `<div class="sheet-wait-header">未割り当て (${waiting.length})</div>`;
    if (quickEditMode) {
      html += `<div class="sheet-wait-body"><div class="sheet-waiting-list" data-zone-type="waiting" data-accept-drop="true">${waiting.map(member => memberChip(member, helpers)).join('')}</div></div>`;
    } else {
      html += `<div class="sheet-wait-body">${waiting.map(member => {
        const gender = member.gender || 'unknown';
        return `<div class="sheet-wait-item" data-gender="${gender}">${plainMember(member, helpers)}</div>`;
      }).join('')}</div>`;
    }
    return html;
  }

  window.SanpoApp?.registerTemplates?.('sheet', {
    plainMember,
    memberChip,
    empty,
    labelColumn,
    carColumn,
    waitingColumn
  });
})();
