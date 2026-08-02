// Settlement calculation and validation helpers.
// Split from features/settlement.js during S-3 cleanup.

function calculateSettlement(data, state) {
    const participants = getParticipantList(data);
    const organizerName = state.organizerName || '';
    const organizerSelected = !!organizerName;
    const excludedName = state.organizerFree && organizerSelected ? organizerName : '';
    const driverNames = new Set((data.cars || []).map(car => String(car.name || '').trim()).filter(Boolean));
    const driverCollectionOffset = isDriverCollectionOffsetEnabled(state);
    const driverCollectionFree = isDriverCollectionFreeEnabled(state);
    const excludedNames = new Set();
    if (driverCollectionOffset || driverCollectionFree) driverNames.forEach(name => excludedNames.add(name));
    if (excludedName) excludedNames.add(excludedName);
    const payerCount = participants.filter(p => !excludedNames.has(p.name)).length;
    const shareExcludedNames = new Set();
    if (excludedName) shareExcludedNames.add(excludedName);
    if (driverCollectionFree) driverNames.forEach(name => shareExcludedNames.add(name));
    const shareCount = participants.filter(p => !shareExcludedNames.has(p.name)).length;
    const rounding = getNumberValue(state.rounding) || 100;
    const reward = getDriverRewardAmount(state);

    let totalSplit = 0;
    let totalClub = 0;
    let totalReward = 0;
    let totalDriverRound = 0;
    const cars = (data.cars || []).map(car => {
        const cState = ensureDriverRewardExtra(state.cars?.[car.name] || {}, state);
        const dist = getNumberValue(cState.dist);
        const eco = getNumberValue(cState.eco);
        const price = getNumberValue(cState.price);
        const usesTimesRental = isTimesRentalCar(cState);
        const gas = !usesTimesRental && dist > 0 && eco > 0 && price > 0 ? Math.round((dist / eco) * price) : 0;
        const timesDistanceFee = usesTimesRental ? getTimesDistanceFee(cState.dist) : 0;
        const extras = cState.extras.map(normalizeExtraItem).filter(hasMeaningfulExtra).map(ex => {
            const isTimesDistanceFee = usesTimesRental && isTimesDistanceFeeExtra(ex);
            const type = normalizeSettlementExtraType(ex.type);
            const amount = isTimesDistanceFee ? String(timesDistanceFee) : ex.amount;
            const amountValue = isTimesDistanceFee
                ? (isNegativeSettlementExtraType(type) ? -Math.abs(timesDistanceFee) : timesDistanceFee)
                : getSignedSettlementExtraAmount({ ...ex, type, amount });
            return {
                ...ex,
                type,
                baseType: getSettlementExtraBaseType(type),
                isNegative: amountValue < 0,
                amount,
                amountValue,
                isDriverReward: isDriverRewardExtra(ex),
                isTimesDistanceFee
            };
        });
        const splitExtras = extras.filter(ex => ex.baseType === 'split').reduce((sum, ex) => sum + ex.amountValue, 0);
        const clubExtras = extras.filter(ex => ex.baseType === 'club').reduce((sum, ex) => sum + ex.amountValue, 0);
        const rewardAmount = extras.filter(ex => ex.isDriverReward).reduce((sum, ex) => sum + ex.amountValue, 0);
        const split = gas + splitExtras;
        const rawPay = split + clubExtras;
        const totalPay = roundUp(rawPay, 100);
        const driverRound = totalPay - rawPay;
        totalSplit += split;
        totalClub += clubExtras;
        totalReward += rewardAmount;
        totalDriverRound += driverRound;
        return {
            name: car.name,
            gas,
            rentalType: cState.rentalType,
            usesTimesRental,
            timesDistanceFee,
            extras,
            splitExtras,
            clubExtras,
            reward: rewardAmount,
            rawPay,
            totalPay,
            driverRound
        };
    });

    const perPerson = shareCount > 0 ? roundUp(totalSplit / shareCount, rounding) : 0;
    const expectedCollected = perPerson * payerCount;
    const surplus = expectedCollected - totalSplit;
    cars.forEach(car => {
        car.collectionOffset = driverCollectionOffset && driverNames.has(car.name) && car.name !== excludedName ? perPerson : 0;
        car.adjustedTotalPay = Math.max(0, car.totalPay - car.collectionOffset);
    });
    const totalDriverCollectionOffset = cars.reduce((sum, c) => sum + c.collectionOffset, 0);
    const driverTotal = cars.reduce((sum, c) => sum + c.adjustedTotalPay, 0);
    const accounting = driverTotal - expectedCollected;
    const paidCount = participants.filter(p => {
        if (excludedNames.has(p.name)) return false;
        return !!state.paid?.[p.name];
    }).length;
    const unpaidCount = Math.max(0, payerCount - paidCount);

    return {
        isStandaloneSettlement: !!data.isStandaloneSettlement,
        standaloneCounts: data.standaloneCounts || null,
        participants,
        organizerSelected,
        excludedName,
        excludedNames,
        driverNames,
        driverCollectionOffset,
        driverCollectionFree,
        payerCount,
        shareCount,
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
        totalDriverCollectionOffset,
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
    if (!result.isStandaloneSettlement && state.organizerFree && participants.length > 0 && !state.organizerName) messages.push('企画者を選ぶと、企画者の集金対象外を正確にできます。');
    if (result.payerCount <= 0 && participants.length > 0) messages.push('集金対象が0人です。企画者・車出し設定を確認してください。');

    (data.cars || []).forEach(car => {
        const cState = ensureDriverRewardExtra(state.cars?.[car.name] || {}, state);
        const usesTimesRental = isTimesRentalCar(cState);
        if (usesTimesRental) {
            const distRaw = String(cState.dist ?? '').trim();
            if (!distRaw || getNumberValue(distRaw) <= 0) {
                fields.add(`${car.name}:dist`);
                rows.add(car.name);
                messages.push(`${car.name}車のタイムズ移動料金に移動距離が必要です。`);
            }
        } else {
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
        }
        cState.extras.forEach((ex, i) => {
            const hasName = String(ex.name ?? '').trim();
            const hasAmount = String(ex.amount ?? '').trim();
            if (hasAmount && !hasName) {
                fields.add(`${car.name}:extra:${i}:name`);
                rows.add(car.name);
                messages.push(`${car.name}車の諸経費に名目が空の行があります。`);
            }
            if (hasName && !hasAmount && !isTimesTimeFeeExtra(ex)) {
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
