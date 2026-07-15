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
        if (result.excludedNames?.has?.(p.name)) return false;
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

function formatSignedSettlementYen(value, showPlus = true) {
    const amount = Number(value || 0);
    const sign = amount < 0 ? '−' : (showPlus ? '＋' : '');
    return `${sign}${yen(Math.abs(amount))}`;
}

function formatSettlementExtraDetail(car) {
    const extras = Array.isArray(car.extras) ? car.extras : [];
    if (!extras.length) return 'なし';
    return extras
        .map(ex => `${ex.name || '諸経費'} ${formatSignedSettlementYen(ex.amountValue)}（${ex.type === 'club' ? '部費' : '割勘'}）`)
        .join(' / ');
}

function buildSettlementOverviewText({ title, state, result }) {
    const accountingAbs = Math.abs(result.accounting || 0);
    const accountingLabel = result.accounting >= 0 ? '部費支出' : '部費戻入';
    const formulaSign = result.accounting >= 0 ? '＋' : '−';
    const collectionBalanceLabel = result.surplus >= 0 ? '参加者集金の余り' : '参加者集金の不足';
    const unpaid = getSettlementUnpaidNames(result, state);
    const splitExtraTotal = result.cars.reduce((sum, car) => sum + (car.splitExtras || 0), 0);
    const driverLines = result.cars.map(car => {
        const paidMark = state.driverPaid?.[car.name] ? '（支払い済み）' : '';
        const details = [
            car.usesTimesRental ? 'ガソリン代：なし（タイムズ）' : `ガソリン代：${yen(car.gas)}`,
            `諸経費：${formatSettlementExtraDetail(car)}`
        ];
        if (car.collectionOffset) details.push(`− ドライバー分の集金控除：${yen(car.collectionOffset)}`);
        if (car.driverRound) details.push(`＋ 支払い額の切り上げ：${yen(car.driverRound)}`);
        return `・${car.name}車：${yen(car.adjustedTotalPay ?? car.totalPay)}${paidMark}\n　${details.join('　')}`;
    });

    return [
        `【${title} 精算メモ】`,
        `参加者集金：${yen(result.expectedCollected)}（${yen(result.perPerson)} × ${result.payerCount}名）`,
        `${accountingLabel}：${yen(accountingAbs)}`,
        `支払総額：${yen(result.driverTotal)}`,
        `計算：参加者集金 ${formulaSign} ${accountingLabel} ＝ 支払総額`,
        '',
        `割勘対象：${yen(result.totalSplit)}`,
        `諸経費：割勘 ${yen(splitExtraTotal)} / 部費 ${yen(result.totalClub)}`,
        `ドライバー分の集金控除：${formatSignedSettlementYen(-result.totalDriverCollectionOffset, false)}`,
        `${collectionBalanceLabel}：${yen(Math.abs(result.surplus))}`,
        `集金状況：${result.paidCount}/${result.payerCount}名`,
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
