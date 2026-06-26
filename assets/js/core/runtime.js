// Core runtime/bootstrap globals
// Extracted from app.js during S cleanup.
// Owns DOM helpers, Firebase bootstrapping, shared state, room id, and small UI wrappers.

function byId(id) {
    return document.getElementById(id);
}

function bindClick(id, handler) {
    const el = byId(id);
    if (!el || el.dataset.boundClick === 'true') return;
    el.dataset.boundClick = 'true';
    el.addEventListener('click', event => {
        event.preventDefault();
        handler(event);
    });
}

const firebaseConfig = window.SANPO_FIREBASE_CONFIG || {};
const APP_SCHEMA_VERSION = 4;
const APP_BUILD_ID = '2026-05-hardening';
let firebaseEnabled = Boolean(firebaseConfig.apiKey && firebaseConfig.databaseURL && firebaseConfig.projectId);
let app = null;
let auth = null;
let db = null;
let dbRef = null;
let firebaseReady = false;
let initializeApp = null;
let getDatabase = null;
let ref = null;
let set = null;
let update = null;
let onValue = null;
let getAuth = null;
let signInAnonymously = null;

async function initFirebaseSync() {
    if (!firebaseEnabled) return false;
    try {
        const [appModule, databaseModule, authModule] = await Promise.all([
            import("https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js"),
            import("https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js"),
            import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js")
        ]);

        initializeApp = appModule.initializeApp;
        getDatabase = databaseModule.getDatabase;
        ref = databaseModule.ref;
        set = databaseModule.set;
        update = databaseModule.update;
        onValue = databaseModule.onValue;
        getAuth = authModule.getAuth;
        signInAnonymously = authModule.signInAnonymously;

        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getDatabase(app);
        await signInAnonymously(auth);
        dbRef = ref(db, 'rooms/' + roomId);
        firebaseReady = true;
        return true;
    } catch (err) {
        const isLocalPreview = ['127.0.0.1', 'localhost'].includes(location.hostname);
        const reportFallback = isLocalPreview ? console.info : console.warn;
        reportFallback('Firebase sync disabled. Falling back to local storage only:', err);
        firebaseEnabled = false;
        firebaseReady = false;
        app = null;
        auth = null;
        db = null;
        dbRef = null;
        return false;
    }
}

const myClientId = Math.random().toString(36).substring(2) + Date.now().toString(36);

let isRemoteUpdate = false;
let saveTimer = null;
let modals = {}; 
let saveCb;
let genderQueue = [], isProcessingQueue = false;
let editLockEnabled = false;
let editLockPassphrase = '';
let editLockScopes = { allocation: false, settlement: false };
let trustedEditPassphrase = '';
let isDraggingCards = false;
let dragOriginSlot = null;
let dragHoverSlot = null;
let dragHoverOccupant = null;
let dragHoverEscapeSlot = null;
let manualCardDrag = null;
let manualSheetDrag = null;
let activeSheetSortable = [];
let quickEditMode = false;
let settlementState = null;
let settlementRenderTimer = null;
let settlementCommitTimer = null;
let settlementRenderDeferred = false;
let settlementEditingLock = false;
let settlementEditingLockTimer = null;
let settlementCompositionActive = false;
let pendingRemoteSettlementData = null;
let lastUpdatedAt = 0;
let lastAutoAssignLabel = '';
let activeCarPlanId = 'plan-1';
let carPlans = [];
let isRestoringCarPlans = false;
let lastHistoryRestoreBackup = null;

const CFG = { STORE:'sampokai_v10_split' };
const AUTO_GENDER_HEURISTIC = true; // 外部APIには送信しない。端末内の簡易推定のみ。
const D = document, L = localStorage, J = JSON;
const $ = (s, p=D) => p.querySelector(s), $$ = (s, p=D) => p.querySelectorAll(s), ce = (t, c) => { const e = D.createElement(t); if(c) e.className = c; return e; }, getInt = v => parseInt(v) || 0;

let roomId = new URLSearchParams(window.location.search).get('room');

if (!roomId) {
    roomId = Math.random().toString(36).substring(2, 10).toUpperCase();
    const newUrl = `${window.location.pathname}?room=${roomId}`;
    window.history.replaceState({path: newUrl}, '', newUrl);
}

localStorage.setItem('syawari_last_room_id', roomId);


function applyRuntimeAccessibilityFixes(root = document) {
    root.querySelectorAll('.btn-close:not([aria-label])').forEach(btn => btn.setAttribute('aria-label', '閉じる'));
    root.querySelectorAll('button[title]:not([aria-label])').forEach(btn => btn.setAttribute('aria-label', btn.getAttribute('title')));
    root.querySelectorAll('i.fas, i.fa').forEach(icon => {
        if (!icon.hasAttribute('aria-hidden')) icon.setAttribute('aria-hidden', 'true');
    });
}

function appPrompt(message, defaultValue = '', options = {}) {
    const modalEl = byId('commonEditModal');
    const input = byId('editModalInput');
    const titleEl = byId('commonEditModalTitle');
    const saveBtn = byId('saveEditBtn');
    if (!window.bootstrap || !modals?.edit || !modalEl || !input || !titleEl || !saveBtn) {
        return Promise.resolve(window.prompt(String(message || ''), String(defaultValue || '')));
    }
    return new Promise(resolve => {
        const previousSaveCb = saveCb;
        const previousTitle = titleEl.textContent;
        const previousButtonText = saveBtn.textContent;
        let settled = false;
        function cleanup() {
            modalEl.removeEventListener('hidden.bs.modal', onHidden);
            titleEl.textContent = previousTitle || '編集';
            saveBtn.textContent = previousButtonText || '保存';
            saveCb = previousSaveCb;
        }
        function finish(value) {
            if (settled) return;
            settled = true;
            cleanup();
            modals.edit.hide();
            resolve(value);
        }
        function onHidden() {
            if (settled) return;
            settled = true;
            cleanup();
            resolve(null);
        }
        titleEl.textContent = String(options.title || message || '編集');
        saveBtn.textContent = String(options.okText || '保存');
        input.value = String(defaultValue || '');
        input.setAttribute('aria-label', String(message || '入力'));
        saveCb = () => finish(input.value);
        modalEl.addEventListener('hidden.bs.modal', onHidden);
        modals.edit.show();
        setTimeout(() => { input.focus(); input.select(); }, 80);
    });
}

function appConfirm(message, options = {}) {
    return window.AppUI?.confirm ? window.AppUI.confirm(message, options) : Promise.resolve(window.confirm(String(message || '')));
}
function appAlert(message, options = {}) {
    return window.AppUI?.alert ? window.AppUI.alert(message, options) : Promise.resolve(window.alert(String(message || '')));
}
function setPersistentSaveStatus(kind = 'neutral', message = '') {
    window.AppUI?.setSyncStatus?.(kind, message);
}
function showUndoRestoreToast(message, onUndo) {
    window.AppUI?.showUndoBar?.(message, onUndo);
}
