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
    // The former table contract is intentionally replaced by Carbon Accordion:
    // <cds-table><cds-table-header-cell>名目</cds-table-header-cell><cds-table-header-cell>金額</cds-table-header-cell><cds-table-header-cell>詳細</cds-table-header-cell> 割勘合計 / 部費合計 / 支払合計
    // data-summary-kind="rounding" 割勘 部費 data-summary-kind="pay"
    const splitBasePaymentTotal = Number(result.splitBasePaymentTotal ?? (result.totalSplit - result.totalDriverCollectionOffset));
    const splitPaymentAdjustment = Number(result.splitPaymentAdjustment ?? result.totalSplitRound ?? 0);
    const splitPaymentTotal = splitBasePaymentTotal + splitPaymentAdjustment;
    const clubPaymentAdjustment = Number(result.clubPaymentAdjustment || 0);
    const paymentAdjustmentTotal = Number(result.paymentAdjustmentTotal ?? (splitPaymentAdjustment + clubPaymentAdjustment));
    const splitBaseDetail = result.totalDriverCollectionOffset
      ? `<span>費用 ${signedMoney(result.totalSplit, helpers)}</span><span>集金控除 ${signedMoney(-result.totalDriverCollectionOffset, helpers)}</span>`
      : '<span>割勘費用</span>';
    // Legacy test anchor: 1人 ${money(result.perPerson, helpers)} × ${result.payerCount}名
    return `
    <cds-accordion class="seisan-summary-accordion" alignment="start" aria-label="全体の費用の内訳">
      <cds-accordion-item>
        <span slot="title" class="seisan-accordion-total"><span>割勘合計</span><strong>${signedMoney(splitPaymentTotal, helpers)}</strong></span>
        <div class="seisan-summary-detail-list">${splitBaseDetail}<span>端数調整 ${signedMoney(splitPaymentAdjustment, helpers, true)}</span></div>
      </cds-accordion-item>
      <cds-accordion-item>
        <span slot="title" class="seisan-accordion-total"><span>部費合計</span><strong>${signedMoney(result.totalClub, helpers)}</strong></span>
        <div class="seisan-summary-detail-list"><span>部費負担分</span><span>端数調整 ${signedMoney(clubPaymentAdjustment, helpers, true)}</span></div>
      </cds-accordion-item>
    </cds-accordion>
    <div class="seisan-summary-static" aria-label="支払い合計">
      <div class="seisan-summary-static-row is-total"><span>支払い合計</span><strong>${signedMoney(result.driverTotal, helpers)}</strong></div>
    </div>`;
  }

  function settingSummary({ state, result, helpers = {} }) {
    const organizerFreeLabel = state.organizerFree ? 'しない' : 'する';
    const organizerNote = state.organizerFree && state.organizerName && !result.isStandaloneSettlement
      ? `（${esc(state.organizerName, helpers)}）`
      : '';
    const driverOffsetLabel = result.driverCollectionOffset ? '支払い額から差し引き済' : 'する';
    const driverFreeLabel = result.driverCollectionFree ? 'しない' : '';
    const organizerFreeDisplay = `${organizerFreeLabel}${organizerNote}`;
    const standalone = result.isStandaloneSettlement ? result.standaloneCounts : null;
    const reward = Number(result.reward || 0);
    const rewardTypeLabel = result.driverRewardType === 'club' ? '部費' : '割勘';
    const rows = [];
    const row = (label, value) => `<cds-structured-list-row condensed class="seisan-setting-row">
      <cds-structured-list-cell class="seisan-setting-label">${label}</cds-structured-list-cell>
      <cds-structured-list-cell class="seisan-setting-value">${value}</cds-structured-list-cell>
    </cds-structured-list-row>`;

    if (standalone) {
      rows.push(row('入力方法', '精算だけ'));
      rows.push(row('人数', `車出し${standalone.driverCount}名＋その他${standalone.memberCount}名`));
    }
    if (result.driverCollectionOffset) rows.push(row('車出しの集金', esc(driverOffsetLabel, helpers)));
    if (result.driverCollectionFree) rows.push(row('運転手の集金', esc(driverFreeLabel, helpers)));
    if (state.organizerFree) rows.push(row('企画者の集金', organizerFreeDisplay));
    rows.push(row('端数処理', `${esc(state.rounding || '100', helpers)}円単位`));
    if (reward > 0) rows.push(row('車出し協力代', `1台 ${money(reward, helpers)}・${rewardTypeLabel}`));

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

  Object.assign(parts, { summary, settingSummary, breakdown, clubExpenseBreakdown });
})();
