// Settlement collection checklist templates.
(function () {
  'use strict';

  const parts = window.SanpoApp?.settlementTemplateParts || {};
  const { esc, money } = parts;

  function collectionItem(p, state, result, helpers = {}) {
    const excluded = !!result.excludedNames?.has?.(p.name);
    const paid = !!state.paid?.[p.name];
    const isDriver = !!result.driverNames?.has?.(p.name);
    const preDeducted = excluded && isDriver && result.driverCollectionOffset && p.name !== result.excludedName;
    const displayName = state.paidBy?.[p.name] || p.name;
    if (excluded) {
      const status = preDeducted ? '控除済み' : (p.name === result.excludedName ? '対象外・企画者' : (isDriver ? '対象外・運転手' : '対象外'));
      const note = preDeducted ? '運転手分を支払額から控除' : (p.name === result.excludedName ? '企画者は集金対象外' : '集金対象外');
      return `<div class="seisan-check-item seisan-check-item--system ${preDeducted ? 'pre-deducted' : 'excluded'}">
          <span class="seisan-check-copy has-note"><span class="seisan-check-name">${esc(displayName, helpers)}</span><span class="seisan-check-note">${note}</span></span>
          <span class="seisan-check-status">${status}</span>
        </div>`;
    }
    return `<div class="seisan-check-item ${paid ? 'paid' : ''}" data-carbon-checkbox-row>
            <cds-checkbox ${paid ? 'checked' : ''} data-settlement-paid-name="${encodeURIComponent(p.name)}" label-text="" aria-label="${esc(displayName, helpers)}の集金チェック"></cds-checkbox>
            <span class="seisan-check-copy has-note">
              <span class="seisan-check-name">${esc(displayName, helpers)}</span>
              <span class="seisan-check-note">${paid ? '回収済み' : '未回収'}</span>
            </span>
            <span class="seisan-check-amount-state"><span class="seisan-check-amount">${money(result.perPerson || 0, helpers)}</span></span>
        </div>`;
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
    if (waiting.length) groups.push({ title: '未割り当て', items: waiting });
    return groups.length ? groups : [{ title: '', items: participants }];
  }

  function collection({ participants, state, result, data = {}, unpaidOnly = false, helpers = {} }) {
    if (!participants.length) return `<div class="seisan-empty">参加者を登録すると表示されます。</div>`;
    return buildCollectionGroups({ data, participants }).map(group => {
      const items = unpaidOnly
        ? group.items.filter(p => !result.excludedNames?.has?.(p.name) && !state.paid?.[p.name])
        : group.items;
      if (!items.length) return '';
      const title = group.title ? `<div class="seisan-collection-group-title">${esc(group.title, helpers)}</div>` : '';
      return `<section class="seisan-collection-group">
          ${title}
          <div class="seisan-collection-group-list">
            ${items.map(p => collectionItem(p, state, result, helpers)).join('')}
          </div>
        </section>`;
    }).join('') || '<div class="seisan-empty">未回収者はいません。</div>';
  }

  Object.assign(parts, { collectionItem, buildCollectionGroups, collection });
})();
