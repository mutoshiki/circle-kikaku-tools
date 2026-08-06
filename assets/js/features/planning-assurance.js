// Planning assurance: Carbon inline validation, first-use toggletip and loading skeleton.
(function (global) {
    'use strict';

    let checkModal = null;

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
        const menuItem = document.getElementById('planningCheckBtn');
        if (!menuItem) return [];
        const issues = collectPlanningIssues();
        menuItem.shortcut = issues.length === 0 ? '' : String(issues.length);
        return issues;
    }

    function renderPlanningCheck() {
        const issues = refreshPlanningCheckCount();
        const summary = document.getElementById('planningCheckSummary');
        const list = document.getElementById('planningCheckList');
        if (!summary || !list) return;
        const success = issues.length === 0;
        summary.kind = success ? 'success' : 'warning';
        summary.setAttribute('kind', summary.kind);
        summary.replaceChildren();
        const title = document.createElement('span');
        title.slot = 'title';
        title.textContent = success ? '共有前の確認は完了です' : `要確認 ${issues.length}件`;
        const subtitle = document.createElement('span');
        subtitle.slot = 'subtitle';
        subtitle.textContent = success
            ? '現在、確認が必要な項目はありません。'
            : '共有前に以下の項目を確認してください。';
        summary.append(title, subtitle);
        list.innerHTML = issues.map(issue => `
            <div class="planning-check-item" data-tone="${issue.tone}">
                <span data-carbon-icon="${issue.tone === 'error' ? 'error--filled' : 'warning--alt'}" aria-hidden="true"></span>
                <div><strong>${escapeHtml(issue.title)}</strong><span>${escapeHtml(issue.detail || '')}</span></div>
            </div>`).join('');
    }

    function openPlanningCheck() {
        renderPlanningCheck();
        const modalEl = document.getElementById('planningCheckModal');
        if (!modalEl || !global.AppModalAdapter) return;
        checkModal ||= global.AppModalAdapter.getOrCreateInstance(modalEl);
        checkModal.show();
    }

    function finishCoachmark() {
        // The non-blocking user guide replaces the old coachmark flow.
    }

    function maybeShowPlanningCoach() {
        // Onboarding is available in the user guide; avoid blocking the workspace.
    }

    function setupPlanningAssurance() {
        showAppLoadingSkeleton();
        document.getElementById('planningCheckBtn')?.addEventListener('click', openPlanningCheck);
        refreshPlanningCheckCount();
    }

    global.showAppLoadingSkeleton = showAppLoadingSkeleton;
    global.hideAppLoadingSkeleton = hideAppLoadingSkeleton;
    global.openPlanningCheck = openPlanningCheck;
    global.refreshPlanningCheckCount = refreshPlanningCheckCount;
    global.maybeShowPlanningCoach = maybeShowPlanningCoach;
    global.dismissPlanningCoach = finishCoachmark;
    global.setupPlanningAssurance = setupPlanningAssurance;
})(window);
