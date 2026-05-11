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

function seedDebugData({ missing = false } = {}) {
    const carCount = parseInt(byId('debugCarCount')?.value) || 3;

    const drivers = [
        { name: '高橋 健介', cap: 3, gender: 'male' },
        { name: '中村 美咲', cap: 3, gender: 'female' },
        { name: '小林 悠斗', cap: 3, gender: 'male' },
        { name: '松本 彩花', cap: 3, gender: 'female' },
        { name: '山口 直人', cap: 3, gender: 'male' },
    ];

    const members = [
        { name: '田中 太郎', grade: 1, gender: 'male' },
        { name: '佐藤 花', grade: 1, gender: 'female' },
        { name: '鈴木 陽介', grade: 1, gender: 'male' },
        { name: '伊藤 美月', grade: 1, gender: 'female' },
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
        { name: '近藤 直樹', grade: 4, gender: 'male' },
    ];

    byId('waiting-list').innerHTML = '';
    byId('cars-container').innerHTML = '';
    byId('roomNameInput').value = missing ? '入力漏れテスト' : '新歓企画 5/12';
    settlementState = normalizeSettlementState({
        rounding: '100', organizerFree: true, organizerName: '田中 太郎', driverReward: '1000', cars: {}, paid: {}, driverPaid: {}
    });

    const usedDrivers = drivers.slice(0, carCount);
    usedDrivers.forEach((d, idx) => {
        addCar(d.name, d.cap, [], '', d.gender);
        settlementState.cars[d.name] = normalizeCarSettlementState({
            dist: missing && idx === 0 ? '180' : String(150 + idx * 28),
            eco: missing && idx === 0 ? '' : String(12 + idx * 2),
            price: '170',
            extras: missing && idx === 1
                ? [{ name: '', amount: '2500', type: 'split' }, { name: 'レンタカー代', amount: '', type: 'club' }]
                : [
                    { name: '高速代', amount: String(1200 + idx * 400), type: 'split' },
                    { name: '駐車場', amount: idx % 2 === 0 ? '800' : '', type: 'split' },
                    { name: idx === 0 ? 'レンタカー代' : '差し入れ', amount: idx === 0 ? '3000' : '600', type: 'club' }
                  ].filter(hasMeaningfulExtra)
        });
    });

    const totalSeats = usedDrivers.reduce((sum, d) => sum + d.cap, 0);
    const shuffled = members.slice(0, totalSeats).sort(() => Math.random() - 0.5);
    shuffled.forEach(m => {
        addMember(m.name, m.memo || '', m.gender, m.grade, byId('waiting-list'), false);
    });

    updateUI();
    save();

    if (window.modals && window.modals.debug) window.modals.debug.hide();

    setTimeout(() => {
        switchView('seisan');
    }, 200);
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
