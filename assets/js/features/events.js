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

        // This app deliberately keeps application navigation behind a hamburger at every width.
        // Carbon HeaderMenuButton hides in responsive mode at the lg breakpoint and is always
        // hidden in fixed mode. Rail is Carbon's supported collapse mode that keeps the real
        // menu button rendered across breakpoints; the app shell continues to place the Side Nav
        // off-canvas until its official expanded state is set.
        drawer.collapseMode = 'rail';
        drawer.setAttribute('collapse-mode', 'rail');
        trigger.collapseMode = 'rail';
        trigger.setAttribute('collapse-mode', 'rail');
        trigger.setAttribute('aria-controls', 'overviewDrawer');
        setCarbonSideNavExpanded(Boolean(drawer.expanded || drawer.hasAttribute('expanded')));
        if (trigger.dataset.sideNavStateBound === 'true') return;
        trigger.dataset.sideNavStateBound = 'true';

        const root = trigger.getRootNode?.() || document;
        root.addEventListener('cds-header-menu-button-toggled', event => {
            if (!event.composedPath?.().includes(trigger)) return;
            setCarbonSideNavExpanded(Boolean(event.detail?.active));
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

    function getCurrentProjectTitleEditor(preferredEditor = null) {
        return document.getElementById('projectTitleEditor') || preferredEditor;
    }

    function syncEditorFromProjectTitleSource(roomInput = document.getElementById('roomNameInput'), preferredEditor = null) {
        const editor = getCurrentProjectTitleEditor(preferredEditor);
        if (!roomInput || !editor) return;
        const next = normalizeProjectTitle(roomInput.value || '');
        if (editor.textContent !== next) editor.textContent = next;
        if (!next && editor.childNodes.length) editor.replaceChildren();
    }

    function setProjectTitleSourceValue(value, preferredInput = null, preferredEditor = null) {
        const roomInput = document.getElementById('roomNameInput') || preferredInput;
        if (!roomInput) return;
        const next = normalizeProjectTitle(value);
        if (roomInput.value !== next) roomInput.value = next;
        if (roomInput.getAttribute('value') !== next) roomInput.setAttribute('value', next);
        syncEditorFromProjectTitleSource(roomInput, preferredEditor);
    }

    function installProjectTitleValueBridge(roomInput, editor) {
        if (!roomInput) return;

        // Do not redefine Carbon's reactive `value` property. Lit owns that property and may
        // update it during the component lifecycle; shadowing it with Object.defineProperty
        // creates a second state owner and can replay an old empty value after a valid edit.
        // The hidden Carbon field remains the only persistence source. This bridge only mirrors
        // that source into the restored visual editor and re-syncs after canonical restore.
        if (roomInput.dataset.projectTitleValueBridge !== 'true') {
            roomInput.dataset.projectTitleValueBridge = 'true';
            const syncFromSource = () => syncEditorFromProjectTitleSource(roomInput);
            roomInput.addEventListener('input', syncFromSource);
            roomInput.addEventListener('change', syncFromSource);
        }

        if (!global.SanpoProjectTitle) {
            global.SanpoProjectTitle = Object.freeze({
                syncFromSource() {
                    syncEditorFromProjectTitleSource(document.getElementById('roomNameInput'));
                },
                setSourceValue(value) {
                    setProjectTitleSourceValue(value, roomInput, editor);
                }
            });
        }

        if (global.__projectTitleRestoreBridgeBound !== true && typeof global.restore === 'function') {
            const restoreOwner = global.restore;
            global.restore = function (...args) {
                const result = restoreOwner.apply(this, args);
                const restoredTitle = normalizeProjectTitle(
                    global.SanpoCanonicalState?.get?.()?.roomName ?? args[0]?.roomName ?? ''
                );
                global.SanpoProjectTitle?.setSourceValue?.(restoredTitle);
                // Carbon/Lit may finish a pending render after the synchronous restore call.
                // Reassert the same canonical value at those lifecycle boundaries; this does
                // not create a second persistence owner because no input event is emitted.
                queueMicrotask(() => global.SanpoProjectTitle?.setSourceValue?.(restoredTitle));
                const source = document.getElementById('roomNameInput');
                Promise.resolve(source?.updateComplete).then(() => {
                    global.SanpoProjectTitle?.setSourceValue?.(restoredTitle);
                }).catch(() => {});
                return result;
            };
            global.__projectTitleRestoreBridgeBound = true;
        }

        syncEditorFromProjectTitleSource(roomInput, editor);
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
            if (global.SanpoProjectTitle?.setSourceValue) global.SanpoProjectTitle.setSourceValue(next);
            else setProjectTitleSourceValue(next, roomInput, editor);
            roomInput.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
            queueMicrotask(() => {
                // Keep the visual editor aligned with Carbon's settled source value without
                // introducing another persistence path.
                if (document.activeElement !== editor) syncEditorFromProjectTitleSource(roomInput, editor);
            });
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

        const sharedReadOnly = new URLSearchParams(global.location.search).get('view') === 'sheet';
        let editor = document.getElementById('projectTitleEditor');
        if (!editor) {
            editor = createRestoredProjectTitleEditor(roomInput);
            content.insertBefore(editor, roomField);
        }

        roomField.classList.add('project-title-source');
        roomField.setAttribute('aria-hidden', 'true');
        roomInput.setAttribute('aria-hidden', 'true');
        roomInput.tabIndex = -1;
        const applySourceReadOnly = () => {
            // Carbon's text-input public property is `readonly` (not the native
            // HTMLInputElement `readOnly` spelling). Apply after upgrade too:
            // assigning a reactive property before upgrade would be replaced by
            // the component's own default field initializer.
            roomInput.readonly = sharedReadOnly;
            roomInput.toggleAttribute('readonly', sharedReadOnly);
            if (sharedReadOnly) roomInput.setAttribute('aria-readonly', 'true');
            else roomInput.removeAttribute('aria-readonly');
        };
        applySourceReadOnly();
        editor.setAttribute('contenteditable', sharedReadOnly ? 'false' : 'plaintext-only');
        editor.toggleAttribute('aria-readonly', sharedReadOnly);
        editor.classList.toggle('is-readonly', sharedReadOnly);
        syncEditorFromProjectTitleSource(roomInput, editor);

        const installBridge = () => {
            applySourceReadOnly();
            // Lit upgrades and reflects the initial Carbon field properties in
            // its first update. Reapply on that documented lifecycle boundary
            // so the readonly source cannot be reset by its own initializer.
            Promise.resolve(roomInput.updateComplete).then(applySourceReadOnly).catch(() => {});
            installProjectTitleValueBridge(roomInput, editor);
            syncEditorFromProjectTitleSource(roomInput, editor);
        };
        if (customElements.get('cds-text-input')) installBridge();
        else customElements.whenDefined('cds-text-input').then(installBridge).catch(() => {});

        const syncExpandedState = () => {
            const expanded = region.dataset.state !== 'collapsed';
            if ((!expanded || sharedReadOnly) && document.activeElement === editor) editor.blur();
            editor.inert = !expanded;
            editor.tabIndex = expanded && !sharedReadOnly ? 0 : -1;
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
