// Settlement summary templates.
(function () {
  'use strict';

  const parts = window.SanpoApp?.settlementTemplateParts || {};
  const { UI_CLASS, esc, money, formatCostBadge, formatPaymentBadge, formatExtraLines } = parts;

  function signedMoney(value, helpers = {}, showPlus = false) {
    const amount = Number(value || 0);
    const sign = amount < 0 ? '−' : (showPlus && amount > 0 ? '＋' : '');
    return `${sign}${money(Math.abs(amount), helpers)}`;
  }

  function summary(result, helpers = {}) {
    const totals = new Map();
    const add = (label, amount, carName) => {
      const current = totals.get(label) || { amount: 0, cars: new Set() };
      current.amount += Number(amount || 0);
      if (carName) current.cars.add(carName);
      totals.set(label, current);
    };
    (result.cars || []).forEach(car => {
      add(car.usesTimesRental ? 'タイムズ移動料金' : 'ガソリン代', car.movementAmount || 0, car.name);
      (car.extras || []).forEach(extra => add(extra.name || '費用', extra.amountValue || 0, car.name));
    });
    const rows = [...totals.entries()]
      .filter(([, entry]) => entry.amount !== 0)
      .map(([label, entry]) => `<div class="seisan-overall-cost-row"><span><strong>${esc(label, helpers)}</strong><small>${entry.cars.size}台分</small></span><b>${signedMoney(entry.amount, helpers)}</b></div>`)
      .join('');
    const total = Number(result.totalSplit || 0) + Number(result.totalClub || 0);
    return `<div class="seisan-overall-cost-list" aria-label="登録済み費用">${rows || '<div class="seisan-muted">費用はまだありません。</div>'}</div>
      <div class="seisan-overall-cost-total"><span>合計</span><strong>${signedMoney(total, helpers)}</strong></div>`;
  }

  function statusSummary({ state, result, issues, helpers = {} }) {
    const cars = result.cars || [];
    const paidCars = cars.filter(car => state.driverPaid?.[car.name]);
    const paymentPaid = paidCars.reduce((sum, car) => sum + Number(car.adjustedTotalPay || 0), 0);
    const paymentRemaining = cars.filter(car => !state.driverPaid?.[car.name])
      .reduce((sum, car) => sum + Number(car.adjustedTotalPay || 0), 0);
    const issueCount = Number(issues?.messages?.length || 0);
    const items = [
      ['集金', `${result.paidCount}/${result.payerCount}人・残り ${money(result.unpaidAmount || 0, helpers)}`, `${money(result.expectedCollected - result.unpaidAmount, helpers)} / ${money(result.expectedCollected, helpers)}`],
      ['支払い', `${paidCars.length}/${cars.length}台・残り ${money(paymentRemaining, helpers)}`, `支払い済み ${money(paymentPaid, helpers)}`],
      ['要確認', issueCount ? `${issueCount}件` : 'なし', issueCount ? esc(issues.messages[0], helpers) : '確認事項はありません']
    ];
    return items.map(([label, value, note]) => `<div class="seisan-status-item${issueCount && label === '要確認' ? ' has-issue' : ''}"><span class="seisan-status-label">${label}</span><strong>${value}</strong><span class="seisan-status-note">${note}</span></div>`).join('');
  }

  function settingSummary({ state, result, helpers = {} }) {
    const standalone = result.isStandaloneSettlement ? result.standaloneCounts : null;
    const reward = Number(result.reward || 0);
    const rewardTypeLabel = result.driverRewardType === 'club' ? '部費' : '割勘';
    const row = (label, value) => `<cds-structured-list-row condensed class="seisan-setting-row">
      <cds-structured-list-cell class="seisan-setting-label">${label}</cds-structured-list-cell>
      <cds-structured-list-cell class="seisan-setting-value">${value}</cds-structured-list-cell>
    </cds-structured-list-row>`;
    const mode = standalone ? `人数だけ（運転手${standalone.driverCount}人・その他${standalone.memberCount}人）` : '通常精算';
    const driverCollection = result.driverCollectionOffset ? '支払い額から控除' : (result.driverCollectionFree ? '対象外' : '参加者と同じく集金');
    const excluded = [
      state.organizerFree ? `企画者${state.organizerName ? `（${esc(state.organizerName, helpers)}）` : ''}` : '',
      result.driverCollectionFree ? '運転手' : ''
    ].filter(Boolean).join('・') || 'なし';
    const rows = [
      row('精算モード', mode),
      row('端数', `${esc(state.rounding || '100', helpers)}円単位`),
      row('協力代', reward > 0 ? `1台 ${money(reward, helpers)}（${rewardTypeLabel}）` : 'なし'),
      row('運転手分', driverCollection),
      row('集金対象外', excluded),
      row('設定結果', `集金対象 ${result.payerCount}人・運転手 ${result.driverNames?.size || 0}人・1人あたり ${money(result.perPerson || 0, helpers)}`)
    ];

    return `<cds-structured-list condensed class="seisan-settings-structured-list" aria-label="現在の精算設定">
      <cds-structured-list-body>${rows.join('')}</cds-structured-list-body>
    </cds-structured-list>`;
  }

  function breakdown(result, helpers = {}) {
    return `
        <div class="seisan-break-row"><span>割勘対象</span><span>${money(result.totalSplit, helpers)}</span></div>
        <div class="seisan-break-row"><span>集金予定</span><span>${money(result.expectedCollected, helpers)}</span></div>
        <div class="seisan-break-row"><span>端数余り</span><span>${money(result.surplus, helpers)}</span></div>
        <div class="seisan-break-row"><span>部費から</span><span>${money(result.totalClub, helpers)}</span></div>
        <div class="seisan-break-row"><span>車出し協力代合計</span><span>${money(result.totalReward, helpers)}</span></div>
        <div class="seisan-break-row"><span>集金</span><span>-${money(result.totalDriverCollectionOffset, helpers)}</span></div>
        <div class="seisan-break-row"><span>支払い丸め</span><span>${money(result.totalDriverRound, helpers)}</span></div>`;
  }

  function clubExpenseBreakdown(result, helpers = {}) {
    const expenseRows = (result.cars || []).flatMap(car =>
      (car.extras || [])
        .filter(extra => extra.baseType === 'club' && Number(extra.amountValue || 0) !== 0)
        .map(extra => ({
          name: extra.name || '名目未入力',
          amount: Number(extra.amountValue || 0),
          user: car.name
        }))
    );
    const clubTotal = Number(result.totalClub || 0);
    const details = expenseRows.length
      ? expenseRows.map(row => `<div class="seisan-club-expense-row">
          <span class="seisan-club-expense-name">${esc(row.name, helpers)}</span>
          <span class="seisan-club-expense-user">${esc(row.user, helpers)}</span>
          <strong class="seisan-club-expense-amount"><span class="seisan-amount-sign" aria-hidden="true">${row.amount < 0 ? '−' : '＋'}</span>${money(Math.abs(row.amount), helpers)}</strong>
        </div>`).join('')
      : '<div class="seisan-club-expense-empty">部費の収支はありません。</div>';
    const totalLabel = clubTotal > 0 ? '部費から支出' : (clubTotal < 0 ? '部費へ戻す' : '部費収支');
    return `${details}<div class="seisan-club-expense-total"><span>${totalLabel}</span><strong>${signedMoney(clubTotal, helpers)}</strong></div>`;
  }

  Object.assign(parts, { summary, statusSummary, settingSummary, breakdown, clubExpenseBreakdown });
})();
