// Settlement calculation and validation helpers.
// Split from features/settlement.js during S-3 cleanup.

function calculateSettlement(data, state) {
    const participants = getParticipantList(data);
    const organizerName = state.organizerName || '';
    const organizerSelected = !!organizerName;
    const excludedName = state.organizerFree && organizerSelected ? organizerName : '';
    const payerCount = Math.max(0, state.organizerFree
        ? (organizerSelected ? participants.filter(p => p.name !== excludedName).length : participants.length - 1)
        : participants.length);
    const rounding = getNumberValue(state.rounding) || 100;
    const reward = Math.max(0, getNumberValue(state.driverReward));

    let totalSplit = 0;
    let totalClub = 0;
    let totalReward = 0;
    let totalDriverRound = 0;
    const cars = (data.cars || []).map(car => {
        const cState = normalizeCarSettlementState(state.cars?.[car.name] || {});
        const dist = getNumberValue(cState.dist);
        const eco = getNumberValue(cState.eco);
        const price = getNumberValue(cState.price);
        const gas = dist > 0 && eco > 0 && price > 0 ? Math.round((dist / eco) * price) : 0;
        const extras = cState.extras.map(normalizeExtraItem).filter(hasMeaningfulExtra).map(ex => ({
            ...ex,
            amountValue: getNumberValue(ex.amount)
        }));
        const splitExtras = extras.filter(ex => ex.type === 'split').reduce((sum, ex) => sum + ex.amountValue, 0);
        const clubExtras = extras.filter(ex => ex.type === 'club').reduce((sum, ex) => sum + ex.amountValue, 0);
        const split = gas + splitExtras;
        const rawPay = split + clubExtras + reward;
        const totalPay = roundUp(rawPay, 100);
        const driverRound = totalPay - rawPay;
        totalSplit += split;
        totalClub += clubExtras;
        totalReward += reward;
        totalDriverRound += driverRound;
        return { name: car.name, gas, extras, splitExtras, clubExtras, reward, rawPay, totalPay, driverRound };
    });

    const perPerson = payerCount > 0 ? roundUp(totalSplit / payerCount, rounding) : 0;
    const expectedCollected = perPerson * payerCount;
    const surplus = expectedCollected - totalSplit;
    const driverTotal = cars.reduce((sum, c) => sum + c.totalPay, 0);
    const accounting = driverTotal - expectedCollected;
    const paidCount = participants.filter(p => {
        if (state.organizerFree && organizerSelected && p.name === excludedName) return false;
        return !!state.paid?.[p.name];
    }).length;
    const unpaidCount = Math.max(0, payerCount - paidCount);

    return {
        participants,
        organizerSelected,
        excludedName,
        payerCount,
        rounding,
        reward,
        cars,
        totalSplit,
        totalClub,
        totalReward,
        totalDriverRound,
        perPerson,
        expectedCollected,
        surplus,
        driverTotal,
        accounting,
        paidCount,
        unpaidCount,
        unpaidAmount: unpaidCount * perPerson
    };
}

function getSettlementIssues(data, state, result) {
    const messages = [];
    const fields = new Set();
    const rows = new Set();
    const participants = result.participants || [];
    if (!participants.length) messages.push('名簿が空です。先に登録画面から参加者を入れてください。');
    if (!(data.cars || []).length) messages.push('車出しが未登録です。登録画面で追加してください。');
    if (state.organizerFree && participants.length > 0 && !state.organizerName) messages.push('企画者を選ぶと、集金対象を正確にできます。');
    if (result.payerCount <= 0 && participants.length > 0) messages.push('集金対象が0人です。企画者設定を確認してください。');

    (data.cars || []).forEach(car => {
        const cState = normalizeCarSettlementState(state.cars?.[car.name] || {});
        const hasAnyFuel = ['dist','eco','price'].some(k => String(cState[k] ?? '').trim());
        if (hasAnyFuel) {
            ['dist','eco','price'].forEach(k => {
                const raw = String(cState[k] ?? '').trim();
                if (!raw || getNumberValue(raw) <= 0) {
                    fields.add(`${car.name}:${k}`);
                    rows.add(car.name);
                }
            });
            if (fields.has(`${car.name}:dist`) || fields.has(`${car.name}:eco`) || fields.has(`${car.name}:price`)) {
                messages.push(`${car.name}車のガソリン計算に未入力または0があります。`);
            }
        }
        cState.extras.forEach((ex, i) => {
            const hasName = String(ex.name ?? '').trim();
            const hasAmount = String(ex.amount ?? '').trim();
            if (hasAmount && !hasName) {
                fields.add(`${car.name}:extra:${i}:name`);
                rows.add(car.name);
                messages.push(`${car.name}車の諸経費に名目が空の行があります。`);
            }
            if (hasName && !hasAmount) {
                fields.add(`${car.name}:extra:${i}:amount`);
                rows.add(car.name);
                messages.push(`${car.name}車の「${hasName}」の金額が空です。`);
            }
        });
    });
    return { messages: [...new Set(messages)], fields, rows };
}

function fieldErrorClass(issues, carName, key) {
    return issues.fields.has(`${carName}:${key}`) ? ' seisan-input-error' : '';
}

function extraFieldErrorClass(issues, carName, index, key) {
    return issues.fields.has(`${carName}:extra:${index}:${key}`) ? ' seisan-input-error' : '';
}
