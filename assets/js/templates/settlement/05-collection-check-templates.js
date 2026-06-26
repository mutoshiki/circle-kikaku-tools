// Settlement collection checklist templates.
(function () {
  'use strict';

  const parts = window.SanpoApp?.settlementTemplateParts || {};
  const { esc, money } = parts;

  function formatCarLabel(name = '', helpers = {}) {
    const text = String(name || '').trim();
    if (!text) return '';
    return `${esc(text, helpers)}車`;
  }

    function collectionItem(p, state, result, helpers = {}) {
    const excluded = !!result.excludedNames?.has?.(p.name);
    const paid = !!state.paid?.[p.name];
    const note = excluded
      ? (p.role === 'driver' ? '支払い額から差し引き済' : (p.name === result.excludedName ? '対象外（企画者）' : '対象外'))
      : (p.role === 'member' && p.driverName ? formatCarLabel(p.driverName, helpers) : (p.role === 'waiting' ? '待機' : ''));
    return `<label class="seisan-check-item ${paid ? 'paid' : ''} ${excluded ? 'excluded' : ''}"${excluded ? ' aria-disabled="true"' : ''}>
            <input type="checkbox" ${paid ? 'checked' : ''} ${excluded ? 'disabled' : ''} data-settlement-paid-name="${encodeURIComponent(p.name)}">
            <span class="seisan-check-name">${esc(p.name, helpers)}</span>
            ${note ? `<span class="seisan-check-note">${note}</span>` : ''}
        </label>`;
  }

    function buildCollectionGroups({ data = {}, participants = [] } = {}) {
    const byName = new Map(participants.map(p => [p.name, p]));
    const used = new Set();
    const groups = [];
    (data.cars || []).forEach(car => {
      const driverName = String(car?.name || '').trim();
      const items = [];
      const driver = byName.get(driverName);
      if (driver) {
        items.push(driver);
        used.add(driver.name);
      }
      (car.members || []).forEach(member => {
        const name = String(member?.name || '').trim();
        const participant = byName.get(name);
        if (participant && !used.has(participant.name)) {
          items.push(participant);
          used.add(participant.name);
        }
      });
      if (items.length) groups.push({ title: driverName ? `${driverName}車` : '車未設定', items });
    });
    const waiting = participants.filter(p => !used.has(p.name));
    if (waiting.length) groups.push({ title: '待機・未割当', items: waiting });
    return groups.length ? groups : [{ title: '', items: participants }];
  }

    function collection({ participants, state, result, data = {}, helpers = {} }) {
    if (!participants.length) return `<div class="seisan-empty">名簿を登録すると表示されます。</div>`;
    return buildCollectionGroups({ data, participants }).map(group => {
      const title = group.title ? `<div class="seisan-collection-group-title">${esc(group.title, helpers)}</div>` : '';
      return `<section class="seisan-collection-group">
          ${title}
          <div class="seisan-collection-group-list">
            ${group.items.map(p => collectionItem(p, state, result, helpers)).join('')}
          </div>
        </section>`;
    }).join('');
  }

  
  Object.assign(parts, { formatCarLabel, collectionItem, buildCollectionGroups, collection });
})();
