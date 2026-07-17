// Debug sample and history restore feature
// Owns sample data modal actions and history restore UI.

window.openDebugModal = function() {
    if (!window.modals) return;
    if (!window.modals.debug) {
        const el = byId('debugModal');
        window.modals.debug = new bootstrap.Modal(el);
    }
    window.modals.debug.show();
};



function setupHiddenDebugTap() {
    // デバッグ用サンプルはヘッダーの「その他」メニューから開く。
}

function createSampleTimetableItems() {
    return [
        { time: '08:00', title: '秋名山麓 集合 https://maps.google.com' },
        { time: '08:20', title: '車両確認・点呼' },
        { time: '08:30', title: 'ツーリング出発' },
        { time: '10:00', title: '赤城山 休憩' },
        { time: '12:00', title: '昼食' },
        { time: '14:00', title: '榛名湖 自由時間' },
        { time: '16:00', title: '帰路出発' },
        { time: '17:30', title: '秋名山麓 解散' }
    ];
}

function createSampleTeamPlan(participants = []) {
    const people = participants.map(member => ({
        name: member.name,
        memo: member.memo || '',
        gender: member.gender || 'unknown',
        grade: parseInt(member.grade) || 0,
        locked: false
    })).filter(member => member.name);

    const firstLeader = people[0] || { name: '田中 太郎', gender: 'male', grade: 1, memo: '' };
    const secondLeader = people[4] || people[1] || { name: '伊藤 美月', gender: 'female', grade: 1, memo: '' };
    const thirdLeader = people[8] || people[2] || { name: '石井 拓海', gender: 'male', grade: 2, memo: '' };
    const firstMembers = people.slice(1, 4);
    const secondMembers = people.slice(5, 8);
    const thirdMembers = people.slice(9, 12);
    const usedNames = new Set([
        firstLeader.name,
        secondLeader.name,
        thirdLeader.name,
        ...firstMembers.map(m => m.name),
        ...secondMembers.map(m => m.name),
        ...thirdMembers.map(m => m.name)
    ]);

    return {
        id: typeof SINGLE_TEAM_PLAN_ID !== 'undefined' ? SINGLE_TEAM_PLAN_ID : 'plan-team',
        name: '班',
        templateType: 'team',
        lastAutoAssignLabel: '',
        waiting: people.filter(member => !usedNames.has(member.name)),
        cars: [
            {
                name: firstLeader.name,
                capacity: 5,
                driverMemo: firstLeader.memo || '',
                driverGender: firstLeader.gender || 'unknown',
                driverGrade: firstLeader.grade || 0,
                members: firstMembers
            },
            {
                name: secondLeader.name,
                capacity: 5,
                driverMemo: secondLeader.memo || '',
                driverGender: secondLeader.gender || 'unknown',
                driverGrade: secondLeader.grade || 0,
                members: secondMembers
            },
            {
                name: thirdLeader.name,
                capacity: 5,
                driverMemo: thirdLeader.memo || '',
                driverGender: thirdLeader.gender || 'unknown',
                driverGrade: thirdLeader.grade || 0,
                members: thirdMembers
            }
        ]
    };
}

function getSampleDrivers() {
    return [
        { name: '藤原 拓海', capacity: 3, gender: 'male', grade: 3, memo: '' },
        { name: '高橋 啓介', capacity: 3, gender: 'male', grade: 4, memo: '' },
        { name: '高橋 涼介', capacity: 4, gender: 'male', grade: 4, memo: '' },
        { name: '須藤 京一', capacity: 3, gender: 'male', grade: 4, memo: '' },
        { name: '小柏 カイ', capacity: 3, gender: 'male', grade: 3, memo: '' }
    ];
}

function getSampleMembers() {
    return [
        { name: '武内 樹', grade: 3, gender: 'male' },
        { name: '茂木 なつき', grade: 3, gender: 'female' },
        { name: '池谷 浩一郎', grade: 4, gender: 'male' },
        { name: '健二', grade: 4, gender: 'male' },
        { name: '中村 賢太', grade: 3, gender: 'male' },
        { name: '佐藤 真子', grade: 4, gender: 'female' },
        { name: '沙雪', grade: 4, gender: 'female' },
        { name: '秋山 渉', grade: 4, gender: 'male' },
        { name: '秋山 和美', grade: 3, gender: 'female' },
        { name: '岩城 清次', grade: 4, gender: 'male' },
        { name: '立花 祐一', grade: 4, gender: 'male' },
        { name: '藤原 文太', grade: 4, gender: 'male' },
        { name: '庄司 慎吾', grade: 4, gender: 'male' },
        { name: '小柏 健', grade: 4, gender: 'male' },
        { name: '北条 凛', grade: 4, gender: 'male' },
        { name: '北条 豪', grade: 4, gender: 'male' },
        { name: '皆川 英雄', grade: 4, gender: 'male' },
        { name: '乾 信司', grade: 2, gender: 'male' }
    ];
}

function cloneSampleMember(member = {}) {
    return {
        name: member.name,
        memo: member.memo || '',
        gender: member.gender || 'unknown',
        grade: parseInt(member.grade) || 0,
        locked: !!member.locked
    };
}

function getSampleMemberLimitForCars(drivers = []) {
    return drivers.reduce((total, driver) => {
        const capacity = Math.max(0, Number(driver.capacity) || 0);
        return total + capacity;
    }, 0);
}

function createSampleCarPlan(carCount = 3) {
    const drivers = getSampleDrivers().slice(0, Math.max(2, Math.min(5, Number(carCount) || 3)));
    const seatCount = getSampleMemberLimitForCars(drivers);
    // サンプル投入直後に「入りきらない人」が出ないよう、車の席数ぶんだけ参加者を使う。
    const members = getSampleMembers().slice(0, seatCount).map(cloneSampleMember);
    let cursor = 0;
    const cars = drivers.map((driver) => {
        const count = Math.max(0, Number(driver.capacity) || 3);
        const assigned = members.slice(cursor, cursor + count);
        cursor += count;
        return {
            name: driver.name,
            capacity: driver.capacity,
            driverMemo: driver.memo || '',
            driverGender: driver.gender || 'unknown',
            driverGrade: driver.grade || 0,
            members: assigned
        };
    });

    return {
        id: typeof SINGLE_CAR_PLAN_ID !== 'undefined' ? SINGLE_CAR_PLAN_ID : 'plan-car',
        name: '車割',
        templateType: 'car',
        lastAutoAssignLabel: 'サンプル配置',
        waiting: [],
        cars
    };
}

function createSampleSettlementState(carPlan, { missing = false } = {}) {
    const normalCars = {
        '藤原 拓海': { dist: '186', eco: '18', price: '158', rentalType: 'private', extras: [{ name: '駐車場', amount: '200', type: 'split' }] },
        '高橋 啓介': { dist: '242', eco: '14', price: '162', rentalType: 'times', extras: [{ name: '駐車場', amount: '200', type: 'split' }] },
        '高橋 涼介': { dist: '218', eco: '16.5', price: '160', rentalType: 'private', extras: [{ name: '駐車場', amount: '200', type: 'split' }] },
        '須藤 京一': { dist: '295', eco: '12.5', price: '165', rentalType: 'times', extras: [{ name: '駐車場', amount: '200', type: 'split' }] },
        '小柏 カイ': { dist: '134', eco: '20', price: '155', rentalType: 'private', extras: [{ name: '駐車場', amount: '200', type: 'split' }] }
    };
    const missingCars = {
        ...normalCars,
        '藤原 拓海': { ...normalCars['藤原 拓海'], eco: '' },
        '高橋 啓介': { ...normalCars['高橋 啓介'], dist: '' },
        '高橋 涼介': { ...normalCars['高橋 涼介'], price: '' }
    };
    const source = missing ? missingCars : normalCars;
    const cars = {};
    (carPlan.cars || []).forEach(car => {
        cars[car.name] = normalizeCarSettlementState(source[car.name] || { dist: '180', eco: '15', price: '160', extras: [{ name: '駐車場', amount: '200', type: 'split' }] });
    });
    return normalizeSettlementState({
        rounding: '100',
        organizerFree: true,
        organizerName: '高橋 涼介',
        driverCollectionOffset: true,
        driverReward: '1000',
        cars,
        routeStops: ['秋名山', '赤城山', '榛名湖'],
        paid: {},
        driverPaid: {}
    });
}

function createSampleAppData({ missing = false, carCount = 3 } = {}) {
    const safeCarCount = Math.max(2, Math.min(5, Number(carCount) || 3));
    const carPlan = createSampleCarPlan(safeCarCount);
    const allParticipants = [
        ...(carPlan.cars || []).flatMap(car => [
            { name: car.name, memo: car.driverMemo || '', gender: car.driverGender || 'unknown', grade: car.driverGrade || 0 },
            ...(car.members || [])
        ]),
        ...(carPlan.waiting || [])
    ].map(cloneSampleMember);
    const teamPlan = createSampleTeamPlan(allParticipants);

    return {
        schemaVersion: typeof APP_SCHEMA_VERSION !== 'undefined' ? APP_SCHEMA_VERSION : 3,
        roomName: missing ? '入力漏れチェック用サンプル' : '秋名・赤城ツーリング',
        trayMinimized: false,
        editLockEnabled: false,
        editLockPassphrase: '',
        editLockScopes: { allocation: false, settlement: false },
        activeCarPlanId: carPlan.id,
        carPlans: [carPlan, teamPlan],
        lastAutoAssignLabel: carPlan.lastAutoAssignLabel || '',
        waiting: carPlan.waiting,
        cars: carPlan.cars,
        settlement: createSampleSettlementState(carPlan, { missing }),
        overview: {
            memo: missing
                ? '入力漏れや未入力欄の見え方を確認するためのサンプルです。'
                : '頭文字Dの登場人物を使ったツーリング企画サンプルです。',
            timetableItems: createSampleTimetableItems()
        },
        lastUpdatedAt: Date.now()
    };
}

function seedDebugData({ missing = false } = {}) {
    try {
        const carCount = parseInt(byId('debugCarCount')?.value, 10) || 3;
        const sampleData = createSampleAppData({ missing, carCount });
        const previousCardSuspend = !!window.__suspendCardUpdateUi;
        const previousDomSyncSuspend = !!window.__suspendActiveDomPlanSync;
        window.__suspendCardUpdateUi = true;
        window.__suspendActiveDomPlanSync = true;
        try {
            restore(migrateAppData(sampleData));
        } finally {
            window.__suspendCardUpdateUi = previousCardSuspend;
            window.__suspendActiveDomPlanSync = previousDomSyncSuspend;
        }
        updateUI();
        save();

        if (window.modals && window.modals.debug) window.modals.debug.hide();
        showAppNotice?.(missing ? '入力漏れサンプルを入れました' : '通常サンプルを入れました');

        setTimeout(() => {
            switchView('seisan');
        }, 120);
    } catch (error) {
        console.error('Failed to seed sample data:', error);
        window.__sampleDataLastError = String(error?.stack || error?.message || error);
        appAlert?.('サンプルデータを入れられませんでした。画面を更新してもう一度試してください。', { title: 'サンプルデータ' });
    }
}

window.executeDebugMode = function() { seedDebugData({ missing: false }); };
window.executeDebugMissingCostMode = function() { seedDebugData({ missing: true }); };

window.showHistory = () => {
    const hist = window.SanpoHistory?.read(roomId) || safeLocalGet('syawari_history_' + roomId, []);
    const container = byId('history-list');
    container.replaceChildren();
    if (hist.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'p-3 text-center text-muted';
        empty.textContent = '履歴がありません';
        container.appendChild(empty);
    } else {
        hist.forEach((h) => {
            const d = new Date(h.time);
            const timeStr = d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'list-group-item list-group-item-action d-flex justify-content-between align-items-center gap-2';
            const meta = document.createElement('span');
            meta.className = 'history-meta';
            const title = document.createElement('strong');
            title.textContent = h.data?.roomName || '企画名未設定';
            const sub = document.createElement('small');
            const waiting = h.data?.waiting?.length || 0;
            const cars = h.data?.cars?.length || 0;
            sub.textContent = `${timeStr}・車 ${cars}台・未割り当て ${waiting}人`;
            meta.append(title, sub);
            const badge = document.createElement('span');
            badge.className = 'badge bg-primary rounded-pill';
            badge.textContent = '復元';
            btn.append(meta, badge);
            btn.addEventListener('click', async () => {
                if (await appConfirm('この状態に復元しますか？現在の状態は一時的にバックアップされます。', { title: '履歴を復元', okText: '復元' })) {
                    lastHistoryRestoreBackup = getData();
                    restore(migrateAppData(h.data));
                    save();
                    modals.history.hide();
                    showUndoRestoreToast('履歴を復元しました', () => {
                        if (!lastHistoryRestoreBackup) return;
                        restore(migrateAppData(lastHistoryRestoreBackup));
                        save();
                        lastHistoryRestoreBackup = null;
                        showAppNotice('復元前の状態に戻しました');
                    });
                }
            });
            container.appendChild(btn);
        });
    }
    applyRuntimeAccessibilityFixes(container);
    modals.history.show();
};
