// Settlement copy/share text builder.
// Split from features/settlement.js during S-3 cleanup.

function getSettlementTextContext() {
    syncSettlementStateFromDOM();
    const data = getRoomDataOnly();
    const state = ensureSettlementState();
    const result = calculateSettlement(data, state);
    return { data, state, result, title: (data.roomName || '企画名未設定').trim() };
}

function getSettlementUnpaidNames(result, state) {
    return result.participants.filter(p => {
        if (state.organizerFree && result.organizerSelected && p.name === result.excludedName) return false;
        return !state.paid?.[p.name];
    }).map(p => p.name);
}

function copyTextWithFallback(text, successMessage) {
    navigator.clipboard.writeText(text).then(() => {
        showAppNotice(successMessage || 'コピーしました');
    }).catch(() => {
        showCopyFallback('コピーしてください', text);
    });
}

function formatSettlementExtraDetail(car) {
    const extras = Array.isArray(car.extras) ? car.extras : [];
    if (!extras.length) return 'なし';
    return extras
        .map(ex => `${ex.name || '諸経費'} ${yen(ex.amountValue)}（${ex.type === 'club' ? '部費' : '割勘'}）`)
        .join(' / ');
}

function buildSettlementOverviewText({ title, state, result }) {
    const accountingAbs = Math.abs(result.accounting || 0);
    const accountingLabel = result.accounting >= 0 ? '部費から出す' : '部費へ戻す';
    const formulaSign = result.accounting >= 0 ? '＋' : '−';
    const unpaid = getSettlementUnpaidNames(result, state);
    const splitExtraTotal = result.cars.reduce((sum, car) => sum + (car.splitExtras || 0), 0);
    const driverLines = result.cars.map(car => {
        const paidMark = state.driverPaid?.[car.name] ? '（支払い済み）' : '';
        const details = [
            `ガソリン代：${yen(car.gas)}`,
            `諸経費：${formatSettlementExtraDetail(car)}`
        ];
        if (car.driverRound) details.push(`支払い丸め：${yen(car.driverRound)}`);
        return `・${car.name}車：${yen(car.totalPay)}${paidMark}\n　${details.join(' / ')}`;
    });

    return [
        `【${title} 精算メモ】`,
        `集める：${yen(result.expectedCollected)}（${yen(result.perPerson)} × ${result.payerCount}名）`,
        `部費：${yen(accountingAbs)}（${accountingLabel}）`,
        `渡す：${yen(result.driverTotal)}`,
        `計算：集める ${formulaSign} 部費 ＝ 渡す`,
        '',
        `割勘対象：${yen(result.totalSplit)}`,
        `諸経費：割勘 ${yen(splitExtraTotal)} / 部費 ${yen(result.totalClub)}`,
        `端数余り：${yen(result.surplus)}`,
        `集金：${result.paidCount}/${result.payerCount}名`,
        `未回収：${unpaid.length ? unpaid.join('、') : 'なし'}`,
        '',
        '車出しへ',
        ...(driverLines.length ? driverLines : ['なし'])
    ].join('\n');
}

window.copySettlementText = function() {
    const ctx = getSettlementTextContext();
    copyTextWithFallback(buildSettlementOverviewText(ctx), '精算メモをコピーしました');
};
