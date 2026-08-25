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
        return String(document.getElementById('roomNameInput')?.value || '').trim().slice(0, 200);
    }

    function readBugReportPlatform() {
        const nav = global.navigator;
        return String(nav?.userAgentData?.platform || nav?.platform || '').slice(0, 160);
    }

    function setCarbonSideNavExpanded(expanded, options = {}) {
        const drawer = document.getElementById('overviewDrawer');
        const trigger = document.getElementById('overviewMenuBtn');
        if (!drawer || drawer.tagName !== 'CDS-SIDE-NAV' || !trigger || trigger.tagName !== 'CDS-HEADER-MENU-BUTTON') return;

        const next = Boolean(expanded);
        drawer.expanded = next;
        drawer.toggleAttribute('expanded', next);
        trigger.active = next;
        trigger.toggleAttribute('active', next);
        trigger.setAttribute('aria-expanded', String(next));
        if (!next && options.restoreFocus) queueMicrotask(() => trigger.focus?.());
    }

    function setupCarbonSideNavigationState() {
        const drawer = document.getElementById('overviewDrawer');
        const trigger = document.getElementById('overviewMenuBtn');
        if (!drawer || drawer.tagName !== 'CDS-SIDE-NAV' || !trigger || trigger.tagName !== 'CDS-HEADER-MENU-BUTTON') return;

        trigger.setAttribute('aria-controls', 'overviewDrawer');
        setCarbonSideNavExpanded(Boolean(drawer.expanded || drawer.hasAttribute('expanded')));
        if (trigger.dataset.sideNavStateBound === 'true') return;
        trigger.dataset.sideNavStateBound = 'true';

        trigger.addEventListener('click', () => {
            const expanded = Boolean(drawer.expanded || drawer.hasAttribute('expanded'));
            setCarbonSideNavExpanded(!expanded);
        });
        drawer.addEventListener('click', event => {
            if (!event.composedPath().some(node => node?.tagName === 'CDS-SIDE-NAV-LINK')) return;
            setCarbonSideNavExpanded(false);
        });
        document.addEventListener('keydown', event => {
            if (event.key !== 'Escape' || !(drawer.expanded || drawer.hasAttribute('expanded'))) return;
            setCarbonSideNavExpanded(false, { restoreFocus: true });
        });
    }

    function normalizeProjectTitle(value) {
        return String(value ?? '').replace(/[\r\n]+/g, '');
    }

    function syncEditorFromProjectTitleSource(roomInput, editor) {
        if (!roomInput || !editor) return;
        const next = normalizeProjectTitle(roomInput.value || '');
        if (editor.textContent !== next) editor.textContent = next;
        if (!next && editor.childNodes.length) editor.replaceChildren();
    }

    function installProjectTitleValueBridge(roomInput, editor) {
        if (!roomInput || roomInput.dataset.projectTitleValueBridge === 'true') return;
        let prototype = Object.getPrototypeOf(roomInput);
        let valueDescriptor = null;
        while (prototype && !valueDescriptor) {
            valueDescriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
            prototype = Object.getPrototypeOf(prototype);
        }
        if (!valueDescriptor?.get || !valueDescriptor?.set) return;

        Object.defineProperty(roomInput, 'value', {
            configurable: true,
            enumerable: valueDescriptor.enumerable,
            get() {
                return valueDescriptor.get.call(this);
            },
            set(value) {
                const next = normalizeProjectTitle(value);
                valueDescriptor.set.call(this, next);
                syncEditorFromProjectTitleSource(this, editor);
            }
        });
        roomInput.dataset.projectTitleValueBridge = 'true';
    }

    function createRestoredProjectTitleEditor(roomInput) {
        const editor = document.createElement('div');
        editor.id = 'projectTitleEditor';
        editor.className = 'project-title-editor';
        editor.setAttribute('contenteditable', 'plaintext-only');
        editor.setAttribute('role', 'textbox');
        editor.setAttribute('aria-label', '企画名');
        editor.setAttribute('aria-placeholder', '企画名を入力');
        editor.setAttribute('aria-multiline', 'false');
        editor.setAttribute('data-placeholder', '企画名を入力');
        editor.setAttribute('spellcheck', 'false');
        editor.tabIndex = 0;

        const syncToSource = () => {
            const next = normalizeProjectTitle(editor.textContent || '');
            if (!next && editor.childNodes.length) editor.replaceChildren();
            else if (editor.textContent !== next) editor.textContent = next;
            if (roomInput.value !== next) roomInput.value = next;
            roomInput.setAttribute('value', next);
            roomInput.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        };

        editor.addEventListener('beforeinput', event => {
            if (event.inputType === 'insertParagraph' || event.inputType === 'insertLineBreak') event.preventDefault();
        });
        editor.addEventListener('keydown', event => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            editor.blur();
        });
        editor.addEventListener('input', event => {
            if (!event.isComposing) syncToSource();
        });
        editor.addEventListener('compositionend', syncToSource);
        editor.addEventListener('blur', syncToSource);
        syncEditorFromProjectTitleSource(roomInput, editor);
        return editor;
    }

    function setupRestoredProjectTitleEditor() {
        const region = document.getElementById('projectTitleRegion');
        const roomInput = document.getElementById('roomNameInput');
        const roomField = roomInput?.closest('.app-room-field');
        const content = region?.querySelector('.project-title-content') || region;
        if (!region || !roomInput || !roomField || !content) return;

        let editor = document.getElementById('projectTitleEditor');
        if (!editor) {
            editor = createRestoredProjectTitleEditor(roomInput);
            content.insertBefore(editor, roomField);
        }

        roomField.classList.add('project-title-source');
        roomField.setAttribute('aria-hidden', 'true');
        roomInput.setAttribute('aria-hidden', 'true');
        roomInput.tabIndex = -1;
        syncEditorFromProjectTitleSource(roomInput, editor);
        roomInput.addEventListener('input', () => syncEditorFromProjectTitleSource(roomInput, editor));

        const installBridge = () => {
            installProjectTitleValueBridge(roomInput, editor);
            syncEditorFromProjectTitleSource(roomInput, editor);
        };
        if (customElements.get('cds-text-input')) installBridge();
        else customElements.whenDefined('cds-text-input').then(installBridge).catch(() => {});

        const syncExpandedState = () => {
            const expanded = region.dataset.state !== 'collapsed';
            if (!expanded && document.activeElement === editor) editor.blur();
            editor.inert = !expanded;
            editor.tabIndex = expanded ? 0 : -1;
        };
        syncExpandedState();
        if (region.dataset.projectTitleEditorObserverBound !== 'true') {
            region.dataset.projectTitleEditorObserverBound = 'true';
            const observer = new MutationObserver(syncExpandedState);
            observer.observe(region, { attributes: true, attributeFilter: ['data-state'] });
            global.__projectTitleEditorObserver = observer;
        }
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
        const reportLink = document.getElementById('bugReportMenuItem');
        if (reportLink?.dataset.bugReportBound !== 'true') {
            reportLink.dataset.bugReportBound = 'true';
            reportLink.addEventListener('click', event => {
                event.preventDefault();
                setCarbonSideNavExpanded(false);
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
        setupRestoredProjectTitleEditor();
        setupCarbonSideNavigationState();
        setupBugReportNavigation();
        events.setupGeneratedHtmlEventDelegation?.();
        events.setupSettlementInputEvents?.();
        events.setupViewAndFeatureEvents?.();
    }

    global.SanpoEventBindings = Object.freeze({ setupAppEventListeners });

    document.addEventListener('DOMContentLoaded', setupAppEventListeners);
})(window);