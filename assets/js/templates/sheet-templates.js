// Sheet view HTML templates.
(function () {
  'use strict';

  function esc(value, helpers) {
    return (helpers?.escapeHtml || window.escapeHtml || (v => String(v ?? '')))(value);
  }

  function gradeBadge(grade, gender, helpers) {
    return (helpers?.renderGradeBadge || (() => ''))(grade, gender);
  }

  function plainMember(member, helpers = {}) {
    const grade = member.grade || 0;
    return `${gradeBadge(grade, member.gender || 'unknown', helpers)}<span class="sheet-cell-text">${esc(member.name, helpers)}</span>`;
  }

  function memberChip(member, helpers = {}) {
    const grade = member.grade || 0;
    const gender = member.gender || 'unknown';
    const draggable = !!helpers.isDraggable?.(member);
    const lockIcon = member.locked ? `<i class="fas fa-lock sheet-chip-lock" aria-hidden="true"></i>` : '';
    return `<div class="sheet-chip ${draggable ? 'draggable' : ''} ${member.locked ? 'locked' : ''}" data-name="${esc(member.name, helpers)}" data-gender="${gender}" data-locked="${member.locked ? 'true' : 'false'}">${gradeBadge(grade, gender, helpers)}<span class="sheet-chip-text">${esc(member.name, helpers)}</span>${lockIcon}</div>`;
  }

  function empty() {
    return `
        <div class="sheet-empty-card">
            <div class="sheet-empty-icon"><i class="fas fa-car-side" aria-hidden="true"></i></div>
            <div class="sheet-empty-title">まずは参加者登録から</div>
            <div class="sheet-empty-text">企画の参加者と車出しを登録すると、ここに発表用の車割が表示されます。</div>
            <div class="sheet-empty-actions">
              <button class="seisan-btn primary" type="button" data-action="open-batch-from-sheet"><i class="fas fa-paste me-1"></i>参加者登録を開く</button>
              <button class="seisan-btn" type="button" data-action="switch-list"><i class="fas fa-edit me-1"></i>車割メーカーへ</button>
            </div>
        </div>`;
  }

  function labelColumn(maxSeats) {
    return `
        <div class="sheet-car-header sheet-label-header">　</div>
        <div class="sheet-driver-row sheet-label-row">車出し</div>
        ${Array.from({ length: maxSeats }, (_, i) => `<div class="sheet-seat-row sheet-label-row">席 ${i + 1}</div>`).join('')}`;
  }

  function carColumn({ car, maxSeats, quickEditMode, helpers = {} }) {
    const cap = parseInt(car.capacity) || 0;
    const filled = (car.members || []).filter(Boolean).length;
    const capacityClass = filled > cap ? 'is-over' : (filled === cap ? 'is-full' : '');
    let html = `<div class="sheet-car-header">${esc(car.name, helpers)}車 <span class="sheet-capacity-badge ${capacityClass}">${filled}/${cap}</span></div>`;

    const dg = car.driverGender || 'unknown';
    const dgrade = parseInt(car.driverGrade) || 0;
    html += `<div class="sheet-driver-row" data-gender="${dg}">
        <i class="fas fa-car sheet-driver-icon" aria-hidden="true"></i>
        <span class="sheet-driver-name">${esc(car.name, helpers)}</span>${gradeBadge(dgrade, dg, helpers)}
    </div>`;

    for (let i = 0; i < maxSeats; i++) {
      const mem = (car.members || [])[i];
      if (i >= cap) {
        html += `<div class="sheet-seat-row sheet-seat-disabled"></div>`;
      } else if (mem && mem.name) {
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
    let html = `<div class="sheet-wait-header">待機中 (${data.waiting.length})</div>`;
    if (quickEditMode) {
      html += `<div class="sheet-wait-body"><div class="sheet-waiting-list" data-zone-type="waiting" data-accept-drop="true">${data.waiting.map(member => memberChip(member, helpers)).join('')}</div></div>`;
    } else {
      html += `<div class="sheet-wait-body">${data.waiting.length ? data.waiting.map(member => {
        const gender = member.gender || 'unknown';
        return `<div class="sheet-wait-item" data-gender="${gender}">${plainMember(member, helpers)}</div>`;
      }).join('') : '<div class="sheet-wait-item empty">待機メンバーはいません</div>'}</div>`;
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
