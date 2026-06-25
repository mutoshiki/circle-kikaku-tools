// Settlement summary templates.
(function () {
  'use strict';

  const parts = window.SanpoApp?.settlementTemplateParts || {};
  const { UI_CLASS, esc, money, formatCostBadge, formatPaymentBadge, formatExtraLines } = parts;

  function getAccountingAmount(result = {}) {
    return Math.abs(Number(result.accounting || 0));
  }

  function summary(result, helpers = {}) {
    // Legacy test anchor: 1人 ${money(result.perPerson, helpers)} × ${result.payerCount}名

    const accountingLabel = result.accounting >= 0 ? '部費から補助' : '部費へ戻す';
    const accountingSign = result.accounting >= 0 ? '＋' : '−';
    return `
        <div class="seisan-summary-card collect ${UI_CLASS.surfaceCard}" data-summary-kind="collect">
          <div class="seisan-summary-label"><i class="fas fa-users" aria-hidden="true"></i>${formatCostBadge('split')}</div>
          <div class="seisan-summary-value ${UI_CLASS.amount}">${money(result.expectedCollected, helpers)}</div>
          <div class="seisan-summary-sub">各 ${money(result.perPerson, helpers)} × ${result.payerCount}名</div>
        </div>
        <div class="seisan-flow-arrow seisan-flow-arrow--plus" aria-hidden="true">${accountingSign}</div>
        <div class="seisan-summary-card accounting ${UI_CLASS.surfaceCard}" data-summary-kind="club">
          <div class="seisan-summary-label"><i class="fas fa-wallet" aria-hidden="true"></i>${formatCostBadge('club')}</div>
          <div class="seisan-summary-value ${UI_CLASS.amount}">${money(getAccountingAmount(result), helpers)}</div>
          <div class="seisan-summary-sub">${accountingLabel}</div>
        </div>
        <div class="seisan-flow-arrow seisan-flow-arrow--equals" aria-hidden="true">＝</div>
        <div class="seisan-summary-card pay ${UI_CLASS.surfaceCard}" data-summary-kind="pay">
          <div class="seisan-summary-label"><i class="fas fa-car-side" aria-hidden="true"></i>${formatPaymentBadge()}</div>
          <div class="seisan-summary-value ${UI_CLASS.amount}">${money(result.driverTotal, helpers)}</div>
          <div class="seisan-summary-sub">車出し${result.cars.length}名に渡す</div>
        </div>`;
  }

    function settingSummary({ state, result, helpers = {} }) {
    const organizerFreeLabel = state.organizerFree ? 'しない' : 'する';
    const organizerNote = state.organizerFree && state.organizerName && !result.isStandaloneSettlement
      ? `（${esc(state.organizerName, helpers)}）`
      : '';
    const driverOffsetLabel = result.driverCollectionOffset ? 'しない（支払い額から差し引き）' : 'する';
    const driverFreeLabel = result.driverCollectionFree ? 'しない' : '';
    const organizerFreeDisplay = `${organizerFreeLabel}${organizerNote}`;
    const standalone = result.isStandaloneSettlement ? result.standaloneCounts : null;
    const reward = Number(result.reward || 0);
    const standalonePill = standalone
      ? `<span class="seisan-setting-pill--mode"><small>入力方法</small>精算だけ</span><span class="seisan-setting-pill--count"><small>人数</small>車出し${standalone.driverCount}名＋その他${standalone.memberCount}名</span>`
      : '';
    const driverOffsetPill = result.driverCollectionOffset
      ? `<span class="seisan-setting-pill--subtle"><small>車出しの集金:</small>${esc(driverOffsetLabel, helpers)}</span>`
      : '';
    const driverFreePill = result.driverCollectionFree
      ? `<span class="seisan-setting-pill--subtle"><small>運転手から集金:</small>${esc(driverFreeLabel, helpers)}</span>`
      : '';
    const rewardPill = reward > 0
      ? `<span class="seisan-setting-pill--subtle"><small>車出し協力代</small>1台 ${money(reward, helpers)}</span>`
      : '';
    const organizerPills = state.organizerFree
      ? `<span class="seisan-setting-pill--subtle"><small>企画者の集金</small>${organizerFreeDisplay}</span>`
      : '';
    return `<div class="seisan-summary-pills seisan-summary-pills--single" aria-label="現在の精算設定">
        ${standalonePill}
        ${driverOffsetPill}
        ${driverFreePill}
        ${organizerPills}
        <span class="seisan-setting-pill--subtle"><small>端数処理</small>${esc(state.rounding || '100', helpers)}円単位</span>
        ${rewardPill}
    </div>`;
  }

    function breakdown(result, helpers = {}) {
    return `
        <div class="seisan-break-row"><span>割勘対象</span><span>${money(result.totalSplit, helpers)}</span></div>
        <div class="seisan-break-row"><span>集金予定</span><span>${money(result.expectedCollected, helpers)}</span></div>
        <div class="seisan-break-row"><span>端数余り</span><span>${money(result.surplus, helpers)}</span></div>
        <div class="seisan-break-row"><span>部費から</span><span>${money(result.totalClub, helpers)}</span></div>
        <div class="seisan-break-row"><span>うち車出し協力代</span><span>${money(result.totalReward, helpers)}</span></div>
        <div class="seisan-break-row"><span>集金</span><span>-${money(result.totalDriverCollectionOffset, helpers)}</span></div>
        <div class="seisan-break-row"><span>支払い丸め</span><span>${money(result.totalDriverRound, helpers)}</span></div>`;
  }

  function clubExpenseBreakdown(result, helpers = {}) {
    const expenseRows = (result.cars || []).flatMap(car =>
      (car.extras || [])
        .filter(extra => extra.type === 'club' && Number(extra.amountValue || 0) !== 0)
        .map(extra => ({
          name: extra.name || '名目未入力',
          amount: Number(extra.amountValue || 0),
          user: car.name
        }))
    );
    const accountingTotal = Number(result.accounting || 0);
    const collectionRounding = -Number(result.surplus || 0);
    const adjustmentRows = [
      { name: '支払い端数', amount: Number(result.totalDriverRound || 0), user: '全体' },
      { name: '運転手の集金差し引き', amount: -Number(result.totalDriverCollectionOffset || 0), user: '全体' },
      {
        name: collectionRounding > 0 ? '集金不足の補填' : '集金の端数余り',
        amount: collectionRounding,
        user: '全体'
      }
    ].filter(row => row.amount !== 0);
    const rows = [...expenseRows, ...adjustmentRows];
    const details = rows.length
      ? rows.map(row => `<div class="seisan-club-expense-row">
          <span class="seisan-club-expense-name">${esc(row.name, helpers)}</span>
          <span class="seisan-club-expense-user">${esc(row.user, helpers)}</span>
          <strong class="seisan-club-expense-amount">${money(row.amount, helpers)}</strong>
        </div>`).join('')
      : '<div class="seisan-club-expense-empty">部費の使用はありません。</div>';
    return `${details}<div class="seisan-club-expense-total"><span>合計</span><strong>${money(accountingTotal, helpers)}</strong></div>`;
  }

  
  Object.assign(parts, { summary, settingSummary, breakdown, clubExpenseBreakdown });
})();
