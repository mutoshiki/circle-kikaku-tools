// Planning assurance: Carbon inline validation, first-use toggletip and loading skeleton.
(function (global) {
    'use strict';

    const COACH_KEY = 'sanpo_coach_seen_v1';
    let coachIndex = 0;
    let coachEl = null;
    let checkModal = null;

    const coachSteps = [
        {
            target: '#batchOpenBtn',
            title: '参加者を登録',
            text: '名前や学年、車出し情報をまとめて登録できます。'
        },
        {
            target: '#car-plan-switcher',
            title: '車割と班割を切り替え',
            text: '同じ参加者名簿を使いながら、2つの配置を分けて編集できます。'
        },
        {
            target: '.member-menu-btn, .driver-menu-btn, .seat-slot',
            title: 'カードから細かく設定',
            text: 'メニューからメモや汎用のしるしを設定できます。空席を押すと直接追加できます。'
        }
    ];

    function ensureLoadingSkeleton() {
        let root = document.getElementById('appLoadingSkeleton');
        if (root) return root;
        root = document.createElement('div');
        root.id = 'appLoadingSkeleton';
        root.className = 'app-loading-skeleton';
        root.setAttribute('role', 'status');
        root.setAttribute('aria-label', '企画データを読み込み中');
        root.innerHTML = `
            <div class="app-loading-skeleton-grid" aria-hidden="true">
                ${Array.from({ length: 3 }, () => `
                    <section>
                        <div class="skeleton-line short"></div>
                        <div class="skeleton-line"></div>
                        <div class="skeleton-block"></div>
                    </section>`).join('')}
            </div>`;
        document.getElementById('app-layout')?.appendChild(root);
        return root;
    }

    function showAppLoadingSkeleton() {
        const root = ensureLoadingSkeleton();
        root.hidden = false;
    }

    function hideAppLoadingSkeleton() {
        const root = document.getElementById('appLoadingSkeleton');
        if (!root || root.hidden) return;
        root.hidden = true;
    }

    function peopleInPlan(plan = {}) {
        const names = [];
        (plan.cars || []).forEach(group => {
            if (group?.name) names.push(String(group.name).trim());
            (group?.members || []).forEach(member => {
                if (member?.name) names.push(String(member.name).trim());
            });
        });
        (plan.waiting || []).forEach(member => {
            if (member?.name) names.push(String(member.name).trim());
        });
        return names.filter(Boolean);
    }

    function collectPlanningIssues() {
        const issues = [];
        const plans = typeof getCarPlansSnapshot === 'function' ? getCarPlansSnapshot() : [];
        const roomName = document.getElementById('roomNameInput')?.value?.trim() || '';
        if (!roomName) issues.push({ tone: 'error', title: '企画名が未入力です', detail: '共有前に企画名を入力してください。' });

        plans.forEach(plan => {
            const type = String(plan.templateType || 'car');
            const label = type === 'team' ? '班割' : '車割';
            const groups = Array.isArray(plan.cars) ? plan.cars : [];
            const waiting = Array.isArray(plan.waiting) ? plan.waiting : [];
            if (!groups.length) issues.push({ tone: 'error', title: `${label}が未作成です`, detail: `${label}の代表者を設定してください。` });
            if (waiting.length) issues.push({ tone: 'warning', title: `${label}に未割り当てが${waiting.length}名います`, detail: waiting.slice(0, 4).map(member => member.name).filter(Boolean).join('、') + (waiting.length > 4 ? ' ほか' : '') });
            groups.forEach(group => {
                const count = (group.members || []).filter(member => member?.name).length;
                const capacity = Number(group.capacity || 0);
                if (capacity > 0 && count > capacity) issues.push({ tone: 'error', title: `${group.name || label}が定員超過です`, detail: `${count}/${capacity}名になっています。` });
            });
            const names = peopleInPlan(plan);
            const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
            [...new Set(duplicates)].forEach(name => issues.push({ tone: 'error', title: `${label}で「${name}」が重複しています`, detail: '同じ人物が複数の枠に入っています。' }));
        });

        const carPlan = plans.find(plan => String(plan.templateType || 'car') === 'car');
        const teamPlan = plans.find(plan => String(plan.templateType || '') === 'team');
        if (carPlan && teamPlan) {
            const carNames = new Set(peopleInPlan(carPlan));
            const teamNames = new Set(peopleInPlan(teamPlan));
            const onlyCar = [...carNames].filter(name => !teamNames.has(name));
            const onlyTeam = [...teamNames].filter(name => !carNames.has(name));
            if (onlyCar.length || onlyTeam.length) issues.push({
                tone: 'error',
                title: '車割と班割の名簿が一致していません',
                detail: [...onlyCar, ...onlyTeam].slice(0, 5).join('、') + ([...onlyCar, ...onlyTeam].length > 5 ? ' ほか' : '')
            });
        }
        return issues;
    }

    function refreshPlanningCheckCount() {
        const badge = document.getElementById('planningCheckCount');
        if (!badge) return [];
        const issues = collectPlanningIssues();
        badge.textContent = String(issues.length);
        badge.hidden = issues.length === 0;
        return issues;
    }

    function renderPlanningCheck() {
        const issues = refreshPlanningCheckCount();
        const summary = document.getElementById('planningCheckSummary');
        const list = document.getElementById('planningCheckList');
        if (!summary || !list) return;
        const success = issues.length === 0;
        summary.dataset.tone = success ? 'success' : 'warning';
        summary.innerHTML = success
            ? '<i class="fas fa-circle-check" aria-hidden="true"></i><div><strong>共有前の確認は完了です</strong><span>現在、確認が必要な項目はありません。</span></div>'
            : `<i class="fas fa-triangle-exclamation" aria-hidden="true"></i><div><strong>要確認 ${issues.length}件</strong><span>共有前に以下の項目を確認してください。</span></div>`;
        list.innerHTML = issues.map(issue => `
            <div class="planning-check-item" data-tone="${issue.tone}">
                <i class="fas ${issue.tone === 'error' ? 'fa-circle-exclamation' : 'fa-triangle-exclamation'}" aria-hidden="true"></i>
                <div><strong>${escapeHtml(issue.title)}</strong><span>${escapeHtml(issue.detail || '')}</span></div>
            </div>`).join('');
    }

    function openPlanningCheck() {
        renderPlanningCheck();
        const modalEl = document.getElementById('planningCheckModal');
        if (!modalEl || !global.bootstrap) return;
        checkModal ||= new bootstrap.Modal(modalEl);
        checkModal.show();
    }

    function ensureCoachmark() {
        if (coachEl) return coachEl;
        coachEl = document.createElement('section');
        coachEl.className = 'app-coachmark';
        coachEl.setAttribute('role', 'dialog');
        coachEl.setAttribute('aria-modal', 'false');
        coachEl.setAttribute('aria-labelledby', 'appCoachmarkTitle');
        coachEl.innerHTML = `
            <div class="app-coachmark-step"></div>
            <h2 id="appCoachmarkTitle"></h2>
            <p></p>
            <div class="app-coachmark-actions">
                <button type="button" class="app-coachmark-skip">スキップ</button>
                <button type="button" class="app-coachmark-next">次へ</button>
            </div>`;
        coachEl.querySelector('.app-coachmark-skip').addEventListener('click', finishCoachmark);
        coachEl.querySelector('.app-coachmark-next').addEventListener('click', () => {
            if (coachIndex >= coachSteps.length - 1) finishCoachmark();
            else { coachIndex += 1; renderCoachmarkStep(); }
        });
        document.body.appendChild(coachEl);
        return coachEl;
    }

    function clearCoachTarget() {
        document.querySelectorAll('.coachmark-target').forEach(node => node.classList.remove('coachmark-target'));
    }

    function finishCoachmark() {
        clearCoachTarget();
        coachEl?.remove();
        coachEl = null;
        try { localStorage.setItem(COACH_KEY, 'true'); } catch (_) {}
    }

    function positionCoachmark(target) {
        if (!coachEl || !target) return;
        if (window.innerWidth <= 640) {
            coachEl.style.left = '12px';
            coachEl.style.top = 'auto';
            return;
        }
        const rect = target.getBoundingClientRect();
        const left = Math.min(window.innerWidth - coachEl.offsetWidth - 12, Math.max(12, rect.right - coachEl.offsetWidth));
        const top = Math.min(window.innerHeight - coachEl.offsetHeight - 12, rect.bottom + 12);
        coachEl.style.left = `${left}px`;
        coachEl.style.top = `${Math.max(12, top)}px`;
    }

    function renderCoachmarkStep() {
        clearCoachTarget();
        const step = coachSteps[coachIndex];
        const target = document.querySelector(step.target);
        if (!target) {
            if (coachIndex < coachSteps.length - 1) { coachIndex += 1; renderCoachmarkStep(); }
            else finishCoachmark();
            return;
        }
        const root = ensureCoachmark();
        target.classList.add('coachmark-target');
        root.querySelector('.app-coachmark-step').textContent = `${coachIndex + 1}/${coachSteps.length}`;
        root.querySelector('h2').textContent = step.title;
        root.querySelector('p').textContent = step.text;
        root.querySelector('.app-coachmark-next').textContent = coachIndex === coachSteps.length - 1 ? '完了' : '次へ';
        positionCoachmark(target);
    }

    function maybeShowPlanningCoach(view) {
        if (view !== 'list' || coachEl) return;
        let seen = false;
        try { seen = localStorage.getItem(COACH_KEY) === 'true'; } catch (_) {}
        const forced = new URLSearchParams(location.search).get('qa') === 'coach';
        if (seen && !forced) return;
        setTimeout(() => { coachIndex = 0; renderCoachmarkStep(); }, 260);
    }

    function setupPlanningAssurance() {
        showAppLoadingSkeleton();
        document.getElementById('planningCheckBtn')?.addEventListener('click', openPlanningCheck);
        refreshPlanningCheckCount();
        window.addEventListener('resize', () => {
            const target = document.querySelector('.coachmark-target');
            if (target) positionCoachmark(target);
        }, { passive: true });
    }

    global.showAppLoadingSkeleton = showAppLoadingSkeleton;
    global.hideAppLoadingSkeleton = hideAppLoadingSkeleton;
    global.openPlanningCheck = openPlanningCheck;
    global.refreshPlanningCheckCount = refreshPlanningCheckCount;
    global.maybeShowPlanningCoach = maybeShowPlanningCoach;
    global.setupPlanningAssurance = setupPlanningAssurance;
})(window);
