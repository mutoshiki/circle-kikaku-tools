// App event startup.
// Individual event owners live in assets/js/features/events/ to keep this file from becoming a catch-all.
(function (global) {
    'use strict';

    const BUG_REPORT_MAX_LENGTH = 2000;
    let bugReportModalAdapter = null;
    let bugReportSubmitting = false;

    function ensureBugReportModal() {
        let modal = document.getElementById('bugReportModal');
        if (!modal) {
            modal = document.createElement('cds-modal');
            modal.id = 'bugReportModal';
            modal.className = 'app-modal';
            modal.setAttribute('size', 'sm');
            modal.setAttribute('aria-label', 'バグを報告する');
            modal.innerHTML = `
                <cds-modal-header>
                    <cds-modal-heading data-modal-primary-focus id="bugReportModalTitle" class="app-modal-heading" tabindex="-1">バグを報告する</cds-modal-heading>
                    <cds-modal-close-button data-modal-close close-button-label="閉じる"></cds-modal-close-button>
                </cds-modal-header>
                <cds-modal-body class="app-modal-body">
                    <cds-textarea id="bugReportMessage" rows="6" size="lg" label="バグの内容" maxlength="${BUG_REPORT_MAX_LENGTH}"></cds-textarea>
                </cds-modal-body>
                <cds-modal-footer class="app-modal-footer app-modal-footer--single">
                    <cds-modal-footer-button id="bugReportSubmitBtn" type="button" kind="primary" disabled>送信</cds-modal-footer-button>
                </cds-modal-footer>`;
            document.body.appendChild(modal);
        }
        if (!bugReportModalAdapter && global.AppModalAdapter) {
            bugReportModalAdapter = global.AppModalAdapter.getOrCreateInstance(modal);
        }
        return modal;
    }

    function syncBugReportSubmitState(modal) {
        const input = modal?.querySelector('#bugReportMessage');
        const submit = modal?.querySelector('#bugReportSubmitBtn');
        if (!input || !submit) return;
        const hasMessage = String(input.value || '').trim().length > 0;
        const disabled = bugReportSubmitting || !hasMessage;
        submit.disabled = disabled;
        submit.toggleAttribute('disabled', disabled);
    }

    function readBugReportView() {
        if (document.body.classList.contains('view-mode-sheet')) return '共有画面';
        if (document.body.classList.contains('view-mode-seisan')) return '精算';
        return document.body.dataset.activePlanTemplate === 'team' ? '班割' : '車割';
    }

    function readBugReportProjectTitle() {
        return String(
            document.getElementById('projectTitleEditor')?.textContent
            || document.getElementById('roomNameInput')?.value
            || ''
        ).trim().slice(0, 200);
    }

    function readBugReportPlatform() {
        const nav = global.navigator;
        return String(nav?.userAgentData?.platform || nav?.platform || '').slice(0, 160);
    }

    async function submitBugReport(modal) {
        if (bugReportSubmitting) return;
        const input = modal?.querySelector('#bugReportMessage');
        const message = String(input?.value || '').trim();
        if (!message) {
            syncBugReportSubmitState(modal);
            return;
        }

        bugReportSubmitting = true;
        syncBugReportSubmitState(modal);
        try {
            const activeDb = typeof db !== 'undefined' ? db : null;
            const ready = typeof firebaseReady !== 'undefined' && firebaseReady === true;
            if (!activeDb || !ready) throw new Error('Firebase is not ready');

            const databaseModule = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js');
            const reportRef = databaseModule.push(databaseModule.ref(activeDb, 'bugReports'));
            const currentRoomId = typeof roomId !== 'undefined' ? String(roomId || '') : '';
            const buildId = typeof APP_BUILD_ID !== 'undefined' ? String(APP_BUILD_ID || '') : '';
            await databaseModule.set(reportRef, {
                message: message.slice(0, BUG_REPORT_MAX_LENGTH),
                createdAt: databaseModule.serverTimestamp(),
                roomId: currentRoomId.slice(0, 80),
                pageUrl: String(global.location.href || '').slice(0, 2048),
                buildId: buildId.slice(0, 120),
                projectTitle: readBugReportProjectTitle(),
                currentView: readBugReportView().slice(0, 40),
                userAgent: String(global.navigator?.userAgent || '').slice(0, 512),
                platform: readBugReportPlatform()
            });

            input.value = '';
            bugReportModalAdapter?.hide();
            global.showMiniToast?.('送信しました', 'success');
        } catch (error) {
            console.warn('Bug report submission failed:', error);
            global.showMiniToast?.('送信できませんでした', 'error');
        } finally {
            bugReportSubmitting = false;
            syncBugReportSubmitState(modal);
        }
    }

    function openBugReportModal() {
        const modal = ensureBugReportModal();
        const input = modal.querySelector('#bugReportMessage');
        if (input) input.value = '';
        syncBugReportSubmitState(modal);
        bugReportModalAdapter?.show();
    }

    function setupBugReportNavigation() {
        const list = document.querySelector('#overviewDrawer .app-nav-drawer-list');
        if (!list) return;

        let reportLink = document.getElementById('bugReportMenuItem');
        if (!reportLink) {
            const reportItem = document.createElement('li');
            reportLink = document.createElement('a');
            reportLink.id = 'bugReportMenuItem';
            reportLink.className = 'app-nav-link';
            reportLink.href = '#bug-report';
            reportLink.textContent = 'バグを報告する';
            reportItem.appendChild(reportLink);
            list.appendChild(reportItem);
        }
        if (reportLink.dataset.bugReportBound !== 'true') {
            reportLink.dataset.bugReportBound = 'true';
            reportLink.addEventListener('click', event => {
                event.preventDefault();
                queueMicrotask(openBugReportModal);
            });
        }

        const modal = ensureBugReportModal();
        const input = modal.querySelector('#bugReportMessage');
        const submit = modal.querySelector('#bugReportSubmitBtn');
        if (input?.dataset.bugReportBound !== 'true') {
            input.dataset.bugReportBound = 'true';
            input.addEventListener('input', () => syncBugReportSubmitState(modal));
        }
        if (submit?.dataset.bugReportBound !== 'true') {
            submit.dataset.bugReportBound = 'true';
            submit.addEventListener('click', () => submitBugReport(modal));
        }
        syncBugReportSubmitState(modal);
    }

    function setupAppEventListeners() {
        const events = global.SanpoEvents || {};
        events.bindCoreStartupEvents?.();
        events.setupStaticHeaderEvents?.();
        setupBugReportNavigation();
        events.setupGeneratedHtmlEventDelegation?.();
        events.setupSettlementInputEvents?.();
        events.setupViewAndFeatureEvents?.();
    }

    global.SanpoEventBindings = Object.freeze({ setupAppEventListeners });

    document.addEventListener('DOMContentLoaded', setupAppEventListeners);
})(window);