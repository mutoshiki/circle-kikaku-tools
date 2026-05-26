// Debug sample and history restore feature
// Owns sample data modal actions and history restore UI.

window.openDebugModal = function() {
    if (!window.modals) return;
    if (!window.modals.debug) {
        const el = byId('debugModal');
        window.modals.debug = new bootstrap.Modal(el);
    }
    setupDebugThemeControls();
    window.modals.debug.show();
};

function setupDebugThemeControls() {
    const root = byId('debugModal');
    if (!root || root.dataset.themeControlsBound === 'true') return;
    root.dataset.themeControlsBound = 'true';
    root.querySelectorAll('[data-debug-theme-mode]').forEach(button => {
        button.addEventListener('click', () => {
            window.setDebugAppearanceMode?.(button.dataset.debugThemeMode);
        });
    });
}


function setupHiddenDebugTap() {
    // デバッグ用サンプルはヘッダーの「その他」メニューから開く。
}

function createSampleTimetableItems() {
    return [
        { time: '08:00', title: '大学集合・受付' },
        { time: '08:15', title: '車ごとに点呼・荷物確認' },
        { time: '08:30', title: '出発' },
        { time: '09:25', title: 'コンビニ休憩' },
        { time: '10:10', title: '飯綱高原到着・散策 https://maps.google.com' },
        { time: '12:00', title: '昼食' },
        { time: '14:30', title: '温泉または自由時間' },
        { time: '16:00', title: '帰路出発' },
        { time: '17:10', title: '大学到着・解散' }
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
        { name: '高橋 健介', capacity: 3, gender: 'male', grade: 3, memo: 'ETCあり・荷物少なめ' },
        { name: '中村 美咲', capacity: 3, gender: 'female', grade: 2, memo: '初心者運転・早め帰宅' },
        { name: '小林 悠斗', capacity: 4, gender: 'male', grade: 4, memo: '大きめの車' },
        { name: '松本 彩花', capacity: 3, gender: 'female', grade: 3, memo: '帰りに給油予定' },
        { name: '山口 直人', capacity: 3, gender: 'male', grade: 2, memo: '集合場所に直行' }
    ];
}

function getSampleMembers() {
    return [
        { name: '田中 太郎', grade: 1, gender: 'male', memo: '会計担当' },
        { name: '佐藤 花', grade: 1, gender: 'female' },
        { name: '鈴木 陽介', grade: 1, gender: 'male' },
        { name: '伊藤 美月', grade: 1, gender: 'female', memo: '車酔いしやすい' },
        { name: '渡辺 大地', grade: 1, gender: 'male' },
        { name: '加藤 ひかり', grade: 1, gender: 'female' },
        { name: '石井 拓海', grade: 2, gender: 'male', memo: '帰りに寄り道' },
        { name: '岡田 真帆', grade: 3, gender: 'female', memo: '帰りに食事' },
        { name: '山本 蓮', grade: 1, gender: 'male' },
        { name: '井上 結衣', grade: 1, gender: 'female' },
        { name: '木村 亮', grade: 2, gender: 'male' },
        { name: '清水 春香', grade: 2, gender: 'female' },
        { name: '阿部 航', grade: 2, gender: 'male' },
        { name: '森川 さくら', grade: 2, gender: 'female' },
        { name: '小川 悠真', grade: 3, gender: 'male' },
        { name: '長谷川 翼', grade: 3, gender: 'male' },
        { name: '村上 紗季', grade: 4, gender: 'female' },
        { name: '近藤 直樹', grade: 4, gender: 'male' }
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

function createSampleCarPlan(carCount = 3) {
    const drivers = getSampleDrivers().slice(0, Math.max(2, Math.min(5, Number(carCount) || 3)));
    const members = getSampleMembers().map(cloneSampleMember);
    let cursor = 0;
    const cars = drivers.map((driver, index) => {
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
        waiting: members.slice(cursor),
        cars
    };
}

function createSampleSettlementState(carPlan, { missing = false } = {}) {
    const normalCars = {
        '高橋 健介': { dist: '86', eco: '13.5', price: '172', extras: [{ name: '駐車場', amount: '400', type: 'split' }] },
        '中村 美咲': { dist: '92', eco: '15', price: '172', extras: [{ name: '有料道路', amount: '300', type: 'split' }] },
        '小林 悠斗': { dist: '104', eco: '11.5', price: '172', extras: [{ name: '駐車場', amount: '400', type: 'split' }, { name: '部費補助', amount: '500', type: 'club' }] },
        '松本 彩花': { dist: '97', eco: '14', price: '172', extras: [{ name: '駐車場', amount: '400', type: 'split' }] },
        '山口 直人': { dist: '89', eco: '12.8', price: '172', extras: [{ name: '施設利用料', amount: '200', type: 'split' }] }
    };
    const missingCars = {
        '高橋 健介': { dist: '86', eco: '', price: '172', extras: [{ name: '駐車場', amount: '400', type: 'split' }] },
        '中村 美咲': { dist: '', eco: '15', price: '172', extras: [{ name: '', amount: '300', type: 'split' }] },
        '小林 悠斗': { dist: '104', eco: '11.5', price: '', extras: [{ name: '部費補助', amount: '', type: 'club' }] },
        '松本 彩花': { dist: '97', eco: '14', price: '172', extras: [{ name: '駐車場', amount: '400', type: 'split' }] },
        '山口 直人': { dist: '89', eco: '12.8', price: '172', extras: [{ name: '施設利用料', amount: '200', type: 'split' }] }
    };
    const source = missing ? missingCars : normalCars;
    const cars = {};
    (carPlan.cars || []).forEach(car => {
        cars[car.name] = normalizeCarSettlementState(source[car.name] || { dist: '90', eco: '13', price: '172', extras: [{ name: '駐車場', amount: '400', type: 'split' }] });
    });
    return normalizeSettlementState({
        rounding: '100',
        organizerFree: true,
        organizerName: '田中 太郎',
        driverCollectionOffset: true,
        driverReward: '0',
        cars,
        routeStops: ['信州大学工学部', '飯綱高原キャンプ場', 'むれ温泉 天狗の館'],
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
        roomName: missing ? '入力漏れチェック用サンプル' : '飯綱高原 新歓ドライブ 5/12',
        trayMinimized: false,
        editLockEnabled: false,
        editLockPassphrase: '',
        activeCarPlanId: carPlan.id,
        carPlans: [carPlan, teamPlan],
        lastAutoAssignLabel: carPlan.lastAutoAssignLabel || '',
        waiting: carPlan.waiting,
        cars: carPlan.cars,
        settlement: createSampleSettlementState(carPlan, { missing }),
        overview: {
            memo: missing
                ? '入力漏れや未入力欄の見え方を確認するためのサンプルです。'
                : '新歓ドライブを想定した確認用サンプルです。車割、班割、精算、予定表をまとめて確認できます。',
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
            btn.onclick = async () => {
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
            };
            container.appendChild(btn);
        });
    }
    applyRuntimeAccessibilityFixes(container);
    modals.history.show();
};
