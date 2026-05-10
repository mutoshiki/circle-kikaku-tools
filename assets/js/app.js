
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
const APP_SCHEMA_VERSION = 2;
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
        console.warn('Firebase sync disabled. Falling back to local storage only:', err);
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
let lastUpdatedAt = 0;
let lastAutoAssignLabel = '';
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

/* showMiniToast is only for one-off notifications. Save/sync state uses #syncStatusBadge. */
function showMiniToast(message, tone = 'neutral') {
    if (!message) return;
    let toast = byId('mini-status-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'mini-status-toast';
        document.body.appendChild(toast);
    }
    toast.className = `mini-status-toast ${tone}`;
    toast.textContent = message;
    toast.classList.add('visible');
    clearTimeout(showMiniToast.timer);
    showMiniToast.timer = setTimeout(() => toast.classList.remove('visible'), 1800);
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

const APPEARANCE_KEY = 'sanpo_appearance_settings_v1';
const DEFAULT_APPEARANCE = { mode: 'system', lightPalette: 'natural', darkPalette: 'natural' };
const APPEARANCE_PALETTE_LABELS = {
    natural: '標準',
    'light-plus': 'Light+',
    'dark-plus': 'Dark+',
    github: 'GitHub',
    ayu: 'Ayu Light',
    solarized: 'Solarized',
    'one-dark': 'One Dark Pro',
    dracula: 'Dracula',
    'tokyo-night': 'Tokyo Night',
    'night-owl': 'Night Owl',
    'monokai-pro': 'Monokai Pro',
    catppuccin: 'Catppuccin',
    'gameboy-classic': 'GameBoy',
    'eight-bit': '8-Bit',
    earthbound: 'Earthbound',
    everforest: 'Everforest',
    horizon: 'Horizon',
    'warm-burnout': 'Warm Burnout',
    'anthropic-warm': 'Anthropic',
    'gruvbox-material': 'Gruvbox Material',
    'claude-warm': 'Claude Warm',
    skyblue: 'SkyBlue',
    'retro-keyboard': 'Retro Keyboard',
    'candy-pop': 'Candy Pop',
    'graphite-red': 'Graphite Red',
};
const LIGHT_THEME_IDS = ['natural', 'gameboy-classic', 'eight-bit', 'earthbound', 'everforest', 'horizon', 'warm-burnout', 'anthropic-warm', 'gruvbox-material', 'claude-warm', 'skyblue', 'retro-keyboard', 'candy-pop', 'graphite-red', 'light-plus', 'github', 'ayu', 'solarized', 'catppuccin'];
const DARK_THEME_IDS = ['natural', 'gameboy-classic', 'eight-bit', 'earthbound', 'everforest', 'horizon', 'warm-burnout', 'anthropic-warm', 'gruvbox-material', 'claude-warm', 'skyblue', 'retro-keyboard', 'candy-pop', 'graphite-red', 'dark-plus', 'github', 'one-dark', 'dracula', 'tokyo-night', 'night-owl', 'monokai-pro', 'catppuccin'];
let appearanceSettings = { ...DEFAULT_APPEARANCE };
const appearanceMql = window.matchMedia('(prefers-color-scheme: dark)');

function normalizeAppearancePalette(value, mode = 'light') {
    const paletteAliases = {
        minimal: 'github', autumn: 'solarized', contrast: 'dark-plus', vscode: mode === 'dark' ? 'dark-plus' : 'light-plus',
        nord: 'github', monochrome: 'dark-plus', line: 'natural', sakura: 'catppuccin', forest: 'everforest', mountain: 'tokyo-night', ocean: 'github', amber: 'ayu'
    };
    const raw = paletteAliases[value] || value || 'natural';
    const allowed = mode === 'dark' ? DARK_THEME_IDS : LIGHT_THEME_IDS;
    return allowed.includes(raw) ? raw : 'natural';
}
function readAppearanceSettings() {
    try {
        const parsed = safeLocalGet(APPEARANCE_KEY, {});
        const legacyPalette = parsed.palette || parsed.appTheme;
        const lightPalette = normalizeAppearancePalette(parsed.lightPalette || legacyPalette || DEFAULT_APPEARANCE.lightPalette, 'light');
        const darkPalette = normalizeAppearancePalette(parsed.darkPalette || legacyPalette || DEFAULT_APPEARANCE.darkPalette, 'dark');
        return { mode: 'system', lightPalette, darkPalette };
    } catch (_) {
        return { ...DEFAULT_APPEARANCE };
    }
}
function resolveAppearanceMode() {
    return appearanceMql.matches ? 'dark' : 'light';
}
function getActiveAppearancePalette(settings = appearanceSettings) {
    return resolveAppearanceMode() === 'dark' ? settings.darkPalette : settings.lightPalette;
}
function applyAppearanceSettings(settings = readAppearanceSettings(), persist = true) {
    const next = { ...DEFAULT_APPEARANCE, ...settings, mode: 'system' };
    next.lightPalette = normalizeAppearancePalette(next.lightPalette, 'light');
    next.darkPalette = normalizeAppearancePalette(next.darkPalette, 'dark');
    appearanceSettings = next;
    const resolvedTheme = resolveAppearanceMode();
    const activePalette = getActiveAppearancePalette(appearanceSettings);
    D.body.dataset.theme = resolvedTheme;
    D.body.dataset.appTheme = activePalette;
    D.documentElement.setAttribute('data-bs-theme', resolvedTheme);
    D.documentElement.setAttribute('data-theme', resolvedTheme);
    D.documentElement.setAttribute('data-app-theme', activePalette);
    if (persist) safeLocalSet(APPEARANCE_KEY, appearanceSettings);
    updateAppearanceControls();
}
function updateAppearanceControls() {
    const resolvedTheme = resolveAppearanceMode();
    $$('[data-theme-scope][data-theme-palette]').forEach(btn => {
        const scope = btn.dataset.themeScope;
        const expected = scope === 'dark' ? appearanceSettings.darkPalette : appearanceSettings.lightPalette;
        const isStored = btn.dataset.themePalette === expected;
        btn.classList.toggle('stored', isStored);
        btn.classList.toggle('active', isStored && scope === resolvedTheme);
    });
    const darkLabel = $('#darkThemeSummary');
    const lightLabel = $('#lightThemeSummary');
    if (darkLabel) darkLabel.textContent = APPEARANCE_PALETTE_LABELS[appearanceSettings.darkPalette] || '標準';
    if (lightLabel) lightLabel.textContent = APPEARANCE_PALETTE_LABELS[appearanceSettings.lightPalette] || '標準';
    const label = $('#appearanceCurrentLabel');
    if (label) label.textContent = resolvedTheme === 'dark' ? '端末：ダーク' : '端末：ライト';
}


function setupAppearanceFooterSafety() {
    const modal = byId('appearanceModal');
    if (!modal || modal.dataset.footerSafetyBound === 'true') return;
    modal.dataset.footerSafetyBound = 'true';

    const closeThemePickers = () => {
        modal.querySelectorAll('.theme-picker[open]').forEach(picker => {
            picker.removeAttribute('open');
        });
    };

    modal.querySelectorAll('.modal-footer .btn').forEach(button => {
        button.addEventListener('pointerdown', closeThemePickers, { passive: true });
        button.addEventListener('click', closeThemePickers);
    });
}

function setupThemePickerDropdowns() {
    const pickers = $$('#appearanceModal .theme-picker');
    if (!pickers.length || setupThemePickerDropdowns.ready) return;
    setupThemePickerDropdowns.ready = true;

    const updatePickerMenuHeight = () => {
        const modalEl = $('#appearanceModal');
        const footer = modalEl ? modalEl.querySelector('.modal-footer') : null;
        const footerTop = footer ? footer.getBoundingClientRect().top : window.innerHeight;
        pickers.forEach(picker => {
            if (!picker.open) return;
            const summary = picker.querySelector('summary');
            if (!summary) return;
            const summaryRect = summary.getBoundingClientRect();
            const available = Math.max(150, Math.floor(footerTop - summaryRect.bottom - 18));
            picker.style.setProperty('--theme-choice-max-height', `${available}px`);
        });
    };

    pickers.forEach(picker => {
        picker.addEventListener('toggle', () => {
            if (picker.open) requestAnimationFrame(updatePickerMenuHeight);
        });
    });

    document.addEventListener('click', event => {
        if (event.target.closest('#appearanceModal .theme-picker')) return;
        pickers.forEach(picker => picker.removeAttribute('open'));
    });

    window.addEventListener('resize', updatePickerMenuHeight);
    window.addEventListener('orientationchange', updatePickerMenuHeight);

    const modalEl = $('#appearanceModal');
    if (modalEl) {
        modalEl.addEventListener('shown.bs.modal', updatePickerMenuHeight);
        modalEl.addEventListener('hidden.bs.modal', () => {
            pickers.forEach(picker => {
                picker.removeAttribute('open');
                picker.style.removeProperty('--theme-choice-max-height');
            });
        });
    }
}

function setupAppearanceControls() {
    applyAppearanceSettings(readAppearanceSettings(), true);
    setupThemePickerDropdowns();
    $$('[data-theme-scope][data-theme-palette]').forEach(btn => {
        btn.addEventListener('click', () => {
            const scope = btn.dataset.themeScope === 'dark' ? 'dark' : 'light';
            const palette = btn.dataset.themePalette;
            const next = { ...appearanceSettings, mode: 'system' };
            if (scope === 'dark') next.darkPalette = palette;
            else next.lightPalette = palette;
            applyAppearanceSettings(next);
        });
    });
    const refreshBySystem = () => applyAppearanceSettings({ ...appearanceSettings, mode: 'system' }, false);
    if (appearanceMql.addEventListener) appearanceMql.addEventListener('change', refreshBySystem);
    else if (appearanceMql.addListener) appearanceMql.addListener(refreshBySystem);
}
window.openAppearanceModal = function() {
    applyAppearanceSettings({ ...appearanceSettings, mode: 'system' }, false);
    if (modals.appearance) modals.appearance.show();
};
window.resetAppearanceSettings = function() {
    applyAppearanceSettings({ ...DEFAULT_APPEARANCE });
    showMiniToast('標準テーマに戻しました');
};

function updateStatus(kind = 'neutral', message = '') {
    if (!message) return;
    setPersistentSaveStatus(kind, message);
}

D.addEventListener('DOMContentLoaded', async () => {
    modals.edit = new bootstrap.Modal($('#commonEditModal'));
    modals.batch = new bootstrap.Modal($('#batchImportModal'));
    modals.globalGuide = new bootstrap.Modal($('#globalGuideModal'));
    modals.appearance = new bootstrap.Modal($('#appearanceModal'));
    modals.guide = new bootstrap.Modal($('#guideModal'));
    modals.seisanGuide = new bootstrap.Modal($('#seisanGuideModal'));
    modals.routeDistance = new bootstrap.Modal($('#routeDistanceModal'));
    modals.history = new bootstrap.Modal($('#historyModal'));
    window.modals = modals;
    applyRuntimeAccessibilityFixes();

    D.body.onclick = async e => {
        const t = e.target;
        const nameTrigger = t.closest('.member-name-text, .driver-name-disp');
        if (nameTrigger) {
            toggleStatus(nameTrigger.closest('.member-card') || nameTrigger.closest('.driver-seat')); return;
        }
        const editTrigger = t.closest('.edit-btn');
        if (editTrigger) {
            handleEdit(editTrigger.closest('.driver-seat') ? 'driverMemo' : 'memo', editTrigger); return;
        }
        const lockTrigger = t.closest('.lock-btn');
        if (lockTrigger) {
            toggleLock(lockTrigger.closest('.member-card')); return;
        }

        const deleteTrigger = t.closest('.delete-btn, .delete-btn-overlay');
        if (deleteTrigger) {
            const card = deleteTrigger.closest('.member-card');
            const box = deleteTrigger.closest('.car-box');
            
            if (card) {
                if (card.dataset.locked === 'true') return appAlert('固定されています。先に固定を解除してください。', { title: '操作できません' });
                
                if (card.parentElement.id === 'waiting-list') {
                    if (await appConfirm('このメンバーを完全に削除しますか？', { title: 'メンバー削除', okText: '削除', danger: true })) {
                        card.remove(); 
                    }
                } else {
                    if (await appConfirm('車から降ろして未割り当てメンバーに戻しますか？', { title: '未割り当てに戻す', okText: '戻す' })) {
                        $('#waiting-list').appendChild(card);
                    }
                }
            } else if (box) {
                if (await appConfirm('この車を削除しますか？同乗者は未割り当てメンバーに戻ります。', { title: '車を削除', okText: '削除', danger: true })) {
                    $$('.member-card', box).forEach(m => $('#waiting-list').appendChild(m));
                    if (box.parentElement && box.parentElement.classList.contains('col-12')) {
                        box.parentElement.remove();
                    } else {
                        box.closest('.col-12').remove();
                    }
                }
            }
            updateUI(); window.__lastLocalUpdatedAt = Date.now();
    save();
        }
    };

    $('#saveEditBtn').onclick = () => { saveCb && saveCb(); };
    $('#editModalInput').onkeypress = e => { if(e.key==='Enter' && saveCb) saveCb(); };
    $('#roomNameInput').addEventListener('input', () => {
        refreshRoomTitle();
        clearTimeout(saveTimer);
        saveTimer = setTimeout(save, 500);
    });

    loadTrustedEditPassphrase();
    setupSortable($('#waiting-list'));
    await initFirebaseSync();
    load();
    refreshRoomTitle();
    updateEditLockButton();
    setupManualCardDrag();
    setupManualSheetDrag();
    setupCompactPersonMenu();
    ensureCompactMenuFallback();

    setupAppearanceControls();
    document.addEventListener('pointermove', e => {
        autoScrollEditingView(e.clientY);
        autoScrollSheetQuickEdit(e.clientX, e.clientY);
    }, { passive: true });
    
    if (firebaseEnabled && db && firebaseReady) {
        onValue(ref(db, ".info/connected"), (snap) => {
            if (snap.val() === true) {
                updateStatus('connected', '共有同期中');
            } else {
                updateStatus('error', '同期切断中');
            }
        });
    }

    setInterval(() => {
        if (isRemoteUpdate || !dbRef) return;
        const currentData = getData();
        let hist = window.SanpoHistory?.read(roomId) || safeLocalGet('syawari_history_' + roomId, []);
        if (hist.length > 0) {
            if (JSON.stringify(hist[0].data) === JSON.stringify(currentData)) return;
        }
        hist.unshift({ time: Date.now(), data: currentData });
        if (hist.length > 20) hist = hist.slice(0, 20);
        (window.SanpoHistory?.write(roomId, hist) || safeLocalSet('syawari_history_' + roomId, hist));
    }, 60000);
});

window.resetData = async () => {
    const input = await requestPassphrasePanel('共有データを全消去します。実行するには「リセット」と入力してください。', false);
    if (input !== 'リセット') return;
    L.removeItem(CFG.STORE + '_' + roomId);
    L.removeItem('syawari_history_' + roomId);
    L.removeItem(getTrustedDeviceKey());
    if (dbRef) {
        set(dbRef, null).then(() => { location.reload(); }).catch(err => { console.error(err); showAppNotice('リセットに失敗しました。', true); });
    } else {
        location.reload();
    }
};

function refreshRoomTitle() {
    const titleEl = byId('sheet-room-name');
    if (!titleEl) return;
    const name = ($('#roomNameInput')?.value || '').trim();
    titleEl.textContent = name || '企画名未設定';
    titleEl.classList.toggle('is-placeholder', !name);
}

function formatUpdatedAt(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function updateSheetSummary(data = getData()) {
    const summaryEl = byId('sheet-summary');
    if (!summaryEl) return;
    const driverCount = data.cars.length;
    const assignedRiderCount = data.cars.reduce((sum, car) => sum + (car.members || []).filter(Boolean).length, 0);
    const waitingCount = data.waiting.length;
    const riderCount = assignedRiderCount + waitingCount;
    const totalCount = driverCount + riderCount;
    const items = [
        ['車出し', driverCount],
        ['同乗者', riderCount],
        ['全員', totalCount],
        ['待機', waitingCount]
    ];
    const updated = formatUpdatedAt(data.lastUpdatedAt);
    if (updated) items.push(['最終更新', updated]);
    summaryEl.replaceChildren(...items.map(([label, value]) => {
        const span = document.createElement('span');
        span.className = 'sheet-summary-pill';
        span.append(document.createTextNode(label + ' '));
        const strong = document.createElement('strong');
        strong.textContent = String(value);
        span.appendChild(strong);
        return span;
    }));
}

function getTrustedDeviceKey() {
    return `syawari_edit_trust_${roomId}`;
}

function loadTrustedEditPassphrase() {
    trustedEditPassphrase = localStorage.getItem(getTrustedDeviceKey()) || '';
}

function rememberTrustedDevice(passphrase) {
    trustedEditPassphrase = passphrase || '';
    if (trustedEditPassphrase) {
        localStorage.setItem(getTrustedDeviceKey(), trustedEditPassphrase);
    } else {
        safeLocalRemove(getTrustedDeviceKey());
    }
}

function hasTrustedEditAccess() {
    return !editLockEnabled || (!!editLockPassphrase && trustedEditPassphrase === editLockPassphrase);
}

function updateEditLockButton() {
    const btn = byId('editLockBtn');
    if (!btn) return;
    const icon = btn.querySelector('i');
    const label = btn.querySelector('span');
    icon.className = `fas ${editLockEnabled ? 'fa-lock' : 'fa-unlock'}`;
    label.textContent = editLockEnabled ? 'ロック中' : 'ロック';
    btn.classList.toggle('is-locked', editLockEnabled);
    btn.title = editLockEnabled ? '車割メーカーと精算ツールのロックを解除' : '車割メーカーと精算ツールをロック';
    btn.setAttribute('aria-label', btn.title);
    updateProtectedMenuItems();
    updateQuickEditButton();
}

function updateProtectedMenuItems() {
    const locked = !!editLockEnabled;
    ['historyBtn', 'sampleDataBtn', 'resetDataBtn'].forEach(id => {
        const btn = byId(id);
        if (!btn) return;
        btn.disabled = locked;
        btn.classList.toggle('disabled', locked);
        btn.setAttribute('aria-disabled', locked ? 'true' : 'false');
        if (locked) {
            if (btn.dataset.lockTitle === undefined) btn.dataset.lockTitle = btn.title || '';
            btn.title = 'ロック中は使えません';
        } else {
            btn.title = btn.dataset.lockTitle || '';
            delete btn.dataset.lockTitle;
        }
    });
}

function canUseUnlockedMenuAction() {
    if (!editLockEnabled) return true;
    showAppNotice('ロック中は使えません。先にロックを解除してください。', true);
    return false;
}

function updateQuickEditButton() {
    const btn = byId('sheet-quick-edit-btn');
    if (!btn) return;
    const canQuickEdit = !editLockEnabled || hasTrustedEditAccess();
    const shouldShow = currentView === 'sheet' && canQuickEdit;
    btn.style.display = shouldShow ? 'inline-flex' : 'none';
    if (!shouldShow) quickEditMode = false;
    btn.classList.toggle('active', quickEditMode && shouldShow);
    document.body.classList.toggle('quick-edit-mode', quickEditMode && shouldShow);
    btn.innerHTML = quickEditMode
        ? '<i class="fas fa-check me-1" aria-hidden="true"></i>編集中'
        : '<i class="fas fa-hand-paper me-1" aria-hidden="true"></i>クイック編集';
    btn.setAttribute('aria-pressed', quickEditMode && shouldShow ? 'true' : 'false');
    btn.setAttribute('aria-label', quickEditMode ? 'クイック編集を完了' : '発表ビューをクイック編集');
}

function toggleQuickEdit() {
    if (!hasTrustedEditAccess()) return;
    quickEditMode = !quickEditMode;
    updateQuickEditButton();
    if (currentView === 'sheet') renderSheetView();
}
window.toggleQuickEdit = toggleQuickEdit;

function showAppNotice(message, isError = false) {
    let toast = byId('app-notice');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'app-notice';
        toast.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);color:#fff;padding:9px 16px;border-radius:18px;font-size:0.78rem;font-weight:700;z-index:10002;box-shadow:0 4px 12px rgba(0,0,0,0.25);opacity:0;transition:opacity 0.3s;white-space:normal;max-width:min(92vw,520px);text-align:center;pointer-events:none;';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.background = isError ? '#b91c1c' : '#1e293b';
    toast.style.opacity = '1';
    setTimeout(() => { toast.style.opacity = '0'; }, 2200);
}

function requestPassphrasePanel(message, isPassword = true) {
    return new Promise(resolve => {
        const old = byId('passphrase-panel');
        if (old) old.remove();

        const overlay = document.createElement('div');
        overlay.id = 'passphrase-panel';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.46);z-index:10001;display:flex;align-items:center;justify-content:center;padding:16px;';

        const form = document.createElement('form');
        form.style.cssText = 'width:min(100%,360px);background:var(--modal-bg,#fff);color:var(--text-main,#172033);border:1px solid var(--border-color,#dbe4df);border-radius:10px;padding:16px;box-shadow:0 16px 34px rgba(15,23,42,0.24);';

        const label = document.createElement('label');
        label.textContent = message;
        label.style.cssText = 'display:block;font-size:0.86rem;font-weight:800;line-height:1.45;margin-bottom:10px;';

        const input = document.createElement('input');
        input.type = isPassword ? 'password' : 'text';
        input.autocomplete = 'off';
        input.style.cssText = 'width:100%;border:1px solid var(--border-color,#dbe4df);border-radius:6px;background:var(--bg-card,#fff);color:var(--text-main,#172033);font-size:1rem;padding:10px 12px;';

        const actions = document.createElement('div');
        actions.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px;';

        const cancel = document.createElement('button');
        cancel.type = 'button';
        cancel.textContent = 'キャンセル';
        cancel.style.cssText = 'border:1px solid var(--border-color,#dbe4df);border-radius:6px;background:var(--bg-card,#fff);color:var(--text-main,#172033);font-size:0.84rem;font-weight:800;padding:9px 12px;';

        const submit = document.createElement('button');
        submit.type = 'submit';
        submit.textContent = 'OK';
        submit.style.cssText = 'border:0;border-radius:6px;background:var(--accent-color,#0f766e);color:#fff;font-size:0.84rem;font-weight:800;padding:9px 12px;';

        const done = value => {
            overlay.remove();
            resolve(value);
        };

        cancel.onclick = () => done(null);
        overlay.onclick = event => {
            if (event.target === overlay) done(null);
        };
        form.onsubmit = event => {
            event.preventDefault();
            done(input.value.trim());
        };

        actions.append(cancel, submit);
        form.append(label, input, actions);
        overlay.appendChild(form);
        document.body.appendChild(overlay);
        input.focus();
    });
}

async function requestPassphrase(message) {
    try {
        const value = window.prompt(message);
        if (value === null) return null;
        return value.trim();
    } catch (e) {
        return requestPassphrasePanel(message);
    }
}

async function verifyEditPassphrase(message) {
    if (hasTrustedEditAccess()) return true;
    const input = await requestPassphrase(message);
    if (input === null) return false;
    if (input !== editLockPassphrase) {
        showAppNotice('合言葉が違います。', true);
        return false;
    }
    rememberTrustedDevice(input);
    return true;
}

async function toggleEditProtection() {
    if (!editLockEnabled) {
        const first = await requestPassphrase('車割メーカーと精算ツールをロックする合言葉を設定してください');
        if (first === null) return;
        if (!first) {
            showAppNotice('合言葉を入力してください。', true);
            return;
        }
        const second = await requestPassphrase('確認のため、もう一度同じ合言葉を入力してください');
        if (second === null) return;
        if (first !== second) {
            showAppNotice('合言葉が一致しません。', true);
            return;
        }
        editLockEnabled = true;
        editLockPassphrase = first;
        rememberTrustedDevice(first);
        updateEditLockButton();
        save();
        return;
    }

    if (!(await verifyEditPassphrase('ロックを解除する合言葉を入力してください'))) return;
    editLockEnabled = false;
    editLockPassphrase = '';
    rememberTrustedDevice('');
    updateEditLockButton();
    save();
}
window.toggleEditProtection = toggleEditProtection;
window.copyUrl = copyUrl;

function save() {
    updateStatus('saving', '保存中...');

    lastUpdatedAt = Date.now();
    const d = getData();
    d.lastUpdatedBy = myClientId;
    d.lastUpdatedAt = lastUpdatedAt;

    L.setItem(CFG.STORE + '_' + roomId, J.stringify(d));
    
    if (!isRemoteUpdate && dbRef) {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => { 
            update(dbRef, {
                roomName: d.roomName,
                waiting: d.waiting,
                cars: d.cars,
                trayMinimized: d.trayMinimized,
                editLockEnabled: d.editLockEnabled,
                editLockPassphrase: d.editLockPassphrase,
                settlement: d.settlement,
                lastUpdatedBy: d.lastUpdatedBy,
                lastUpdatedAt: d.lastUpdatedAt
            }).then(() => {
                updateStatus('connected', '同期完了');
            }).catch(e => {
                console.error(e);
                updateStatus('error', '保存失敗');
            }); 
        }, 500);
    } else if (!isRemoteUpdate) {
        setTimeout(() => updateStatus('local', 'ローカル保存済み'), 180);
    }
}


function isSettlementCostField(target = document.activeElement) {
    return !!(target?.matches?.('#seisan-car-list [data-field], #seisan-car-list [data-extra-field]'));
}

function isEditingSettlementCostField() {
    return isSettlementCostField(document.activeElement);
}

function saveLocalDraftOnly() {
    try {
        lastUpdatedAt = Date.now();
        const d = getData();
        d.lastUpdatedBy = myClientId;
        d.lastUpdatedAt = lastUpdatedAt;
        L.setItem(CFG.STORE + '_' + roomId, J.stringify(d));
    } catch (err) {
        console.warn('Failed to save local settlement draft:', err);
    }
}

function commitSettlementAfterKeyboardSettles() {
    clearTimeout(settlementRenderTimer);
    clearTimeout(settlementCommitTimer);
    settlementCommitTimer = setTimeout(() => {
        syncSettlementStateFromDOM();
        if (isEditingSettlementCostField()) {
            settlementRenderDeferred = true;
            saveLocalDraftOnly();
            return;
        }
        settlementRenderDeferred = false;
        renderSettlementView();
        save();
    }, 0);
}

function load() {
    const loadLocalOnly = () => {
        const localDataStr = L.getItem(CFG.STORE + '_' + roomId);
        if (localDataStr) {
            isRemoteUpdate = true;
            restore(migrateAppData(JSON.parse(localDataStr)));
            isRemoteUpdate = false;
        } else {
            $('#roomNameInput').value = '';
            $('#waiting-list').innerHTML = '';
            $('#cars-container').innerHTML = '';
            editLockEnabled = false;
            editLockPassphrase = '';
            rememberTrustedDevice('');
            updateEditLockButton();
            refreshRoomTitle();
            updateUI();
            L.removeItem(CFG.STORE + '_' + roomId);
        }
    };

    if (!dbRef) {
        loadLocalOnly();
        updateStatus('local', 'ローカル保存');
        return;
    }

    onValue(dbRef, (snapshot) => {
        if (isProcessingQueue) return;

        const val = snapshot.val();
        if (val) {
            if (val.lastUpdatedBy === myClientId) {
                return;
            }

            isRemoteUpdate = true; 
            restore(migrateAppData(val)); 
            isRemoteUpdate = false;
            showMiniToast('他の人が更新しました', 'neutral');
            L.setItem(CFG.STORE + '_' + roomId, J.stringify(val));
        } else {
            const localDataStr = L.getItem(CFG.STORE + '_' + roomId);
            if (localDataStr) {
                isRemoteUpdate = true;
                restore(migrateAppData(JSON.parse(localDataStr)));
                isRemoteUpdate = false;
                save();
            } else {
                $('#roomNameInput').value = '';
                $('#waiting-list').innerHTML = '';
                $('#cars-container').innerHTML = '';
                editLockEnabled = false;
                editLockPassphrase = '';
                lastAutoAssignLabel = '';
                updateLastAutoAssignCondition();
                rememberTrustedDevice('');
                updateEditLockButton();
                refreshRoomTitle();
                updateUI();
                L.removeItem(CFG.STORE + '_' + roomId);
            }
        }
    });
}

function getWaitingCards() {
    return Array.from(document.querySelectorAll('#waiting-list .member-card')).filter(card =>
        card.isConnected &&
        !card.classList.contains('manual-drag-source') &&
        !card.classList.contains('manual-drag-float') &&
        !card.classList.contains('swap-preview-card') &&
        !card.classList.contains('drag-preview-card')
    );
}

function getWaitingTrayStats() {
    const waitingCards = getWaitingCards();
    let seatsTotal = 0;
    let seatsFilled = 0;
    document.querySelectorAll('.car-box').forEach(box => {
        const capacity = getInt(box.dataset.capacity);
        seatsTotal += Math.max(0, capacity);
        box.querySelectorAll('.seat-slot').forEach(slot => {
            seatsFilled += getRealSeatCards(slot).length;
        });
    });
    return {
        waitingCount: waitingCards.length,
        waitingNames: waitingCards.map(card => card.dataset.name || ''),
        seatsTotal,
        seatsFilled,
        openSeats: Math.max(0, seatsTotal - seatsFilled)
    };
}

function setWaitingTraySizeClass(tray, count) {
    tray.classList.remove('waiting-empty', 'waiting-few', 'waiting-normal', 'waiting-many');
    if (count === 0) tray.classList.add('waiting-empty');
    else if (count <= 2) tray.classList.add('waiting-few');
    else if (count <= 6) tray.classList.add('waiting-normal');
    else tray.classList.add('waiting-many');
}

function highlightNewWaitingMembers(previousNames = []) {
    const previous = new Set(previousNames.filter(Boolean));
    const cards = getWaitingCards();
    const newlyAdded = cards.filter(card => !previous.has(card.dataset.name || ''));
    const targets = newlyAdded.length ? newlyAdded : cards.slice(-1);
    targets.forEach(card => {
        card.classList.remove('waiting-card-new');
        void card.offsetWidth;
        card.classList.add('waiting-card-new');
        setTimeout(() => card.classList.remove('waiting-card-new'), 1600);
    });
    targets[0]?.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
}

function updateWaitingTrayState() {
    const tray = byId("bottom-tray");
    const countEl = byId("waiting-count");
    const list = byId('waiting-list');
    if (!tray || !countEl || !list) return;

    const stats = getWaitingTrayStats();
    const count = stats.waitingCount;
    const previousCount = Number(tray.dataset.waitingCount || '0');
    const previousNames = (() => {
        try { return JSON.parse(tray.dataset.waitingNames || '[]'); }
        catch (_) { return []; }
    })();
    const initialized = tray.dataset.waitingInitialized === 'true';

    countEl.textContent = `${count}人`;
    countEl.setAttribute('aria-label', `未割り当てメンバー ${count}人`);
    setWaitingTraySizeClass(tray, count);
    tray.dataset.waitingCount = String(count);
    tray.dataset.waitingNames = JSON.stringify(stats.waitingNames);
    tray.dataset.waitingInitialized = 'true';

    if (count > 0) tray.classList.remove('empty-open');

    const status = tray.querySelector('.tray-status small');
    if (status) {
        status.textContent = '';
    }

    if (initialized && count > previousCount) {
        highlightNewWaitingMembers(previousNames);
        if (currentView === 'list' && tray.dataset.userMinimized !== 'true') {
            tray.classList.remove('minimized');
        }
    }

    if (count === 0) {
        tray.classList.remove('is-drop-ready');
    }

    updateTrayToggleLabel();
}

function updateTrayToggleLabel() {
    const tray = byId("bottom-tray");
    const label = byId("tray-toggle-label");
    if (!tray || !label) return;
    const { waitingCount: count } = getWaitingTrayStats();
    if (count === 0) {
        const open = tray.classList.contains('empty-open');
        label.innerHTML = open
            ? '<i class="fas fa-chevron-down" aria-hidden="true"></i><span>未割り当てメンバーを閉じる</span>'
            : '<i class="fas fa-chevron-up" aria-hidden="true"></i><span>未割り当てメンバーを開く</span>'; 
        return;
    }
    const minimized = tray.classList.contains("minimized");
    label.innerHTML = minimized
        ? `<i class="fas fa-chevron-up" aria-hidden="true"></i><span>未割り当てメンバーを開く（${count}人）</span>`
        : `<i class="fas fa-chevron-down" aria-hidden="true"></i><span>未割り当てメンバーを閉じる（${count}人）</span>`;
}

function toggleTray() {
  const tray = byId("bottom-tray");
  if (!tray) return;
  if (tray.classList.contains('waiting-empty')) {
    tray.classList.toggle('empty-open');
    tray.dataset.userMinimized = tray.classList.contains('empty-open') ? 'false' : 'true';
  } else {
    tray.classList.toggle("minimized");
    tray.classList.remove('empty-open');
    tray.dataset.userMinimized = tray.classList.contains('minimized') ? 'true' : 'false';
  }
  updateTrayMenuDirection();
  updateTrayToggleLabel();
  save();
}
window.toggleTray = toggleTray;

const trayHandleEl = byId('tray-handle');
trayHandleEl?.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleTray();
    }
});

function updateTrayMenuDirection() {
    const tray = byId("bottom-tray");
    const menuWrap = tray?.querySelector('.tray-settings-dropdown');
    if (!tray || !menuWrap) return;
    menuWrap.classList.toggle('dropup', tray.classList.contains('minimized'));
    updateTrayToggleLabel();
}

function prepareWaitingTrayForDrag() {
    const tray = byId('bottom-tray');
    if (!tray || currentView !== 'list') return;

    const fromWaiting = manualCardDrag?.currentContainer?.id === 'waiting-list';
    const wasClosed = tray.classList.contains('minimized') || (tray.classList.contains('waiting-empty') && !tray.classList.contains('empty-open'));
    tray.dataset.dragStartedMinimized = wasClosed ? 'true' : 'false';

    if (fromWaiting) {
        // 未割り当て欄からカードを持ち上げたら、作業面を広くするために待機タブを閉じる。
        tray.classList.add('minimized');
        tray.classList.remove('empty-open', 'is-drop-ready', 'is-drop-near');
        tray.dataset.userMinimized = 'true';
        tray.dataset.closedByWaitingDrag = 'true';
    } else {
        // 車側から戻すときだけ、閉じたタブへのドロップ先として控えめに準備する。
        tray.classList.add('is-drop-ready');
        delete tray.dataset.closedByWaitingDrag;
    }

    updateTrayMenuDirection();
    updateTrayToggleLabel();
}

function maybeOpenWaitingTrayNearPointer(clientX, clientY) {
    const tray = byId('bottom-tray');
    const waitingList = byId('waiting-list');
    if (!tray || !waitingList || currentView !== 'list' || !manualCardDrag) return;

    const closed = tray.classList.contains('minimized') || (tray.classList.contains('waiting-empty') && !tray.classList.contains('empty-open'));
    if (!closed) {
        tray.classList.remove('is-drop-near');
        return;
    }

    // 自動で開くのは、カードが「閉じているタブ本体」に触れたときだけ。
    // 以前のように画面下に近づいただけでは開かない。
    const handle = byId('tray-handle');
    const targetRect = (handle || tray).getBoundingClientRect();
    const margin = 10;
    const touchingClosedTab =
        clientX >= targetRect.left - margin &&
        clientX <= targetRect.right + margin &&
        clientY >= targetRect.top - margin &&
        clientY <= targetRect.bottom + margin;

    tray.classList.toggle('is-drop-near', touchingClosedTab);
    if (!touchingClosedTab) return;

    tray.classList.remove('minimized');
    if (tray.classList.contains('waiting-empty')) tray.classList.add('empty-open');
    tray.dataset.openedByDrag = 'true';
    tray.classList.add('is-drop-ready');
    updateTrayMenuDirection();
    updateTrayToggleLabel();
}

function finishWaitingTrayDragState() {
    const tray = byId('bottom-tray');
    if (!tray) return;
    const droppedToWaiting = manualCardDrag?.dropTarget?.id === 'waiting-list';
    tray.classList.remove('is-drop-ready', 'is-drop-near');
    if (tray.dataset.openedByDrag === 'true' && tray.dataset.userMinimized === 'true' && !droppedToWaiting) {
        tray.classList.add('minimized');
        tray.classList.remove('empty-open');
    }
    delete tray.dataset.openedByDrag;
    delete tray.dataset.dragStartedMinimized;
    delete tray.dataset.closedByWaitingDrag;
    updateTrayMenuDirection();
    updateTrayToggleLabel();
}


function genderBadgeHtml(gender) {
    return '';
}

function gradeGenderClass(gender) {
    if (gender === 'male') return 'grade-male';
    if (gender === 'female') return 'grade-female';
    return 'grade-unknown';
}

function renderGradeBadge(grade, gender = 'unknown') {
    const n = parseInt(grade) || 0;
    if (n <= 0) return '';
    return `<span class="grade-badge ${gradeGenderClass(gender)}" data-grade="${n}">${n}年</span>`;
}

function addMember(n, m='', g='unknown', grade=0, parent=$('#waiting-list'), locked=false) {
    const name = String(n || '').trim();
    if(!name) return;
    
    const div = ce('div', 'member-card');
    div.dataset.name = name;
    div.dataset.gender = g;
    div.dataset.grade = grade;
    div.dataset.locked = locked;
    
    const safeName = escapeHtml(name);
    const safeMemo = escapeHtml(m || '');
    const gradeHtml = renderGradeBadge(grade, g);
    const genderHtml = genderBadgeHtml(g);
    div.innerHTML = `
        <div class="member-main-line">
            <div class="member-name-text">${safeName}</div>
            ${genderHtml}
            ${gradeHtml}
            <button type="button" class="member-menu-btn action-btn" title="メニュー" aria-label="メンバー操作メニュー"><i class="fas fa-ellipsis-vertical" aria-hidden="true"></i></button>
        </div>
        <div class="memo-popup" style="display:${m?'block':'none'}">${safeMemo}</div>
    `;
    parent.appendChild(div);
    updateUI();
    return div;
}
window.addMember = addMember;

function addCar(n, cap, mems=[], dm='', dg='unknown', dgrade=0) {
    const name = String(n || '').trim();
    const c = getInt(cap);
    if(!name) return;

    const col = ce('div', 'col-12 col-md-6 col-lg-4');
    const safeName = escapeHtml(name);
    const safeMemo = escapeHtml(dm || '');
    const driverGradeHtml = renderGradeBadge(dgrade, dg);
    const driverGenderHtml = genderBadgeHtml(dg);
    let slotsHtml = `
        <div class="driver-seat" data-gender="${dg}" data-name="${safeName}" data-grade="${dgrade || 0}">
            <div class="member-main-line driver-main-line">
                <div class="driver-name-disp fw-bold">${safeName}</div>
                ${driverGenderHtml}
                ${driverGradeHtml}
                <button type="button" class="driver-menu-btn action-btn" title="車出しメニュー" aria-label="車出し操作メニュー"><i class="fas fa-ellipsis-vertical" aria-hidden="true"></i></button>
            </div>
            <div class="memo-popup driver-memo-text" style="display:${dm?'block':'none'}">${safeMemo}</div>
        </div>
    `;
    for(let i=0; i<c; i++) slotsHtml += `<div class="seat-slot"></div>`;

    col.innerHTML = `
        <div class="car-box" data-capacity="${c}">
            <div class="car-header">
                <span class="car-name-label">${safeName}車</span>
                <button type="button" class="capacity-badge capacity-edit-btn" data-action="edit-capacity" title="定員を変更" aria-label="定員を変更">
                    <span class="capacity-count">0/${c}</span><i class="fas fa-pen" aria-hidden="true"></i>
                </button>
                <button type="button" class="car-delete-btn action-btn delete-btn" title="車を削除" aria-label="車を削除">
                    <i class="fas fa-trash-alt" aria-hidden="true"></i>
                </button>
            </div>
            <div class="car-layout-grid">${slotsHtml}</div>
        </div>
    `;
    $('#cars-container').appendChild(col);

    $$('.seat-slot', col).forEach((slot, i) => {
        setupSortable(slot);
        if(mems[i]) addMember(mems[i].name, mems[i].memo, mems[i].gender, mems[i].grade||0, slot, mems[i].locked);
    });
    updateUI();
}
window.addCar = addCar;

function editCapacity(el) {
    const box = el.closest('.car-box');
    handleEdit('capacity', { closest: (s) => s ? box.closest(s) : box, val: () => box.dataset.capacity });
};
window.editCapacity = editCapacity;

function clearSeatDropPreview() {
    document.querySelectorAll('.seat-slot.drop-preview, .seat-slot.shift-target, .seat-slot.swap-target, .seat-slot.swap-origin, .seat-slot.escape-target').forEach(slot => {
        slot.classList.remove('drop-preview', 'shift-target', 'swap-target', 'swap-origin', 'escape-target');
    });
    document.querySelectorAll('#waiting-list.return-preview-target').forEach(list => list.classList.remove('return-preview-target'));
    document.querySelectorAll('.swap-preview-card, .drag-preview-card').forEach(card => card.remove());
    document.querySelectorAll('.seat-card-will-move').forEach(card => card.classList.remove('seat-card-will-move'));
}

function clearDragHoverState() {
    dragHoverSlot = null;
    dragHoverOccupant = null;
    dragHoverEscapeSlot = null;
}

function findOpenSeatInSameCar(slot, excluded = []) {
    const carBox = slot?.closest?.('.car-box');
    if (!carBox) return null;
    return Array.from(carBox.querySelectorAll('.seat-slot')).find(seat => {
        if (seat === slot || excluded.includes(seat)) return false;
        return !Array.from(seat.children).some(child =>
            child.classList?.contains('member-card') &&
            !child.classList.contains('sortable-fallback') &&
            !child.classList.contains('swap-preview-card') &&
            !child.classList.contains('drag-preview-card')
        );
    }) || null;
}

function getRealSeatCard(slot, excluded = []) {
    return Array.from(slot?.children || []).find(child =>
        child.classList?.contains('member-card') &&
        !child.classList.contains('sortable-fallback') &&
        !child.classList.contains('swap-preview-card') &&
        !child.classList.contains('drag-preview-card') &&
        !excluded.includes(child)
    ) || null;
}

function getRealSeatCards(slot, excluded = []) {
    return Array.from(slot?.children || []).filter(child =>
        child.classList?.contains('member-card') &&
        !child.classList.contains('sortable-fallback') &&
        !child.classList.contains('swap-preview-card') &&
        !child.classList.contains('drag-preview-card') &&
        !excluded.includes(child)
    );
}

function showSeatReturnPreview(card, destination, excluded = []) {
    if (!card || !destination) return;
    const preview = card.cloneNode(true);
    preview.classList.add('swap-preview-card');
    preview.classList.remove('manual-drag-source', 'manual-drag-float', 'drag-preview-card', 'seat-card-will-move');
    preview.removeAttribute('id');
    preview.setAttribute('aria-hidden', 'true');
    if (destination.classList?.contains('seat-slot')) {
        if (getRealSeatCard(destination, excluded)) return;
        destination.appendChild(preview);
        return;
    }
    if (destination.id === 'waiting-list') {
        preview.classList.add('in-waiting');
        destination.classList.add('return-preview-target');
        const source = manualCardDrag?.card;
        if (source?.parentElement === destination) {
            destination.insertBefore(preview, source);
        } else {
            destination.appendChild(preview);
        }
    }
}

function showDraggedSeatPreview(card, slot, excluded = []) {
    // ドラッグ中の本人カードをドロップ先に複製表示しない。
    // 交換・戻り先のヒントだけを残し、画面の重なりを減らす。
    return;
}

function enforceOneCardPerSeat() {
    $$('.seat-slot').forEach(slot => {
        const cards = getRealSeatCards(slot);
        cards.slice(1).forEach(card => $('#waiting-list')?.appendChild(card));
    });
}

function getManualCardDropTarget(clientX, clientY) {
    const el = document.elementFromPoint(clientX, clientY);
    const waitingList = byId('waiting-list');
    const tray = byId('bottom-tray');
    const seat = el?.closest?.('.seat-slot');
    if (seat) return seat;

    if (!waitingList || !tray || !tray.isConnected) return null;

    const trayIsOpen = !tray.classList.contains('minimized') && !(tray.classList.contains('waiting-empty') && !tray.classList.contains('empty-open'));

    // 開いているときは、待機欄の中に入った場合だけ戻し先にする。
    if (trayIsOpen && el?.closest?.('#waiting-list, #waiting-list-container')) {
        return waitingList;
    }

    // 閉じているときは、閉じたタブ本体に触れたときだけ戻し先扱いにする。
    const handle = byId('tray-handle');
    const targetRect = (handle || tray).getBoundingClientRect();
    const margin = 12;
    const touchingClosedTab =
        clientX >= targetRect.left - margin &&
        clientX <= targetRect.right + margin &&
        clientY >= targetRect.top - margin &&
        clientY <= targetRect.bottom + margin;

    if (!trayIsOpen && touchingClosedTab) return waitingList;
    return null;
}

function moveManualDragCardTo(target) {
    if (!manualCardDrag) return;
    if ((target || null) === (manualCardDrag.dropTarget || null)) return;
    clearSeatDropPreview();
    clearDragHoverState();
    manualCardDrag.dropTarget = null;
    if (!target || !target.isConnected) return;
    const card = manualCardDrag.card;
    manualCardDrag.dropTarget = target;
    if (target.id === 'waiting-list') {
        target.classList.add('return-preview-target');
        return;
    }

    if (!target.classList.contains('seat-slot')) return;
    const occupant = getRealSeatCard(target, [card]);
    if (occupant) {
        target.classList.add('swap-target');
        dragHoverSlot = target;
        dragHoverOccupant = occupant;
        const returnDestination =
            manualCardDrag.currentContainer?.classList?.contains('seat-slot') || manualCardDrag.currentContainer?.id === 'waiting-list'
                ? manualCardDrag.currentContainer
                : $('#waiting-list');
        dragHoverEscapeSlot = returnDestination;
        if (returnDestination && returnDestination !== target) {
            if (returnDestination.classList?.contains('seat-slot')) {
                returnDestination.classList.add('swap-origin');
            }
            occupant.classList.add('seat-card-will-move');
            showDraggedSeatPreview(card, target, [occupant]);
            showSeatReturnPreview(occupant, returnDestination, [card]);
        }
        return;
    }

    target.classList.add('drop-preview');
    showDraggedSeatPreview(card, target, [card]);
}

function commitManualCardDrop() {
    if (!manualCardDrag) return;
    const card = manualCardDrag.card;
    const target = manualCardDrag.dropTarget;
    const current = manualCardDrag.currentContainer;
    if (!target || !target.isConnected || target === current) return;

    if (target.id === 'waiting-list') {
        target.appendChild(card);
        manualCardDrag.currentContainer = target;
        return;
    }

    if (!target.classList.contains('seat-slot')) return;
    const occupant = getRealSeatCard(target, [card]);

    if (occupant) {
        if (current?.id === 'waiting-list' || current?.classList?.contains('seat-slot')) {
            current.appendChild(occupant);
        } else {
            $('#waiting-list')?.appendChild(occupant);
        }
    }
    target.appendChild(card);
    manualCardDrag.currentContainer = target;
}

function getFinitePointerCoord(point, key, fallback) {
    const value = Number(point?.[key]);
    return Number.isFinite(value) ? value : fallback;
}

function clampDragOffset(value, size, edge = 8) {
    const min = Math.min(edge, Math.max(0, size / 2));
    const max = Math.max(min, size - min);
    return Math.max(min, Math.min(max, value));
}

function updateManualDragFloat(clientX, clientY) {
    if (!manualCardDrag?.floating) return;
    const left = clientX - manualCardDrag.offsetX;
    const top = clientY - manualCardDrag.offsetY;
    if (!Number.isFinite(left) || !Number.isFinite(top)) return;
    manualCardDrag.floating.style.left = `${left}px`;
    manualCardDrag.floating.style.top = `${top}px`;
    manualCardDrag.floating.style.transform = 'scale(1.03)';
}

function finishManualCardDrag(commit = true) {
    if (!manualCardDrag) return;
    const { card, floating } = manualCardDrag;
    if (commit) commitManualCardDrop();
    floating?.remove();
    card.classList.remove('manual-drag-source');
    D.body.classList.remove('manual-card-dragging');
    finishWaitingTrayDragState();
    manualCardDrag = null;
    isDraggingCards = false;
    clearSeatDropPreview();
    clearDragHoverState();
    enforceOneCardPerSeat();
    updateUI();
    save();
}

function startManualCardDrag(card, point) {
    closePersonMenus();
    if (manualCardDrag || !card?.isConnected) return;
    const currentContainer = card.parentElement;
    if (!(currentContainer?.classList?.contains('seat-slot') || currentContainer?.id === 'waiting-list')) return;

    const rect = card.getBoundingClientRect();
    const clientX = getFinitePointerCoord(point, 'clientX', rect.left + rect.width / 2);
    const clientY = getFinitePointerCoord(point, 'clientY', rect.top + rect.height / 2);
    const floating = card.cloneNode(true);
    floating.classList.add('manual-drag-float');
    floating.style.width = `${rect.width}px`;
    floating.style.height = `${rect.height}px`;
    D.body.appendChild(floating);

    manualCardDrag = {
        card,
        floating,
        currentContainer,
        pointerId: point?.pointerId ?? null,
        pointerType: point?.pointerType || (point?.touchIdentifier != null ? 'touch' : 'mouse'),
        touchIdentifier: point?.touchIdentifier ?? null,
        offsetX: clampDragOffset(clientX - rect.left, rect.width),
        offsetY: clampDragOffset(clientY - rect.top, rect.height)
    };

    try { if (manualCardDrag.pointerId != null) card.setPointerCapture?.(manualCardDrag.pointerId); } catch (_) {}
    card.classList.add('manual-drag-source');
    D.body.classList.add('manual-card-dragging');
    prepareWaitingTrayForDrag();
    isDraggingCards = true;
    updateManualDragFloat(clientX, clientY);
}

function setupManualCardDrag() {
    let pending = null;
    const touchDelay = 260;
    const mouseDelay = 55;
    const touchMoveCancel = 22;

    const canStartFromTarget = target => {
        if (currentView !== 'list') return null;
        const card = target.closest?.('.member-card');
        if (!card || card.classList.contains('manual-drag-float') || card.classList.contains('swap-preview-card') || card.classList.contains('drag-preview-card')) return null;
        if (card.dataset.locked === 'true') return null;
        if (window.SanpoDrag?.isInteractiveTarget(target) || target.closest?.('.action-btn, .delete-btn-overlay, button, input, textarea, select, .memo-popup, .person-pop-menu')) return null;
        const parent = card.parentElement;
        if (!(parent?.classList?.contains('seat-slot') || parent?.id === 'waiting-list')) return null;
        return card;
    };

    const clearPending = () => {
        clearTimeout(pending?.timer);
        pending = null;
    };

    const findTouch = (touchList, identifier) => Array.from(touchList || []).find(t => t.identifier === identifier) || null;

    // マウス/ペンは従来通り。タッチは touch イベント側に任せることで、通常スクロールと長押しドラッグを両立する。
    D.addEventListener('pointerdown', e => {
        if (e.pointerType === 'touch') return;
        if (e.button !== undefined && e.button !== 0) return;
        const card = canStartFromTarget(e.target);
        if (!card) return;

        e.preventDefault();
        e.stopPropagation();
        card.setPointerCapture?.(e.pointerId);
        clearPending();
        const nextPending = {
            card,
            pointerId: e.pointerId,
            touchIdentifier: null,
            startX: e.clientX,
            startY: e.clientY,
            clientX: e.clientX,
            clientY: e.clientY,
            pointerType: e.pointerType,
            timer: null
        };
        nextPending.timer = setTimeout(() => startManualCardDrag(card, nextPending), mouseDelay);
        pending = nextPending;
    }, { passive: false });

    D.addEventListener('pointermove', e => {
        if (e.pointerType === 'touch') return;
        if (pending && pending.pointerId === e.pointerId && !manualCardDrag) {
            pending.clientX = e.clientX;
            pending.clientY = e.clientY;
            const moved = window.SanpoDrag?.distance?.(pending.startX, pending.startY, e.clientX, e.clientY) ?? Math.hypot(e.clientX - pending.startX, e.clientY - pending.startY);
            if (moved > 8) startManualCardDrag(pending.card, pending);
        }
        if (!manualCardDrag || manualCardDrag.pointerId !== e.pointerId) return;
        e.preventDefault();
        updateManualDragFloat(e.clientX, e.clientY);
        maybeOpenWaitingTrayNearPointer(e.clientX, e.clientY);
        moveManualDragCardTo(getManualCardDropTarget(e.clientX, e.clientY));
    }, { passive: false });

    const cancelPointerPending = e => {
        if (pending && pending.pointerId === e.pointerId) clearPending();
    };

    D.addEventListener('pointerup', e => {
        if (e.pointerType === 'touch') return;
        cancelPointerPending(e);
        if (manualCardDrag && manualCardDrag.pointerId === e.pointerId) finishManualCardDrag(true);
    }, { passive: true });
    D.addEventListener('pointercancel', e => {
        if (e.pointerType === 'touch') return;
        cancelPointerPending(e);
        if (manualCardDrag && manualCardDrag.pointerId === e.pointerId) finishManualCardDrag(false);
    }, { passive: true });

    D.addEventListener('touchstart', e => {
        if (e.touches.length !== 1) return;
        const touch = e.changedTouches?.[0];
        if (!touch) return;
        const card = canStartFromTarget(e.target);
        if (!card) return;

        clearPending();
        const nextPending = {
            card,
            pointerId: null,
            touchIdentifier: touch.identifier,
            startX: touch.clientX,
            startY: touch.clientY,
            clientX: touch.clientX,
            clientY: touch.clientY,
            pointerType: 'touch',
            timer: null
        };
        nextPending.timer = setTimeout(() => startManualCardDrag(card, nextPending), touchDelay);
        pending = nextPending;
    }, { passive: false });

    D.addEventListener('touchmove', e => {
        if (pending && pending.pointerType === 'touch' && !manualCardDrag) {
            const touch = findTouch(e.touches, pending.touchIdentifier);
            if (!touch) return;
            pending.clientX = touch.clientX;
            pending.clientY = touch.clientY;
            const moved = window.SanpoDrag?.distance?.(pending.startX, pending.startY, touch.clientX, touch.clientY) ?? Math.hypot(touch.clientX - pending.startX, touch.clientY - pending.startY);
            if (moved > touchMoveCancel) {
                clearPending();
                return;
            }
        }

        if (!manualCardDrag || manualCardDrag.pointerType !== 'touch') return;
        const touch = findTouch(e.touches, manualCardDrag.touchIdentifier);
        if (!touch) return;
        e.preventDefault();
        e.stopPropagation();
        updateManualDragFloat(touch.clientX, touch.clientY);
        maybeOpenWaitingTrayNearPointer(touch.clientX, touch.clientY);
        moveManualDragCardTo(getManualCardDropTarget(touch.clientX, touch.clientY));
    }, { passive: false });

    D.addEventListener('touchend', e => {
        if (pending && pending.pointerType === 'touch' && findTouch(e.changedTouches, pending.touchIdentifier)) clearPending();
        if (manualCardDrag?.pointerType === 'touch' && findTouch(e.changedTouches, manualCardDrag.touchIdentifier)) finishManualCardDrag(true);
    }, { passive: true });

    D.addEventListener('touchcancel', e => {
        if (pending && pending.pointerType === 'touch' && findTouch(e.changedTouches, pending.touchIdentifier)) clearPending();
        if (manualCardDrag?.pointerType === 'touch' && findTouch(e.changedTouches, manualCardDrag.touchIdentifier)) finishManualCardDrag(false);
    }, { passive: true });
}

function updateSeatDropPreview(evt) {
    clearSeatDropPreview();
    clearDragHoverState();
    const relatedSlot = evt?.related?.closest?.('.seat-slot');
    const target = relatedSlot || evt?.to;
    if (!target || !target.classList?.contains('seat-slot')) return;
    const dragged = evt.dragged;
    const occupant = getRealSeatCard(target, [dragged]);

    if (occupant) {
        const escapeSlot = findOpenSeatInSameCar(target, [dragOriginSlot]);
        dragHoverSlot = target;
        dragHoverOccupant = occupant;
        dragHoverEscapeSlot = escapeSlot || (dragOriginSlot?.classList?.contains('seat-slot') ? dragOriginSlot : null);
        if (escapeSlot) {
            target.classList.add('shift-target');
            escapeSlot.classList.add('escape-target');
            occupant.classList.add('seat-card-will-move');
            showDraggedSeatPreview(dragged, target, [occupant]);
            showSeatReturnPreview(occupant, escapeSlot, [dragged]);
        } else if (dragOriginSlot && dragOriginSlot !== target && dragOriginSlot.classList.contains('seat-slot')) {
            target.classList.add('swap-target');
            dragOriginSlot.classList.add('swap-origin');
            occupant.classList.add('seat-card-will-move');
            showDraggedSeatPreview(dragged, target, [occupant]);
            showSeatReturnPreview(occupant, dragOriginSlot, [dragged]);
        } else {
            target.classList.add('swap-target');
        }
    } else {
        target.classList.add('drop-preview');
    }
}

function applyHoverSeatExchange(dragged) {
    if (!dragged || !dragHoverSlot || !dragHoverOccupant || !dragHoverOccupant.isConnected) return false;
    const target = dragHoverSlot;
    const occupant = dragHoverOccupant;
    const destination = dragHoverEscapeSlot || (dragOriginSlot?.classList?.contains('seat-slot') ? dragOriginSlot : null) || $('#waiting-list');
    if (!target || !target.isConnected || !destination || destination === target) return false;

    clearSeatDropPreview();
    target.appendChild(dragged);
    destination.appendChild(occupant);
    clearDragHoverState();
    return true;
}

function setupSortable(el) {
    // 編集画面のドラッグは setupManualCardDrag() に一本化しています。
    // 旧 Sortable 実装はタッチ操作と競合するため、ここでは初期化しません。
    return null;
}

function autoScrollEditingView(clientY) {
    if (!isDraggingCards || currentView !== 'list') return;
    const topArea = byId('top-area');
    const waitingContainer = byId('waiting-list-container');
    const areas = [topArea, waitingContainer];

    areas.forEach(area => {
        if (!area || area.offsetParent === null) return;
        const rect = area.getBoundingClientRect();
        const edge = Math.min(112, rect.height / 2.8);
        if (clientY < rect.top + edge) {
            const intensity = Math.min(1, Math.max(0, (rect.top + edge - clientY) / edge));
            area.scrollTop -= Math.ceil(3 + Math.pow(intensity, 2) * 12);
        } else if (clientY > rect.bottom - edge) {
            const intensity = Math.min(1, Math.max(0, (clientY - (rect.bottom - edge)) / edge));
            area.scrollTop += Math.ceil(3 + Math.pow(intensity, 2) * 12);
        }
    });
}

function autoScrollSheetQuickEdit(clientX, clientY) {
    if (!isDraggingCards || currentView !== 'sheet' || !quickEditMode) return;
    const area = byId('sheet-view-area');
    if (!area) return;
    const rect = area.getBoundingClientRect();
    const edgeX = Math.min(56, rect.width / 6);
    const edgeY = Math.min(70, rect.height / 6);
    let moved = false;

    if (clientX < rect.left + edgeX) {
        const intensity = (rect.left + edgeX - clientX) / edgeX;
        sheetX += Math.ceil(3 + intensity * 9);
        moved = true;
    } else if (clientX > rect.right - edgeX) {
        const intensity = (clientX - (rect.right - edgeX)) / edgeX;
        sheetX -= Math.ceil(3 + intensity * 9);
        moved = true;
    }

    if (clientY < rect.top + edgeY) {
        const intensity = (rect.top + edgeY - clientY) / edgeY;
        sheetY += Math.ceil(3 + intensity * 9);
        moved = true;
    } else if (clientY > rect.bottom - edgeY) {
        const intensity = (clientY - (rect.bottom - edgeY)) / edgeY;
        sheetY -= Math.ceil(3 + intensity * 9);
        moved = true;
    }

    if (moved) applySheetTransform();
}

function updateUI() {
    refreshRoomTitle();
    $$('.member-card').forEach(card => {
        const inWaiting = card.parentElement?.id === 'waiting-list';
        card.classList.toggle('in-waiting', inWaiting);
        const icon = $('.delete-btn-overlay i', card);
        const btn = $('.delete-btn-overlay', card);
        if (!icon || !btn) return;
        icon.className = `fas ${inWaiting ? 'fa-trash-alt' : 'fa-reply'}`;
        btn.title = inWaiting ? '削除' : '待機に戻す';
        const label = btn.querySelector('span');
        if (label) label.textContent = inWaiting ? '削除' : '戻す';
    });
    $$('.car-box').forEach(b => {
        const c = getInt(b.dataset.capacity);
        const n = Array.from($$('.seat-slot', b)).reduce((sum, slot) => sum + getRealSeatCards(slot).length, 0);
        const badge = $('.capacity-badge', b);
        badge.innerHTML = `<span class="capacity-count">${n}/${c}</span><i class="fas fa-pen" aria-hidden="true"></i>`;
        badge.className = `capacity-badge capacity-edit-btn ${n>c?'is-over':(n===c?'is-full':'')}`;
        b.classList.toggle('over-capacity', n>c);
    });
    updateWaitingTrayState();
    renderListEmptyHint();
    updateAutoAssignSummary();
    updateLastAutoAssignCondition();
    updateTrayMenuDirection();
    if (typeof currentView !== 'undefined' && currentView === 'sheet') {
        renderSheetView();
    }
    if (typeof currentView !== 'undefined' && currentView === 'seisan') {
        renderSettlementView();
    }
}

function renderListEmptyHint() {
    const container = byId('cars-container');
    if (!container) return;
    const hasCar = !!container.querySelector('.car-box');
    const existing = byId('list-empty-hint');
    if (hasCar) {
        existing?.remove();
        return;
    }
    if (!existing) {
        container.insertAdjacentHTML('afterbegin', `<div class="col-12" id="list-empty-hint"><div class="empty-card"><i class="fas fa-paste"></i><strong>まずは参加者登録から</strong><span>企画の参加者と車出しを登録すると、ここに車割の編集画面が表示されます。</span><button class="seisan-btn primary" type="button" data-action="open-batch">参加者登録を開く</button></div></div>`);
    }
}

function getAutoAssignConditionItems(opts = null) {
    const source = opts || {
        f: byId('optFemale')?.checked,
        m: byId('optMale')?.checked,
        g: byId('optGrade')?.checked
    };
    const items = [];
    if (source.f) items.push('女子');
    if (source.m) items.push('男子');
    if (source.g) items.push('学年');
    return items;
}

function updateAutoAssignSummary() {
    const el = byId('autoAssignSummary');
    if (!el) return;
    const items = getAutoAssignConditionItems();
    el.textContent = items.length ? `現在：${items.join('・')}をまとめる` : '現在：ランダム';
}
window.updateAutoAssignSummary = updateAutoAssignSummary;

function buildAutoAssignAppliedLabel(opts, mode) {
    const items = getAutoAssignConditionItems(opts);
    const condition = items.length ? `${items.join('・')}をまとめる` : 'ランダム';
    const scope = mode === 'fill' ? '空席のみ' : '全体を組み直し';
    return `自動割当：${condition} / ${scope}`;
}

function updateLastAutoAssignCondition() {
    const el = byId('lastAutoAssignCondition');
    if (!el) return;
    const text = lastAutoAssignLabel || '自動割当：未実行';
    el.innerHTML = `<i class="fas fa-random"></i><span>${escapeHtml(text)}</span>`;
    el.classList.toggle('is-empty', !lastAutoAssignLabel);
}

function getData() {
    return {
        schemaVersion: APP_SCHEMA_VERSION,
        roomName: $('#roomNameInput').value,
        trayMinimized: byId("bottom-tray")
                           .classList.contains("minimized"),
        editLockEnabled,
        editLockPassphrase,
        lastAutoAssignLabel,

        waiting: Array.from($$('#waiting-list .member-card')).map(getMemData),
        cars: Array.from($$('.car-box')).map(c => ({
            name: $('.driver-name-disp', c).innerText,
            capacity: c.dataset.capacity,
            driverMemo: $('.driver-memo-text', c).innerText,
            driverGender: $('.driver-seat', c).dataset.gender,
            driverGrade: parseInt($('.driver-seat', c).dataset.grade)||0,
            members: Array.from($$('.seat-slot', c)).flatMap(s => getRealSeatCards(s).map(getMemData))
        })),
        settlement: getSettlementSnapshot(),
        lastUpdatedAt
    };
}
function getMemData(el) {
    return {
        name: el.dataset.name, memo: $('.memo-popup', el).innerText,
        gender: el.dataset.gender, grade: parseInt(el.dataset.grade)||0, locked: el.dataset.locked === 'true'
    };
}

function restore(d) {
    lastUpdatedAt = Number(d.lastUpdatedAt || 0) || lastUpdatedAt;
    settlementState = normalizeSettlementState(d.settlement || settlementState || {});
    $('#roomNameInput').value = d.roomName || '';
    editLockEnabled = !!d.editLockEnabled;
    editLockPassphrase = d.editLockPassphrase || '';
    lastAutoAssignLabel = d.lastAutoAssignLabel || '';
    updateLastAutoAssignCondition();
    loadTrustedEditPassphrase();
    if (editLockPassphrase && trustedEditPassphrase && trustedEditPassphrase !== editLockPassphrase) {
        rememberTrustedDevice('');
    }
    updateEditLockButton();
    refreshRoomTitle();
    const tray = byId("bottom-tray");
    if (d.trayMinimized) {
      tray.classList.add("minimized");
    } else {
      tray.classList.remove("minimized");
    }
    tray.dataset.userMinimized = d.trayMinimized ? 'true' : 'false';

    $('#waiting-list').innerHTML = '';
    $('#cars-container').innerHTML = '';
    (d.waiting||[]).forEach(m => addMember(m.name, m.memo, m.gender, m.grade||0, $('#waiting-list'), m.locked));
    (d.cars||[]).forEach(c => addCar(c.name, c.capacity, c.members, c.driverMemo, c.driverGender, c.driverGrade || 0));
    updateUI();
    if (currentView === 'seisan') renderSettlementView();
}

async function clearAll() {
    if(!await appConfirm('配置済みのメンバーを未割り当てメンバーに戻します。固定済みの人は残します。実行しますか？', { title: '全員を未割り当てへ', okText: '実行' })) return;
    $$('.seat-slot').forEach(slot => getRealSeatCards(slot).filter(m => m.dataset.locked !== 'true').forEach(m => $('#waiting-list').appendChild(m)));
    updateUI(); save();
}
window.clearAll = clearAll;

function toggleStatus(el) {
    const g = el.dataset.gender;
    let nG = 'male';
    if (g==='male') { nG='female'; }
    else if (g==='female') { nG='unknown'; }
    else { nG='male'; }
    el.dataset.gender = nG;
    updatePersonGenderBadge(el);
    save();
}

function toggleLock(el) {
    if (!el) return;
    const locked = el.dataset.locked === 'true';
    const nextLocked = !locked;
    el.dataset.locked = nextLocked;
    const btn = $('.lock-btn', el);
    const icon = btn?.querySelector('i');
    const label = btn?.querySelector('span');
    if (btn) btn.classList.toggle('text-warning', nextLocked);
    if (icon) icon.className = `fas ${nextLocked ? 'fa-lock' : 'fa-unlock'}`;
    if (label) label.textContent = nextLocked ? '固定中' : '固定';
    save();
}


function normalizeNameForGenderHeuristic(name) {
    return String(name || '')
        .replace(/[ 　\t\r\n]+/g, '')
        .replace(/[様さん君くんちゃん先輩後輩氏]/g, '')
        .trim();
}

function getGivenNameCandidate(name) {
    const raw = String(name || '').trim();
    const spaced = raw.split(/[ 　\t\r\n]+/).filter(Boolean);
    if (spaced.length >= 2) return spaced[spaced.length - 1];

    const compact = normalizeNameForGenderHeuristic(raw);
    if (!compact) return '';

    // Japanese full names are often 3-5 characters. Prefer the likely given-name tail.
    if (compact.length >= 5) return compact.slice(-2);
    if (compact.length >= 4) return compact.slice(-2);
    if (compact.length >= 3) return compact.slice(-2);
    return compact;
}

function scoreLocalGenderName(name) {
    const compact = normalizeNameForGenderHeuristic(name);
    const given = getGivenNameCandidate(name);
    const last = given.slice(-1);
    const last2 = given.slice(-2);

    let femaleScore = 0;
    let maleScore = 0;

    // Strong common endings.
    if (/[子美奈菜那花華香佳加果歌音乃野穂歩萌芽愛彩紗沙咲桜桃梨里莉理璃結優友由祐希姫]/.test(last)) femaleScore += 3;
    if (/[郎朗太大斗翔人仁也哉矢弥介佑祐助輔平兵真誠司志史士樹生雄男夫]/.test(last)) maleScore += 3;

    // Common two-character given-name endings.
    if (/(陽菜|結菜|優奈|美咲|美月|美優|美穂|美緒|彩花|彩乃|花音|香織|真由|真央|莉子|梨子|愛子|桃子|杏奈|琴音|七海|芽衣|紗季|沙紀|友香|由香|遥香|里奈|理奈|菜月|千尋)$/.test(given)) femaleScore += 5;
    if (/(太郎|一郎|二郎|三郎|大輔|祐介|裕介|健太|翔太|陽太|颯太|悠斗|拓海|大地|和也|拓也|直人|真人|健人|雄大|翔平|公平|大樹|直樹|一輝|和樹|智也|悠真|拓真|龍也|達也|勇人)$/.test(given)) maleScore += 5;

    // Common single-character names.
    if (/^(葵|凛|澪|楓|杏|舞|唯|茜|遥|愛|結)$/.test(given)) femaleScore += 3;
    if (/^(蓮|樹|翔|翼|陸|駿|匠|隼|仁|誠|司|学|健)$/.test(given)) maleScore += 3;

    // Ambiguous endings are weak only.
    if (/[希葵陽遥優翼光空海晴]/.test(last)) {
        femaleScore += 1;
        maleScore += 1;
    }

    // Explicit notes sometimes pasted with names.
    if (/[（(]女|女性|女子|女$/.test(compact)) femaleScore += 8;
    if (/[（(]男|男性|男子|男$/.test(compact)) maleScore += 8;

    const diff = femaleScore - maleScore;
    if (diff >= 3) return 'female';
    if (diff <= -3) return 'male';
    return 'unknown';
}

function applyDetectedGenderToName(name, gender) {
    if (!gender || gender === 'unknown') return;
    $$('.member-card, .driver-seat').forEach(person => {
        if (person.dataset.name !== name) return;
        if (person.dataset.gender && person.dataset.gender !== 'unknown') return;
        person.dataset.gender = gender;
        updatePersonGenderBadge(person);
        const grade = parseInt(person.dataset.grade) || 0;
        const oldBadge = person.querySelector('.grade-badge');
        if (oldBadge && grade > 0) {
            oldBadge.className = `grade-badge ${gradeGenderClass(gender)}`;
        }
    });
}

function detectGender(name) {
    if (!AUTO_GENDER_HEURISTIC) return;
    const cleanName = String(name || '').trim();
    if (!cleanName) return;
    genderQueue.push(cleanName);
    processGenderQueue();
}
async function processGenderQueue() {
    if (isProcessingQueue) return;
    isProcessingQueue = true;
    try {
        while (genderQueue.length) {
            const name = genderQueue.shift();
            // プライバシー優先：外部APIへ送らず、端末内の簡易推定だけを行う。
            const g = scoreLocalGenderName(name);
            applyDetectedGenderToName(name, g);
            await new Promise(r => setTimeout(r, 30));
        }
        save();
    } finally {
        isProcessingQueue = false;
    }
}

function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function buildCarStates() {
    const states = shuffleArray(Array.from($$('.car-box')).map(box => {
        const slots = Array.from($$('.seat-slot', box));
        const currentMembers = slots.flatMap(slot => getRealSeatCards(slot).map(getMemData));
        const counts = {
            total: currentMembers.length,
            female: currentMembers.filter(m => m.gender === 'female').length,
            male: currentMembers.filter(m => m.gender === 'male').length,
            grades: {}
        };
        currentMembers.forEach(m => {
            const grade = parseInt(m.grade) || 0;
            if (grade > 0) counts.grades[grade] = (counts.grades[grade] || 0) + 1;
        });
        return {
            box,
            slots,
            freeSlots: slots.filter(slot => getRealSeatCards(slot).length === 0),
            counts
        };
    }));
    states.forEach((state, index) => { state.index = index; });
    return states;
}

function placeMemberIntoState(state, member) {
    const slot = state.freeSlots.shift();
    if (!slot) return false;
    addMember(member.name, member.memo, member.gender, member.grade || 0, slot, member.locked);
    state.counts.total += 1;
    if (member.gender === 'female') state.counts.female += 1;
    if (member.gender === 'male') state.counts.male += 1;
    const grade = parseInt(member.grade) || 0;
    if (grade > 0) state.counts.grades[grade] = (state.counts.grades[grade] || 0) + 1;
    return true;
}

function assignPureRandom(members, carStates) {
    const remaining = shuffleArray([...members]);
    const usableCars = carStates.filter(state => state.freeSlots.length > 0);
    const emptyCars = usableCars.filter(state => state.counts.total === 0);

    if (emptyCars.length) {
        emptyCars.slice(0, remaining.length).forEach(state => {
            if (!remaining.length) return;
            placeMemberIntoState(state, remaining.shift());
        });
    }

    const randomSlots = shuffleArray(usableCars.flatMap(state =>
        state.freeSlots.map(slot => ({ state, slot }))
    ));

    randomSlots.forEach(({ state }) => {
        if (!remaining.length) return;
        placeMemberIntoState(state, remaining.shift());
    });

    return remaining;
}

function assignBalanced(members, carStates, opts) {
    const remaining = [];
    shuffleArray([...members]).forEach(member => {
        const candidates = carStates.filter(state => state.freeSlots.length > 0);
        if (!candidates.length) {
            remaining.push(member);
            return;
        }

        candidates.sort((a, b) => {
            const aAffinity =
                (opts.f && member.gender === 'female' ? a.counts.female * 2 : 0) +
                (opts.m && member.gender === 'male' ? a.counts.male * 2 : 0) +
                (opts.g && member.grade ? (a.counts.grades[member.grade] || 0) * 3 : 0);
            const bAffinity =
                (opts.f && member.gender === 'female' ? b.counts.female * 2 : 0) +
                (opts.m && member.gender === 'male' ? b.counts.male * 2 : 0) +
                (opts.g && member.grade ? (b.counts.grades[member.grade] || 0) * 3 : 0);
            const aLoad = a.counts.total / Math.max(a.slots.length, 1);
            const bLoad = b.counts.total / Math.max(b.slots.length, 1);
            if (aAffinity !== bAffinity) return bAffinity - aAffinity;
            if (aLoad !== bLoad) return aLoad - bLoad;
            if (a.counts.total !== b.counts.total) return a.counts.total - b.counts.total;
            return a.index - b.index;
        });

        if (!placeMemberIntoState(candidates[0], member)) {
            remaining.push(member);
        }
    });
    return remaining;
}

async function autoAssign(mode) {
    const opts = { f:$('#optFemale').checked, m:$('#optMale').checked, g:$('#optGrade').checked };
    let mems = [];
    
    if(mode === 'shuffle') {
        if(!await appConfirm('配置済みのメンバーも含めて再シャッフルしますか？固定済みの人は残します。', { title: '自動割り当て', okText: '組み直す' })) return;
        $$('.seat-slot').forEach(slot => getRealSeatCards(slot).filter(m => m.dataset.locked !== 'true').forEach(m => { mems.push(getMemData(m)); m.remove(); }));
        $$('#waiting-list .member-card:not([data-locked="true"])').forEach(m => { mems.push(getMemData(m)); m.remove(); });
    } else {
        $$('#waiting-list .member-card').forEach(m => { mems.push(getMemData(m)); m.remove(); });
    }
    
    if(!mems.length) return;

    const carStates = buildCarStates();
    const leftOvers = (opts.f || opts.m || opts.g)
        ? assignBalanced(mems, carStates, opts)
        : assignPureRandom(mems, carStates);

    leftOvers.forEach(m => addMember(m.name, m.memo, m.gender, m.grade || 0, $('#waiting-list'), m.locked));
    lastAutoAssignLabel = buildAutoAssignAppliedLabel(opts, mode);
    updateUI(); save();
}
window.autoAssign = autoAssign;


function closePersonMenus() {
    document.querySelectorAll('.person-pop-menu').forEach(menu => menu.remove());
}

function positionPersonMenu(menu, anchor = null) {
    const margin = 8;
    let left = Math.max(margin, Math.round((window.innerWidth - menu.offsetWidth) / 2));
    let top = Math.max(margin, Math.round((window.innerHeight - menu.offsetHeight) / 2));
    if (anchor) {
        const rect = anchor.getBoundingClientRect();
        left = Math.min(window.innerWidth - menu.offsetWidth - margin, Math.max(margin, rect.right - menu.offsetWidth));
        top = Math.min(window.innerHeight - menu.offsetHeight - margin, Math.max(margin, rect.bottom + 6));
    }
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
}

function openChoicePopup(title, choices, onPick) {
    closePersonMenus();
    const menu = ce('div', 'person-pop-menu choice-menu');
    menu.innerHTML = `<div class="person-pop-title">${escapeHtml(title)}</div>` + choices.map(choice => `
        <button type="button" class="person-pop-item" data-value="${escapeHtml(choice.value)}">
            <i class="${choice.icon || 'fas fa-circle'}"></i><span>${escapeHtml(choice.label)}</span>
        </button>
    `).join('');
    menu.addEventListener('click', event => {
        const item = event.target.closest('.person-pop-item');
        if (!item) return;
        event.preventDefault();
        event.stopPropagation();
        onPick(item.dataset.value);
        closePersonMenus();
    });
    document.body.appendChild(menu);
    positionPersonMenu(menu);
}

function updatePersonGradeBadge(person) {
    if (!person) return;
    const grade = parseInt(person.dataset.grade) || 0;
    const line = $('.member-main-line, .driver-main-line', person);
    if (!line) return;
    line.querySelector('.grade-badge')?.remove();
    if (grade > 0) {
        const badge = ce('span', `grade-badge ${gradeGenderClass(person.dataset.gender)}`);
        badge.dataset.grade = String(grade);
        badge.textContent = `${grade}年`;
        const menuBtn = line.querySelector('.member-menu-btn, .driver-menu-btn');
        line.insertBefore(badge, menuBtn || null);
    }
}

function updatePersonGenderBadge(person) {
    if (!person) return;
    const line = $('.member-main-line, .driver-main-line', person);
    if (!line) return;
    line.querySelector('.gender-badge')?.remove();
    const badge = line.querySelector('.grade-badge');
    if (badge) {
        badge.classList.remove('grade-male', 'grade-female', 'grade-unknown');
        badge.classList.add(gradeGenderClass(person.dataset.gender));
    }
}

function setPersonGrade(person, gradeValue) {
    const grade = Math.max(0, Math.min(4, parseInt(gradeValue) || 0));
    person.dataset.grade = String(grade);
    updatePersonGradeBadge(person);
    updateUI();
    save();
}

function setPersonGender(person, gender) {
    const next = ['male', 'female', 'unknown'].includes(gender) ? gender : 'unknown';
    person.dataset.gender = next;
    updatePersonGenderBadge(person);
    updateUI();
    save();
}

async function returnOrDeleteMemberCard(card) {
    if (!card) return;
    if (card.dataset.locked === 'true') {
        showAppNotice('固定されています。先に固定を解除してください。', true);
        return;
    }
    if (card.parentElement?.id === 'waiting-list') {
        if (await appConfirm('このメンバーを完全に削除しますか？', { title: 'メンバー削除', okText: '削除', danger: true })) card.remove();
    } else if (await appConfirm('車から降ろして未割り当てメンバーに戻しますか？', { title: '未割り当てに戻す', okText: '戻す' })) {
        $('#waiting-list')?.appendChild(card);
    }
    updateUI();
    save();
}

function openCompactPersonMenu(trigger) {
    closePersonMenus();
    const card = trigger.closest('.member-card');
    const driver = trigger.closest('.driver-seat');
    const person = card || driver;
    if (!person) return;
    const isDriver = !!driver;
    const inWaiting = card?.parentElement?.id === 'waiting-list';
    const locked = card?.dataset.locked === 'true';
    const actions = isDriver
        ? [
            ['memo', 'メモ', 'fas fa-sticky-note'],
            ['grade', '学年', 'fas fa-graduation-cap'],
            ['gender', '性別', 'fas fa-venus-mars'],
            ['name', '名前変更', 'fas fa-pen']
          ]
        : [
            ['memo', 'メモ', 'fas fa-sticky-note'],
            ['lock', locked ? '固定解除' : '固定', locked ? 'fas fa-lock-open' : 'fas fa-lock'],
            ['return', inWaiting ? '削除' : '戻す', inWaiting ? 'fas fa-trash-can' : 'fas fa-reply'],
            ['grade', '学年', 'fas fa-graduation-cap'],
            ['gender', '性別', 'fas fa-venus-mars'],
            ['name', '名前変更', 'fas fa-pen']
          ];
    const menu = ce('div', 'person-pop-menu');
    menu.innerHTML = actions.map(([action, label, icon]) => `
        <button type="button" class="person-pop-item ${action === 'return' && inWaiting ? 'danger' : ''}" data-action="${action}">
            <i class="${icon}"></i><span>${label}</span>
        </button>
    `).join('');
    menu.addEventListener('click', event => {
        const item = event.target.closest('.person-pop-item');
        if (!item) return;
        event.preventDefault();
        event.stopPropagation();
        const action = item.dataset.action;
        closePersonMenus();
        if (action === 'memo') handleEdit(isDriver ? 'driverMemo' : 'memo', person);
        else if (action === 'lock' && card) toggleLock(card);
        else if (action === 'return' && card) returnOrDeleteMemberCard(card);
        else if (action === 'name') handleEdit(isDriver ? 'driverName' : 'memberName', person);
        else if (action === 'grade') openChoicePopup('学年', [
            { value: '0', label: '未設定', icon: 'fas fa-minus' },
            { value: '1', label: '1年', icon: 'fas fa-1' },
            { value: '2', label: '2年', icon: 'fas fa-2' },
            { value: '3', label: '3年', icon: 'fas fa-3' },
            { value: '4', label: '4年', icon: 'fas fa-4' }
        ], value => setPersonGrade(person, value));
        else if (action === 'gender') openChoicePopup('性別', [
            { value: 'male', label: '男性', icon: 'fas fa-mars' },
            { value: 'female', label: '女性', icon: 'fas fa-venus' },
            { value: 'unknown', label: '未設定', icon: 'fas fa-circle-question' }
        ], value => setPersonGender(person, value));
    });
    document.body.appendChild(menu);
    positionPersonMenu(menu, trigger);
}

function shouldKeepPersonMenuForTarget(target) {
    return !!target?.closest?.('.person-pop-menu, .member-menu-btn, .driver-menu-btn');
}


function ensureCompactMenuFallback() {
    if (window.__compactMenuFallbackBound) return;
    window.__compactMenuFallbackBound = true;
    document.addEventListener('click', event => {
        const menuTrigger = event.target.closest?.('.member-menu-btn, .driver-menu-btn');
        if (!menuTrigger) return;
        event.preventDefault();
        event.stopPropagation();
        if (typeof openCompactPersonMenu === 'function') openCompactPersonMenu(menuTrigger);
    }, false);
}

function setupCompactPersonMenu() {
    if (setupCompactPersonMenu.bound === true) return;
    setupCompactPersonMenu.bound = true;

    D.addEventListener('click', event => {
        const menuTrigger = event.target.closest?.('.member-menu-btn, .driver-menu-btn');
        if (menuTrigger) {
            event.preventDefault();
            event.stopPropagation();
            openCompactPersonMenu(menuTrigger);
            return;
        }
        if (event.target.closest?.('.person-pop-menu')) return;
        if (event.target.closest?.('.member-name-text, .driver-name-disp')) {
            // 名前タップで性別が切り替わる旧挙動は廃止。
            event.stopPropagation();
            closePersonMenus();
            return;
        }
        closePersonMenus();
    }, true);

    // click が発火しないスマホのスクロール、ドラッグ開始、外側タップでも確実に閉じる。
    D.addEventListener('pointerdown', event => {
        if (shouldKeepPersonMenuForTarget(event.target)) return;
        closePersonMenus();
    }, true);

    D.addEventListener('touchmove', event => {
        if (event.target.closest?.('.person-pop-menu')) return;
        closePersonMenus();
    }, { passive: true, capture: true });

    D.addEventListener('wheel', event => {
        if (event.target.closest?.('.person-pop-menu')) return;
        closePersonMenus();
    }, { passive: true, capture: true });

    D.addEventListener('keydown', event => {
        if (event.key === 'Escape') closePersonMenus();
    }, true);

    window.addEventListener('resize', closePersonMenus, { passive: true });
    window.addEventListener('orientationchange', closePersonMenus, { passive: true });
}

function handleEdit(type, el) {
    const isCap = type === 'capacity';
    const box = isCap ? el.closest('.car-box') : null;
    const card = !isCap ? el.closest('.member-card') : null;
    const driver = !isCap && !card ? el.closest('.driver-seat') : null;

    let initialVal = '', title = '';
    if(isCap) { title = '定員変更'; initialVal = el.val(); }
    else if (type === 'memberName' && card) { title = '名前変更'; initialVal = card.dataset.name || $('.member-name-text', card).innerText; }
    else if (type === 'driverName' && driver) { title = '名前変更'; initialVal = driver.dataset.name || $('.driver-name-disp', driver).innerText; }
    else if (card) { title = 'メモ編集'; initialVal = $('.memo-popup', card).innerText; } 
    else if (driver) { title = '車出しメモ'; initialVal = $('.driver-memo-text', driver).innerText; }

    $('#editModalTitle').innerText = title;
    $('#editModalInput').value = initialVal;
    
    saveCb = () => {
        const v = $('#editModalInput').value;
        if(isCap) {
            const newC = getInt(v);
            if(newC > 0) {
                const boxEl = el.closest('.car-box');
                const grid = $('.car-layout-grid', boxEl);
                const current = $$('.seat-slot', grid);
                if(newC > current.length) {
                    for(let i=0; i<newC-current.length; i++) {
                        const d = ce('div','seat-slot'); grid.appendChild(d); setupSortable(d);
                    }
                } else if(newC < current.length) {
                    for(let i=current.length-1; i>=newC; i--) {
                        if(current[i].children.length) $('#waiting-list').appendChild(current[i].children[0]);
                        current[i].remove();
                    }
                }
                boxEl.dataset.capacity = newC;
            }
        } else if (type === 'memberName' && card) {
            const nextName = v.trim();
            if (!nextName) return;
            card.dataset.name = nextName;
            $('.member-name-text', card).textContent = nextName;
        } else if (type === 'driverName' && driver) {
            const nextName = v.trim();
            if (!nextName) return;
            const oldName = driver.dataset.name || $('.driver-name-disp', driver).innerText;
            driver.dataset.name = nextName;
            $('.driver-name-disp', driver).textContent = nextName;
            const boxEl = driver.closest('.car-box');
            const label = $('.car-name-label', boxEl);
            if (label) label.textContent = `${nextName}車`;
            if (settlementState?.cars?.[oldName] && !settlementState.cars[nextName]) {
                settlementState.cars[nextName] = settlementState.cars[oldName];
                delete settlementState.cars[oldName];
            }
        } else if (card) {
            const m = $('.memo-popup', card); m.innerText = v; m.style.display = v?'block':'none';
        } else if (driver) {
            const m = $('.driver-memo-text', driver); m.innerText = v; m.style.display = v?'block':'none';
        }
        modals.edit.hide(); updateUI(); save();
    };
    modals.edit.show();
}

window.openBatchModal = () => {
    const data = getData();
    
    let members = [];
    let grade1 = [], grade2 = [], grade3 = [], grade4 = [];
    let drivers = [];

    data.waiting.forEach(m => {
        if(m.grade===1) grade1.push(m.name);
        else if(m.grade===2) grade2.push(m.name);
        else if(m.grade===3) grade3.push(m.name);
        else if(m.grade===4) grade4.push(m.name);
        else members.push(m.name);
    });

    data.cars.forEach(c => {
        drivers.push(c.name);
        c.members.forEach(m => {
            if(m && m.name) {
                if(m.grade===1) grade1.push(m.name);
                else if(m.grade===2) grade2.push(m.name);
                else if(m.grade===3) grade3.push(m.name);
                else if(m.grade===4) grade4.push(m.name);
                else members.push(m.name);
            }
        });
    });

    $('#batchMembers').value = members.join('\n');
    $('#batchGrade1').value = grade1.join('\n');
    $('#batchGrade2').value = grade2.join('\n');
    $('#batchGrade3').value = grade3.join('\n');
    $('#batchGrade4').value = grade4.join('\n');
    $('#batchDrivers').value = drivers.join('\n');
    
    modals.batch.show();
}

async function executeBatch() {
    const cleanName = value => String(value || '').replace(/　/g, ' ').replace(/\s+/g, ' ').trim();
    const v = id => $(id).value.split(/\n/).map(cleanName).filter(Boolean);
    const m = v('#batchMembers');
    const g1 = v('#batchGrade1');
    const g2 = v('#batchGrade2');
    const g3 = v('#batchGrade3');
    const g4 = v('#batchGrade4');
    const d = v('#batchDrivers');
    const allEntries = [
        ...m.map(name => ({name, group:'同乗者'})),
        ...g1.map(name => ({name, group:'1年生'})),
        ...g2.map(name => ({name, group:'2年生'})),
        ...g3.map(name => ({name, group:'3年生'})),
        ...g4.map(name => ({name, group:'4年生'})),
        ...d.map(name => ({name, group:'車出し'}))
    ];
    const grouped = allEntries.reduce((acc, item) => {
        acc[item.name] = acc[item.name] || [];
        acc[item.name].push(item.group);
        return acc;
    }, {});
    const duplicates = Object.entries(grouped).filter(([, groups]) => groups.length > 1);
    const warning = byId('batchDuplicateWarning');
    if (duplicates.length) {
        const message = '同じ名前があります：' + duplicates.map(([name, groups]) => `${name}（${groups.join('・')}）`).join('、');
        if (warning) {
            warning.style.display = 'block';
            warning.textContent = message;
        }
        await appAlert(message + '\n重複を直してから登録してください。', { title: '重複があります' });
        return;
    } else if (warning) {
        warning.style.display = 'none';
        warning.textContent = '';
    }
    
    const currentData = getData();
    
    const existingMembers = new Map();
    const existingDrivers = new Map();
    const memberLocations = new Map();

    currentData.waiting.forEach(mem => {
        existingMembers.set(mem.name, mem);
        memberLocations.set(mem.name, {type: 'waiting'});
    });

    currentData.cars.forEach(car => {
        existingDrivers.set(car.name, car);
        car.members.forEach((mem, index) => {
             if(mem && mem.name) {
                 existingMembers.set(mem.name, mem);
                 memberLocations.set(mem.name, {type: 'car', carName: car.name, slot: index});
             }
        });
    });

    const newDriversList = new Set(d);

    $('#waiting-list').innerHTML = '';
    $('#cars-container').innerHTML = '';

    d.forEach(driverName => {
        if(existingDrivers.has(driverName)) {
            const oldCar = existingDrivers.get(driverName);
            addCar(driverName, oldCar.capacity, [], oldCar.driverMemo, oldCar.driverGender);
        } else {
            addCar(driverName, 3);
            detectGender(driverName);
        }
    });

    const carBoxes = Array.from($$('.car-box'));

    const gradeMap = new Map();
    g1.forEach(n => gradeMap.set(n, 1));
    g2.forEach(n => gradeMap.set(n, 2));
    g3.forEach(n => gradeMap.set(n, 3));
    g4.forEach(n => gradeMap.set(n, 4));
    m.forEach(n => { if(!gradeMap.has(n)) gradeMap.set(n, 0); });

    [...m, ...g1, ...g2, ...g3, ...g4].forEach(name => {
        placeMember(name, gradeMap.get(name)||0);
    });

    function placeMember(name, grade) {
        if (existingMembers.has(name)) {
            const oldData = existingMembers.get(name);
            const loc = memberLocations.get(name);
            oldData.grade = grade;

            if (loc.type === 'car' && newDriversList.has(loc.carName)) {
                const targetCarBox = carBoxes.find(b => $('.driver-name-disp', b).innerText === loc.carName);
                if (targetCarBox) {
                    const slots = $$('.seat-slot', targetCarBox);
                    if(slots[loc.slot] && slots[loc.slot].children.length === 0) {
                        addMember(name, oldData.memo, oldData.gender, grade, slots[loc.slot], oldData.locked);
                    } else {
                        const emptySlot = Array.from(slots).find(s => s.children.length === 0);
                        if(emptySlot) {
                             addMember(name, oldData.memo, oldData.gender, grade, emptySlot, oldData.locked);
                        } else {
                             addMember(name, oldData.memo, oldData.gender, grade, $('#waiting-list'), oldData.locked);
                        }
                    }
                } else {
                     addMember(name, oldData.memo, oldData.gender, grade, $('#waiting-list'), oldData.locked);
                }
            } else {
                addMember(name, oldData.memo, oldData.gender, grade, $('#waiting-list'), oldData.locked);
            }
        } else {
            addMember(name, '', 'unknown', grade, $('#waiting-list'));
            detectGender(name);
        }
    }

    save(); 
    modals.batch.hide();
}
window.executeBatch = executeBatch;

function showCopyFallback(message, text) {
    let box = byId('copy-fallback');
    if (!box) {
        box = document.createElement('div');
        box.id = 'copy-fallback';
        box.style.cssText = 'position:fixed;left:12px;right:12px;bottom:16px;max-width:560px;margin:0 auto;background:var(--modal-bg,#fff);color:var(--text-main,#172033);border:1px solid var(--border-color,#dbe4df);border-radius:10px;padding:12px;z-index:10000;box-shadow:0 12px 28px rgba(15,23,42,0.20);';
        document.body.appendChild(box);
    }
    box.innerHTML = '';

    const label = document.createElement('div');
    label.textContent = message;
    label.style.cssText = 'font-size:0.82rem;font-weight:800;margin-bottom:8px;';

    const textarea = document.createElement('textarea');
    textarea.readOnly = true;
    textarea.value = text;
    textarea.style.cssText = 'width:100%;min-height:54px;max-height:160px;resize:vertical;border:1px solid var(--border-color,#dbe4df);border-radius:6px;background:var(--bg-card,#fff);color:var(--text-main,#172033);font-size:0.8rem;line-height:1.45;padding:8px;';

    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = '閉じる';
    close.style.cssText = 'width:100%;margin-top:8px;border:0;border-radius:6px;background:var(--accent-color,#0f766e);color:#fff;font-size:0.82rem;font-weight:800;padding:9px 12px;';
    close.onclick = () => box.remove();

    box.append(label, textarea, close);
    textarea.focus();
    textarea.select();
}

function copyUrl() { 
    navigator.clipboard.writeText(window.location.href).then(() => {
        let toast = byId('copy-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'copy-toast';
            toast.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#1e293b;color:#fff;padding:9px 16px;border-radius:18px;font-size:0.78rem;font-weight:700;z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,0.25);opacity:0;transition:opacity 0.3s;white-space:normal;max-width:min(92vw,520px);text-align:center;pointer-events:none;';
            document.body.appendChild(toast);
        }
        toast.textContent = '✓ 共有リンクをコピーしました。参加者は車割発表ビューで開きます';
        toast.style.opacity = '1';
        setTimeout(() => { toast.style.opacity = '0'; }, 2000);
    }).catch(() => {
        showCopyFallback('共有リンクをコピーしてください', window.location.href);
    });
}

function selectGrade(btn) {
    if (!btn) return;
    document.querySelectorAll('.grade-select-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
}
window.selectGrade = selectGrade;

let currentView = 'sheet';
async function switchView(view) {
    if (view !== 'sheet' && editLockEnabled && !hasTrustedEditAccess()) {
        const label = view === 'seisan' ? '精算ツール' : '車割メーカー';
        if (!(await verifyEditPassphrase(`${label}を開くには合言葉を入力してください`))) return;
    }
    currentView = view;
    const listArea = byId('top-area');
    const sheetArea = byId('sheet-view-area');
    const bottomTray = byId('bottom-tray');
    const tabList = byId('tab-list');
    const tabSheet = byId('tab-sheet');
    const tabSeisan = byId('tab-seisan');
    const seisanArea = byId('seisan-view-area');

    if (view === 'seisan') {
        document.body.classList.remove('sheet-mode');
        listArea.style.display = 'none';
        bottomTray.style.display = 'none';
        sheetArea.classList.remove('active');
        seisanArea.classList.add('active');
        tabList.classList.remove('active');
        tabSheet.classList.remove('active');
        tabSeisan.classList.add('active');
        updateQuickEditButton();
        renderSettlementView();
        return;
    }

    seisanArea.classList.remove('active');
    tabSeisan.classList.remove('active');

    if (view === 'sheet') {
        document.body.classList.add('sheet-mode');
        listArea.style.display = 'none';
        bottomTray.style.display = 'none';
        sheetArea.classList.add('active');
        tabList.classList.remove('active');
        tabSheet.classList.add('active');
        updateQuickEditButton();
        renderSheetView();
        showSheetHint();
    } else {
        document.body.classList.remove('sheet-mode');
        listArea.style.display = '';
        bottomTray.style.display = '';
        sheetArea.classList.remove('active');
        tabList.classList.add('active');
        tabSheet.classList.remove('active');
        updateQuickEditButton();
    }
}
window.switchView = switchView;

function showSheetHint() {
    const hint = byId('sheet-hint');
    hint.classList.add('visible');
    setTimeout(() => hint.classList.remove('visible'), 3000);
}

function isSheetDragHandle(target) {
    return quickEditMode && hasTrustedEditAccess() && !!target.closest('.sheet-chip.draggable, .sheet-dropzone, .sheet-waiting-list');
}

function escapeHtml(text) {
    return String(text ?? '').replace(/[&<>"']/g, ch => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[ch]));
}

function migrateAppData(rawData) {
    const data = rawData && typeof rawData === 'object' ? rawData : {};
    const version = Number(data.schemaVersion || 1);
    const migrated = { ...data };

    if (version < 2) {
        migrated.schemaVersion = 2;
        migrated.meta = {
            ...(migrated.meta || {}),
            migratedAt: new Date().toISOString(),
            migratedFrom: version
        };
    }

    if (!migrated.schemaVersion) migrated.schemaVersion = APP_SCHEMA_VERSION;
    return migrated;
}

function stampSchemaVersion(data) {
    if (!data || typeof data !== 'object') return data;
    return {
        ...data,
        schemaVersion: APP_SCHEMA_VERSION,
        updatedAt: Date.now(),
        updatedBy: (typeof myClientId !== 'undefined' ? myClientId : 'local')
    };
}

function safeJsonParse(value, fallback = null) {
    if (value == null || value === '') return fallback;
    try { return JSON.parse(value); }
    catch (error) {
        console.warn('JSON parse failed:', error);
        return fallback;
    }
}

function safeLocalGet(key, fallback = null) {
    try {
        return safeJsonParse(localStorage.getItem(key), fallback);
    } catch (error) {
        console.warn('localStorage get failed:', error);
        return fallback;
    }
}

function safeLocalSet(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (error) {
        console.warn('localStorage save failed:', error);
        window.showSaveStatus?.('保存失敗');
        return false;
    }
}

function safeLocalRemove(key) {
    try {
        localStorage.removeItem(key);
        return true;
    } catch (error) {
        console.warn('localStorage remove failed:', error);
        return false;
    }
}


function renderSheetPlain(member) {
    const grade = member.grade || 0;
    const gradeBadge = renderGradeBadge(grade, member.gender || 'unknown');
    return `${gradeBadge}<span class="sheet-cell-text">${escapeHtml(member.name)}</span>`;
}

function renderSheetChip(member) {
    const grade = member.grade || 0;
    const gender = member.gender || 'unknown';
    const gradeBadge = renderGradeBadge(grade, member.gender || 'unknown');
    const draggable = !member.locked && hasTrustedEditAccess() && quickEditMode;
    const lockIcon = member.locked ? `<i class="fas fa-lock" style="font-size:0.62rem; opacity:0.7;"></i>` : '';
    return `<div class="sheet-chip ${draggable ? 'draggable' : ''} ${member.locked ? 'locked' : ''}" data-name="${escapeHtml(member.name)}" data-gender="${gender}" data-locked="${member.locked ? 'true' : 'false'}">${gradeBadge}<span class="sheet-chip-text">${escapeHtml(member.name)}</span>${lockIcon}</div>`;
}

function clearSheetSortables() {
    activeSheetSortable.forEach(instance => {
        try { instance.destroy(); } catch (e) {}
    });
    activeSheetSortable = [];
}

function findMemberCardByName(name) {
    return Array.from($$('.member-card')).find(card => card.dataset.name === name);
}

function moveCardToSheetLocation(card, zone) {
    if (!card || !zone) return;
    const type = zone.dataset.zoneType;
    if (type === 'waiting') {
        $('#waiting-list').appendChild(card);
        return;
    }
    const carName = zone.dataset.carName;
    const slotIndex = parseInt(zone.dataset.slotIndex, 10);
    const targetCar = Array.from($$('.car-box')).find(box => $('.driver-name-disp', box)?.innerText === carName);
    if (!targetCar) return;
    const slots = $$('.seat-slot', targetCar);
    const targetSlot = slots[slotIndex];
    if (!targetSlot) return;

    const existing = Array.from(targetSlot.children).find(child => child !== card);
    if (existing) {
        if (card.parentElement && card.parentElement.id === 'waiting-list') {
            $('#waiting-list').appendChild(existing);
        } else if (card.parentElement && card.parentElement.classList.contains('seat-slot')) {
            card.parentElement.appendChild(existing);
        } else {
            $('#waiting-list').appendChild(existing);
        }
    }
    targetSlot.appendChild(card);
}

function syncSheetToMainData() {
    const names = new Set();
    document.querySelectorAll('.sheet-dropzone .sheet-chip, .sheet-waiting-list .sheet-chip').forEach(chip => {
        const name = chip.dataset.name;
        if (!name || names.has(name)) return;
        names.add(name);
        const card = findMemberCardByName(name);
        if (card && card.dataset.locked !== 'true') {
            moveCardToSheetLocation(card, chip.parentElement);
        }
    });
    updateUI();
    save();
}

function getSheetZoneChip(zone, excluded = []) {
    return Array.from(zone?.children || []).find(child =>
        child.classList?.contains('sheet-chip') &&
        !child.classList.contains('manual-sheet-drag-float') &&
        !excluded.includes(child)
    ) || null;
}

function clearSheetZoneText(zone) {
    if (!zone || zone.dataset.zoneType !== 'seat') return;
    Array.from(zone.childNodes).forEach(node => {
        if (node.nodeType === Node.TEXT_NODE) node.remove();
    });
}

function getManualSheetDropZone(clientX, clientY) {
    const el = document.elementFromPoint(clientX, clientY);
    if (!el) return null;
    return el.closest('.sheet-dropzone, .sheet-waiting-list');
}

function moveManualSheetChipTo(zone) {
    if (!manualSheetDrag) return;
    if ((zone || null) === (manualSheetDrag.dropZone || null)) return;
    document.querySelectorAll('.drop-target').forEach(el => el.classList.remove('drop-target'));
    manualSheetDrag.dropZone = null;
    if (!zone || !zone.isConnected) return;
    if (zone.dataset.acceptDrop === 'false') return;
    manualSheetDrag.dropZone = zone;
    zone.closest('.sheet-seat-row, .sheet-driver-row')?.classList.add('drop-target');
}

function commitManualSheetDrop() {
    if (!manualSheetDrag) return;
    const chip = manualSheetDrag.chip;
    const zone = manualSheetDrag.dropZone;
    if (!zone || !zone.isConnected) return;
    if (zone.dataset.acceptDrop === 'false') return;
    if (zone === manualSheetDrag.currentZone) return;

    if (zone.dataset.zoneType === 'waiting') {
        zone.appendChild(chip);
        manualSheetDrag.currentZone = zone;
        return;
    }

    if (zone.dataset.zoneType !== 'seat') return;
    const current = manualSheetDrag.currentZone;
    const occupant = getSheetZoneChip(zone, [chip]);
    clearSheetZoneText(zone);

    if (occupant) {
        if (current?.dataset?.zoneType === 'seat') {
            clearSheetZoneText(current);
            current.appendChild(occupant);
        } else if (current?.dataset?.zoneType === 'waiting') {
            current.appendChild(occupant);
        }
    }

    zone.appendChild(chip);
    manualSheetDrag.currentZone = zone;
}

function updateManualSheetFloat(clientX, clientY) {
    if (!manualSheetDrag?.floating) return;
    const left = clientX - manualSheetDrag.offsetX;
    const top = clientY - manualSheetDrag.offsetY;
    if (!Number.isFinite(left) || !Number.isFinite(top)) return;
    manualSheetDrag.floating.style.left = `${left}px`;
    manualSheetDrag.floating.style.top = `${top}px`;
    manualSheetDrag.floating.style.transform = 'scale(1.03)';
}

function finishManualSheetDrag(commit = true) {
    if (!manualSheetDrag) return;
    const { chip, floating } = manualSheetDrag;
    if (commit) commitManualSheetDrop();
    floating?.remove();
    chip.classList.remove('manual-sheet-drag-source');
    D.body.classList.remove('manual-sheet-dragging');
    manualSheetDrag = null;
    isDraggingCards = false;
    document.querySelectorAll('.drop-target').forEach(el => el.classList.remove('drop-target'));
    syncSheetToMainData();
}

function startManualSheetDrag(chip, point) {
    if (manualSheetDrag || !chip?.isConnected) return;
    const currentZone = chip.parentElement;
    if (!(currentZone?.classList?.contains('sheet-dropzone') || currentZone?.classList?.contains('sheet-waiting-list'))) return;

    const rect = chip.getBoundingClientRect();
    const clientX = getFinitePointerCoord(point, 'clientX', rect.left + rect.width / 2);
    const clientY = getFinitePointerCoord(point, 'clientY', rect.top + rect.height / 2);
    const floating = chip.cloneNode(true);
    floating.classList.add('manual-sheet-drag-float');
    floating.style.width = `${rect.width}px`;
    floating.style.height = `${rect.height}px`;
    D.body.appendChild(floating);

    manualSheetDrag = {
        chip,
        floating,
        currentZone,
        pointerId: point?.pointerId ?? null,
        pointerType: point?.pointerType || (point?.touchIdentifier != null ? 'touch' : 'mouse'),
        touchIdentifier: point?.touchIdentifier ?? null,
        offsetX: clampDragOffset(clientX - rect.left, rect.width, 6),
        offsetY: clampDragOffset(clientY - rect.top, rect.height, 6)
    };

    try { if (manualSheetDrag.pointerId != null) chip.setPointerCapture?.(manualSheetDrag.pointerId); } catch (_) {}
    chip.classList.add('manual-sheet-drag-source');
    D.body.classList.add('manual-sheet-dragging');
    isDraggingCards = true;
    updateManualSheetFloat(clientX, clientY);
}

function setupManualSheetDrag() {
    let pending = null;
    const touchDelay = 260;
    const mouseDelay = 55;
    const touchMoveCancel = 22;

    const canStartFromTarget = target => {
        if (currentView !== 'sheet' || !quickEditMode || !hasTrustedEditAccess()) return null;
        const chip = target.closest?.('.sheet-chip.draggable');
        if (!chip || chip.classList.contains('manual-sheet-drag-float')) return null;
        const zone = chip.parentElement;
        if (!(zone?.classList?.contains('sheet-dropzone') || zone?.classList?.contains('sheet-waiting-list'))) return null;
        return chip;
    };

    const clearPending = () => {
        clearTimeout(pending?.timer);
        pending = null;
    };

    const findTouch = (touchList, identifier) => Array.from(touchList || []).find(t => t.identifier === identifier) || null;

    D.addEventListener('pointerdown', e => {
        if (e.pointerType === 'touch') return;
        if (e.button !== undefined && e.button !== 0) return;
        const chip = canStartFromTarget(e.target);
        if (!chip) return;

        e.preventDefault();
        e.stopPropagation();
        chip.setPointerCapture?.(e.pointerId);
        clearPending();
        const nextPending = {
            chip,
            pointerId: e.pointerId,
            touchIdentifier: null,
            startX: e.clientX,
            startY: e.clientY,
            clientX: e.clientX,
            clientY: e.clientY,
            pointerType: e.pointerType,
            timer: null
        };
        nextPending.timer = setTimeout(() => startManualSheetDrag(chip, nextPending), mouseDelay);
        pending = nextPending;
    }, { passive: false });

    D.addEventListener('pointermove', e => {
        if (e.pointerType === 'touch') return;
        if (pending && pending.pointerId === e.pointerId && !manualSheetDrag) {
            pending.clientX = e.clientX;
            pending.clientY = e.clientY;
            const moved = window.SanpoDrag?.distance?.(pending.startX, pending.startY, e.clientX, e.clientY) ?? Math.hypot(e.clientX - pending.startX, e.clientY - pending.startY);
            if (moved > 8) startManualSheetDrag(pending.chip, pending);
        }
        if (!manualSheetDrag || manualSheetDrag.pointerId !== e.pointerId) return;
        e.preventDefault();
        updateManualSheetFloat(e.clientX, e.clientY);
        const zone = getManualSheetDropZone(e.clientX, e.clientY);
        moveManualSheetChipTo(zone);
    }, { passive: false });

    const cancelPointerPending = e => {
        if (pending && pending.pointerId === e.pointerId) clearPending();
    };

    D.addEventListener('pointerup', e => {
        if (e.pointerType === 'touch') return;
        cancelPointerPending(e);
        if (manualSheetDrag && manualSheetDrag.pointerId === e.pointerId) finishManualSheetDrag(true);
    }, { passive: true });
    D.addEventListener('pointercancel', e => {
        if (e.pointerType === 'touch') return;
        cancelPointerPending(e);
        if (manualSheetDrag && manualSheetDrag.pointerId === e.pointerId) finishManualSheetDrag(false);
    }, { passive: true });

    D.addEventListener('touchstart', e => {
        if (e.touches.length !== 1) return;
        const touch = e.changedTouches?.[0];
        if (!touch) return;
        const chip = canStartFromTarget(e.target);
        if (!chip) return;

        clearPending();
        const nextPending = {
            chip,
            pointerId: null,
            touchIdentifier: touch.identifier,
            startX: touch.clientX,
            startY: touch.clientY,
            clientX: touch.clientX,
            clientY: touch.clientY,
            pointerType: 'touch',
            timer: null
        };
        nextPending.timer = setTimeout(() => startManualSheetDrag(chip, nextPending), touchDelay);
        pending = nextPending;
    }, { passive: false });

    D.addEventListener('touchmove', e => {
        if (pending && pending.pointerType === 'touch' && !manualSheetDrag) {
            const touch = findTouch(e.touches, pending.touchIdentifier);
            if (!touch) return;
            pending.clientX = touch.clientX;
            pending.clientY = touch.clientY;
            const moved = window.SanpoDrag?.distance?.(pending.startX, pending.startY, touch.clientX, touch.clientY) ?? Math.hypot(touch.clientX - pending.startX, touch.clientY - pending.startY);
            if (moved > touchMoveCancel) {
                clearPending();
                return;
            }
        }

        if (!manualSheetDrag || manualSheetDrag.pointerType !== 'touch') return;
        const touch = findTouch(e.touches, manualSheetDrag.touchIdentifier);
        if (!touch) return;
        e.preventDefault();
        e.stopPropagation();
        updateManualSheetFloat(touch.clientX, touch.clientY);
        const zone = getManualSheetDropZone(touch.clientX, touch.clientY);
        moveManualSheetChipTo(zone);
    }, { passive: false });

    D.addEventListener('touchend', e => {
        if (pending && pending.pointerType === 'touch' && findTouch(e.changedTouches, pending.touchIdentifier)) clearPending();
        if (manualSheetDrag?.pointerType === 'touch' && findTouch(e.changedTouches, manualSheetDrag.touchIdentifier)) finishManualSheetDrag(true);
    }, { passive: true });

    D.addEventListener('touchcancel', e => {
        if (pending && pending.pointerType === 'touch' && findTouch(e.changedTouches, pending.touchIdentifier)) clearPending();
        if (manualSheetDrag?.pointerType === 'touch' && findTouch(e.changedTouches, manualSheetDrag.touchIdentifier)) finishManualSheetDrag(false);
    }, { passive: true });
}

function setupSheetSortables() {
    clearSheetSortables();
    // 発表ビューのクイック編集も setupManualSheetDrag() に一本化しています。
    // 旧 Sortable 実装はスクロール・ピンチ操作と競合するため、ここでは初期化しません。
    return null;
}


function renderSheetEmptyHtml() {
    return `
        <div class="sheet-empty-card">
            <div class="sheet-empty-icon"><i class="fas fa-car-side" aria-hidden="true"></i></div>
            <div class="sheet-empty-title">まずは参加者登録から</div>
            <div class="sheet-empty-text">企画の参加者と車出しを登録すると、ここに発表用の車割が表示されます。</div>
            <div class="sheet-empty-actions">
              <button class="seisan-btn primary" type="button" data-action="open-batch-from-sheet"><i class="fas fa-paste me-1"></i>参加者登録を開く</button>
              <button class="seisan-btn" type="button" data-action="switch-list"><i class="fas fa-edit me-1"></i>車割メーカーへ</button>
            </div>
        </div>`;
}

function createSheetLabelColumn(maxSeats) {
    const labelCol = document.createElement('div');
    labelCol.className = 'sheet-car-col';
    labelCol.style.minWidth = '60px';
    labelCol.innerHTML = `
        <div class="sheet-car-header" style="background:var(--sheet-header);color:var(--text-sub);">　</div>
        <div class="sheet-driver-row" style="font-weight:700;color:var(--text-sub);font-size:0.72rem;background:var(--sheet-header);">車出し</div>
        ${Array.from({length:maxSeats},(_,i)=>`<div class="sheet-seat-row" style="background:var(--sheet-header);color:var(--text-sub);font-size:0.72rem;font-weight:600;">席 ${i+1}</div>`).join('')}
    `;
    return labelCol;
}

function renderSheetCarColumnHtml(car, maxSeats) {
    const cap = parseInt(car.capacity)||0;
    const filled = (car.members||[]).filter(Boolean).length;
    const capColor = filled > cap ? '#b91c1c' : filled === cap ? 'var(--accent-color)' : 'var(--text-sub)';

    let html = `<div class="sheet-car-header">${escapeHtml(car.name)}車 <span class="sheet-capacity-badge" style="color:${capColor}">${filled}/${cap}</span></div>`;

    const dg = car.driverGender || 'unknown';
    const dgrade = parseInt(car.driverGrade) || 0;
    const dgradeBadge = renderGradeBadge(dgrade, dg);
    html += `<div class="sheet-driver-row" data-gender="${dg}">
        <i class="fas fa-car" style="font-size:0.65rem;opacity:0.6;"></i>
        <span style="font-weight:700;">${escapeHtml(car.name)}</span>${dgradeBadge}
    </div>`;

    for (let i = 0; i < maxSeats; i++) {
        const mem = (car.members||[])[i];
        if (i >= cap) {
            html += `<div class="sheet-seat-row" style="background:var(--bg-body);"></div>`;
        } else if (mem && mem.name) {
            const g = mem.gender || 'unknown';
            html += quickEditMode
                ? `<div class="sheet-seat-row" data-gender="${g}"><div class="sheet-dropzone" data-zone-type="seat" data-car-name="${escapeHtml(car.name)}" data-slot-index="${i}" data-accept-drop="${mem.locked ? 'false' : 'true'}">${renderSheetChip(mem)}</div></div>`
                : `<div class="sheet-seat-row" data-gender="${g}">${renderSheetPlain(mem)}</div>`;
        } else {
            html += quickEditMode
                ? `<div class="sheet-seat-row empty"><div class="sheet-dropzone" data-zone-type="seat" data-car-name="${escapeHtml(car.name)}" data-slot-index="${i}" data-accept-drop="true">空き</div></div>`
                : `<div class="sheet-seat-row empty">空き</div>`;
        }
    }
    return html;
}

function createSheetCarColumn(car, maxSeats) {
    const col = document.createElement('div');
    col.className = 'sheet-car-col';
    col.innerHTML = renderSheetCarColumnHtml(car, maxSeats);
    return col;
}

function renderSheetWaitingHtml(data) {
    let wHtml = `<div class="sheet-wait-header">待機中 (${data.waiting.length})</div>`;
    if (quickEditMode) {
        wHtml += `<div class="sheet-wait-body"><div class="sheet-waiting-list" data-zone-type="waiting" data-accept-drop="true">${data.waiting.map(m => renderSheetChip(m)).join('')}</div></div>`;
    } else {
        wHtml += `<div class="sheet-wait-body">${data.waiting.length ? data.waiting.map(m => {
            const g = m.gender || 'unknown';
            return `<div class="sheet-wait-item" data-gender="${g}">${renderSheetPlain(m)}</div>`;
        }).join('') : '<div class="sheet-wait-item empty">待機メンバーはいません</div>'}</div>`;
    }
    return wHtml;
}

function createSheetWaitingColumn(data) {
    const waitCol = document.createElement('div');
    waitCol.className = 'sheet-wait-block';
    waitCol.innerHTML = renderSheetWaitingHtml(data);
    return waitCol;
}

function renderSheetView() {
    const canvas = byId('sheet-canvas');
    if (!canvas) return;
    clearSheetSortables();
    canvas.innerHTML = '';
    updateQuickEditButton();
    const data = getData();
    updateSheetSummary(data);

    if (!data.cars.length) {
        canvas.innerHTML = renderSheetEmptyHtml();
        return;
    }

    const maxSeats = Math.max(...data.cars.map(c => parseInt(c.capacity)||0));
    canvas.appendChild(createSheetLabelColumn(maxSeats));
    data.cars.forEach(car => canvas.appendChild(createSheetCarColumn(car, maxSeats)));
    canvas.appendChild(createSheetWaitingColumn(data));

    setupSheetSortables();
}


let sheetScale = 1, sheetX = 0, sheetY = 0;
let isPanning = false, panStartX = 0, panStartY = 0, panOriginX = 0, panOriginY = 0;
let lastPinchDist = 0;

function applySheetTransform() {
    const canvas = byId('sheet-canvas');
    if (canvas) canvas.style.transform = `translate(${sheetX}px,${sheetY}px) scale(${sheetScale})`;
}

function zoomIn() { sheetScale = Math.min(sheetScale * 1.25, 4); applySheetTransform(); }
function zoomOut() { sheetScale = Math.max(sheetScale / 1.25, 0.3); applySheetTransform(); }
function resetZoom() { sheetScale=1; sheetX=0; sheetY=0; applySheetTransform(); }
window.zoomIn = zoomIn; window.zoomOut = zoomOut; window.resetZoom = resetZoom;

D.addEventListener('DOMContentLoaded', () => {
    const area = byId('sheet-view-area');
    if (!area) return;
    const preventSheetTextSelection = e => {
        if (isSheetDragHandle(e.target)) e.preventDefault();
    };

    area.addEventListener('contextmenu', preventSheetTextSelection);
    area.addEventListener('selectstart', preventSheetTextSelection);
    area.addEventListener('touchstart', () => {
        if (quickEditMode && currentView === 'sheet' && window.getSelection) {
            window.getSelection()?.removeAllRanges();
        }
    }, { passive: true });

    area.addEventListener('mousedown', e => {
        if (e.target.closest('button') || isSheetDragHandle(e.target)) return;
        isPanning = true; panStartX = e.clientX; panStartY = e.clientY;
        panOriginX = sheetX; panOriginY = sheetY;
        area.style.cursor = 'grabbing';
    });
    D.addEventListener('mousemove', e => {
        if (!isPanning) return;
        sheetX = panOriginX + (e.clientX - panStartX);
        sheetY = panOriginY + (e.clientY - panStartY);
        applySheetTransform();
    });
    D.addEventListener('mouseup', () => { isPanning = false; area.style.cursor = ''; });

    area.addEventListener('wheel', e => {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.1 : 0.9;
        const rect = area.getBoundingClientRect();
        const mx = e.clientX - rect.left, my = e.clientY - rect.top;
        sheetX = mx - (mx - sheetX) * factor;
        sheetY = my - (my - sheetY) * factor;
        sheetScale = Math.max(0.3, Math.min(4, sheetScale * factor));
        applySheetTransform();
    }, { passive: false });

    area.addEventListener('touchstart', e => {
        if (e.target.closest('button') || isSheetDragHandle(e.target)) return;
        if (e.touches.length === 1) {
            isPanning = true;
            panStartX = e.touches[0].clientX; panStartY = e.touches[0].clientY;
            panOriginX = sheetX; panOriginY = sheetY;
        } else if (e.touches.length === 2) {
            isPanning = false;
            lastPinchDist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
        }
    }, { passive: true });

    area.addEventListener('touchmove', e => {
        e.preventDefault();
        if (e.touches.length === 1 && isPanning) {
            sheetX = panOriginX + (e.touches[0].clientX - panStartX);
            sheetY = panOriginY + (e.touches[0].clientY - panStartY);
            applySheetTransform();
        } else if (e.touches.length === 2) {
            const dist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            if (lastPinchDist > 0) {
                const factor = dist / lastPinchDist;
                const rect = area.getBoundingClientRect();
                const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
                const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
                sheetX = cx - (cx - sheetX) * factor;
                sheetY = cy - (cy - sheetY) * factor;
                sheetScale = Math.max(0.3, Math.min(4, sheetScale * factor));
                applySheetTransform();
            }
            lastPinchDist = dist;
        }
    }, { passive: false });

    area.addEventListener('touchend', () => { isPanning = false; lastPinchDist = 0; });
});

function getDefaultSettlementState() {
    return {
        rounding: '100',
        organizerFree: true,
        organizerName: '',
        driverReward: '1000',
        cars: {},
        routeStops: [],
        paid: {},
        driverPaid: {}
    };
}

function normalizeExtraItem(ex = {}) {
    const type = ex.type === 'club' ? 'club' : 'split';
    return {
        name: String(ex.name ?? '').trim(),
        amount: String(ex.amount ?? ''),
        type
    };
}

function hasMeaningfulExtra(ex = {}) {
    return Boolean(String(ex.name ?? '').trim() || String(ex.amount ?? '').trim());
}

function normalizeCarSettlementState(raw = {}) {
    // 入力中の空行も保持する。
    // ここで空行を消すと、「諸経費を追加」直後に再描画で行が消えるため。
    const extras = Array.isArray(raw.extras) ? raw.extras.map(normalizeExtraItem) : [];
    if (!extras.length) {
        if (String(raw.splitExtra ?? '').trim()) extras.push({ name: '諸経費', amount: String(raw.splitExtra), type: 'split' });
        if (String(raw.clubExtra ?? '').trim()) extras.push({ name: '部費負担', amount: String(raw.clubExtra), type: 'club' });
    }
    return {
        dist: String(raw.dist ?? ''),
        eco: String(raw.eco ?? ''),
        price: String(raw.price ?? ''),
        extras
    };
}

function normalizeSettlementState(state = {}) {
    const base = getDefaultSettlementState();
    const cars = {};
    if (state.cars && typeof state.cars === 'object') {
        Object.entries(state.cars).forEach(([name, car]) => {
            cars[name] = normalizeCarSettlementState(car || {});
        });
    }
    return {
        ...base,
        ...state,
        rounding: String(state.rounding ?? base.rounding),
        organizerFree: state.organizerFree !== undefined ? !!state.organizerFree : true,
        organizerName: state.organizerName || '',
        driverReward: String(state.driverReward ?? base.driverReward),
        cars,
        routeStops: Array.isArray(state.routeStops) ? state.routeStops.map(v => String(v ?? '').trim()).filter(Boolean) : [],
        paid: state.paid && typeof state.paid === 'object' ? state.paid : {},
        driverPaid: state.driverPaid && typeof state.driverPaid === 'object' ? state.driverPaid : {}
    };
}

function ensureSettlementState() {
    if (!settlementState) settlementState = normalizeSettlementState({});
    return settlementState;
}

function getNumberValue(value) {
    const n = Number(String(value ?? '').replace(/,/g, ''));
    return Number.isFinite(n) ? n : 0;
}

function roundUp(value, unit) {
    const u = Math.max(1, Number(unit) || 1);
    return Math.ceil(value / u) * u;
}

function yen(value) {
    return window.SanpoSettlement?.yen ? window.SanpoSettlement.yen(value) : ('¥' + Math.round(value || 0).toLocaleString());
}

function getRoomDataOnly() {
    return {
        roomName: $('#roomNameInput')?.value || '',
        waiting: Array.from($$('#waiting-list .member-card')).map(getMemData),
        cars: Array.from($$('.car-box')).map(c => ({
            name: $('.driver-name-disp', c).innerText,
            capacity: c.dataset.capacity,
            driverMemo: $('.driver-memo-text', c).innerText,
            driverGender: $('.driver-seat', c).dataset.gender,
            driverGrade: parseInt($('.driver-seat', c).dataset.grade)||0,
            members: Array.from($$('.seat-slot', c)).flatMap(s => getRealSeatCards(s).map(getMemData))
        }))
    };
}

function getParticipantList(data = null) {
    const source = data || getRoomDataOnly();
    const seen = new Set();
    const list = [];
    const push = (name, role) => {
        const key = String(name || '').trim();
        if (!key || seen.has(key)) return;
        seen.add(key);
        list.push({ name: key, role });
    };
    (source.cars || []).forEach(car => {
        push(car.name, 'driver');
        (car.members || []).forEach(m => push(m?.name, 'member'));
    });
    (source.waiting || []).forEach(m => push(m?.name, 'waiting'));
    return list;
}

function syncSettlementStateFromDOM() {
    const state = ensureSettlementState();
    const rounding = byId('seisanRounding');
    const organizerFree = byId('seisanOrganizerFree');
    const organizerName = byId('seisanOrganizerName');
    const driverReward = byId('seisanDriverReward');

    if (rounding) state.rounding = rounding.value || '100';
    if (organizerFree) state.organizerFree = organizerFree.checked;
    if (organizerName) state.organizerName = organizerName.value || '';
    if (driverReward) state.driverReward = driverReward.value;

    document.querySelectorAll('.seisan-car-row').forEach(row => {
        const name = row.dataset.driverName;
        if (!name) return;
        // 入力途中の空行も保持する。計算時だけ空行を除外する。
        const extras = Array.from(row.querySelectorAll('.seisan-extra-row')).map(exRow => normalizeExtraItem({
            name: exRow.querySelector('[data-extra-field="name"]')?.value || '',
            amount: exRow.querySelector('[data-extra-field="amount"]')?.value || '',
            type: exRow.querySelector('[data-extra-field="type"]')?.value || 'split'
        }));
        state.cars[name] = normalizeCarSettlementState({
            dist: row.querySelector('[data-field="dist"]')?.value || '',
            eco: row.querySelector('[data-field="eco"]')?.value || '',
            price: row.querySelector('[data-field="price"]')?.value || '',
            extras
        });
    });
    return state;
}

function getSettlementSnapshot() {
    const state = ensureSettlementState();
    const settlementArea = byId('seisan-view-area');
    if (settlementArea && settlementArea.classList.contains('active')) syncSettlementStateFromDOM();
    return JSON.parse(JSON.stringify(state));
}

function calculateSettlement(data, state) {
    const participants = getParticipantList(data);
    const organizerName = state.organizerName || '';
    const organizerSelected = !!organizerName;
    const excludedName = state.organizerFree && organizerSelected ? organizerName : '';
    const payerCount = Math.max(0, state.organizerFree
        ? (organizerSelected ? participants.filter(p => p.name !== excludedName).length : participants.length - 1)
        : participants.length);
    const rounding = getNumberValue(state.rounding) || 100;
    const reward = Math.max(0, getNumberValue(state.driverReward));

    let totalSplit = 0;
    let totalClub = 0;
    let totalReward = 0;
    let totalDriverRound = 0;
    const cars = (data.cars || []).map(car => {
        const cState = normalizeCarSettlementState(state.cars?.[car.name] || {});
        const dist = getNumberValue(cState.dist);
        const eco = getNumberValue(cState.eco);
        const price = getNumberValue(cState.price);
        const gas = dist > 0 && eco > 0 && price > 0 ? Math.round((dist / eco) * price) : 0;
        const extras = cState.extras.map(normalizeExtraItem).filter(hasMeaningfulExtra).map(ex => ({
            ...ex,
            amountValue: getNumberValue(ex.amount)
        }));
        const splitExtras = extras.filter(ex => ex.type === 'split').reduce((sum, ex) => sum + ex.amountValue, 0);
        const clubExtras = extras.filter(ex => ex.type === 'club').reduce((sum, ex) => sum + ex.amountValue, 0);
        const split = gas + splitExtras;
        const rawPay = split + clubExtras + reward;
        const totalPay = roundUp(rawPay, 100);
        const driverRound = totalPay - rawPay;
        totalSplit += split;
        totalClub += clubExtras;
        totalReward += reward;
        totalDriverRound += driverRound;
        return { name: car.name, gas, extras, splitExtras, clubExtras, reward, rawPay, totalPay, driverRound };
    });

    const perPerson = payerCount > 0 ? roundUp(totalSplit / payerCount, rounding) : 0;
    const expectedCollected = perPerson * payerCount;
    const surplus = expectedCollected - totalSplit;
    const driverTotal = cars.reduce((sum, c) => sum + c.totalPay, 0);
    const accounting = driverTotal - expectedCollected;
    const paidCount = participants.filter(p => {
        if (state.organizerFree && organizerSelected && p.name === excludedName) return false;
        return !!state.paid?.[p.name];
    }).length;
    const unpaidCount = Math.max(0, payerCount - paidCount);

    return {
        participants,
        organizerSelected,
        excludedName,
        payerCount,
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
    if (state.organizerFree && participants.length > 0 && !state.organizerName) messages.push('企画者を選ぶと、集金対象を正確にできます。');
    if (result.payerCount <= 0 && participants.length > 0) messages.push('集金対象が0人です。企画者設定を確認してください。');

    (data.cars || []).forEach(car => {
        const cState = normalizeCarSettlementState(state.cars?.[car.name] || {});
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
        cState.extras.forEach((ex, i) => {
            const hasName = String(ex.name ?? '').trim();
            const hasAmount = String(ex.amount ?? '').trim();
            if (hasAmount && !hasName) {
                fields.add(`${car.name}:extra:${i}:name`);
                rows.add(car.name);
                messages.push(`${car.name}車の諸経費に名目が空の行があります。`);
            }
            if (hasName && !hasAmount) {
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

function renderSettlementIssues(issues) {
    const box = byId('seisan-errors');
    if (!box) return;
    if (!issues.messages.length) {
        box.style.display = 'none';
        box.innerHTML = '';
        return;
    }
    box.style.display = 'block';
    box.innerHTML = issues.messages.map(m => `・${escapeHtml(m)}`).join('<br>');
}

function renderExtraRowHtml(carName, ex, index, issues) {
    const type = ex.type === 'club' ? 'club' : 'split';
    return `<div class="seisan-extra-row" data-extra-index="${index}">
        <input type="text" data-extra-field="name" class="${extraFieldErrorClass(issues, carName, index, 'name')}" value="${escapeHtml(ex.name || '')}" placeholder="例：駐車場代">
        <input type="number" inputmode="numeric" data-extra-field="amount" class="${extraFieldErrorClass(issues, carName, index, 'amount')}" value="${escapeHtml(ex.amount || '')}" placeholder="金額">
        <select data-extra-field="type" class="seisan-extra-type ${type}">
            <option value="split" ${type === 'split' ? 'selected' : ''}>割勘</option>
            <option value="club" ${type === 'club' ? 'selected' : ''}>部費</option>
        </select>
        <button class="seisan-icon-btn" type="button" data-action="remove-settlement-extra" title="削除"><i class="fas fa-times"></i></button>
    </div>`;
}


function syncSettlementControls(state, participants) {
    const roundingEl = byId('seisanRounding');
    const organizerFreeEl = byId('seisanOrganizerFree');
    const organizerEl = byId('seisanOrganizerName');
    const rewardEl = byId('seisanDriverReward');
    if (roundingEl) roundingEl.value = state.rounding || '100';
    if (organizerFreeEl) organizerFreeEl.checked = state.organizerFree !== false;
    if (rewardEl) rewardEl.value = state.driverReward ?? '1000';
    if (organizerEl) {
        const current = state.organizerName || '';
        organizerEl.innerHTML = `<option value="">未選択</option>` + participants.map(p => `<option value="${escapeHtml(p.name)}">${escapeHtml(p.name)}</option>`).join('');
        organizerEl.value = participants.some(p => p.name === current) ? current : '';
        state.organizerName = organizerEl.value;
    }
}

function renderSettlementSummaryHtml(result) {
    const accountingLabel = result.accounting >= 0 ? '部費負担' : '部費へ戻す';
    const accountingSign = result.accounting >= 0 ? '＋' : '−';
    return `
        <div class="seisan-summary-card collect">
          <div class="seisan-summary-label"><i class="fas fa-users"></i>集める</div>
          <div class="seisan-summary-value">${yen(result.expectedCollected)}</div>
          <div class="seisan-summary-sub">${yen(result.perPerson)} × ${result.payerCount}名</div>
        </div>
        <div class="seisan-flow-arrow" aria-hidden="true">${accountingSign}</div>
        <div class="seisan-summary-card accounting">
          <div class="seisan-summary-label"><i class="fas fa-wallet"></i>部費</div>
          <div class="seisan-summary-value">${yen(Math.abs(result.accounting))}</div>
          <div class="seisan-summary-sub">${accountingLabel}</div>
        </div>
        <div class="seisan-flow-arrow" aria-hidden="true">＝</div>
        <div class="seisan-summary-card pay">
          <div class="seisan-summary-label"><i class="fas fa-car-side"></i>渡す</div>
          <div class="seisan-summary-value">${yen(result.driverTotal)}</div>
          <div class="seisan-summary-sub">車出し ${result.cars.length}名</div>
        </div>`;
}

function renderSettlementCarRowHtml(car, state, result, issues) {
    const cState = normalizeCarSettlementState(state.cars?.[car.name] || {});
    state.cars[car.name] = cState;
    const calc = result.cars.find(c => c.name === car.name) || { totalPay: 0, gas: 0, extras: [] };
    const extras = cState.extras.length ? cState.extras : [{ name: '', amount: '', type: 'split' }];
    const rowClass = issues.rows.has(car.name) ? ' has-error' : '';
    const details = `ガソリン代 ${yen(calc.gas || 0)} / 諸経費 ${yen((calc.splitExtras || 0) + (calc.clubExtras || 0))}`;
    return `<div class="seisan-car-row${rowClass}" data-driver-name="${escapeHtml(car.name)}">
        <div class="seisan-car-title"><strong>${escapeHtml(car.name)}車</strong><span class="seisan-car-total">渡す ${yen(calc.totalPay)}</span></div>
        <div class="seisan-small" style="margin-bottom:5px;">${details}</div>
        <div class="seisan-car-inputs">
          <label><span class="seisan-mini-label">移動距離（km）</span><input type="number" inputmode="decimal" data-field="dist" class="${fieldErrorClass(issues, car.name, 'dist')}" value="${escapeHtml(cState.dist || '')}"></label>
          <label><span class="seisan-mini-label">燃費（km/L）</span><input type="number" inputmode="decimal" data-field="eco" class="${fieldErrorClass(issues, car.name, 'eco')}" value="${escapeHtml(cState.eco || '')}"></label>
          <label><span class="seisan-mini-label">ガソリン単価（円/L）</span><input type="number" inputmode="decimal" data-field="price" class="${fieldErrorClass(issues, car.name, 'price')}" value="${escapeHtml(cState.price || '')}"></label>
        </div>
        <div class="seisan-subhead"><strong>諸経費</strong></div>
        <div class="seisan-extra-list">
          ${extras.map((ex, i) => renderExtraRowHtml(car.name, normalizeExtraItem(ex), i, issues)).join('')}
        </div>
        <div class="seisan-add-row">
          <button class="seisan-btn" type="button" data-action="add-settlement-extra" data-driver-name="${encodeURIComponent(car.name)}"><i class="fas fa-plus me-1"></i>諸経費を追加</button>
        </div>
    </div>`;
}

function renderSettlementCarsHtml(data, state, result, issues) {
    if (!data.cars.length) return `<div class="seisan-empty">先に車出しを登録してください。</div>`;
    return data.cars.map(car => renderSettlementCarRowHtml(car, state, result, issues)).join('');
}

function renderSettlementCollectionHtml(participants, state, result) {
    if (!participants.length) return `<div class="seisan-empty">名簿を登録すると表示されます。</div>`;
    return participants.map(p => {
        const excluded = state.organizerFree && result.organizerSelected && p.name === result.excludedName;
        const paid = !!state.paid?.[p.name];
        const note = excluded ? '対象外' : (p.role === 'driver' ? '車出し' : (p.role === 'waiting' ? '待機' : ''));
        return `<label class="seisan-check-item ${paid ? 'paid' : ''} ${excluded ? 'excluded' : ''}">
            <input type="checkbox" ${paid ? 'checked' : ''} ${excluded ? 'disabled' : ''} data-settlement-paid-name="${encodeURIComponent(p.name)}">
            <span class="seisan-check-name">${escapeHtml(p.name)}</span>
            ${note ? `<span class="seisan-check-note">${note}</span>` : ''}
        </label>`;
    }).join('');
}

function renderSettlementDriverPayHtml(result, state) {
    if (!result.cars.length) return `<div class="seisan-empty">車出しを登録すると表示されます。</div>`;
    return result.cars.map(car => {
        const done = !!state.driverPaid?.[car.name];
        const exText = car.extras.length ? car.extras.map(ex => `${escapeHtml(ex.name || '諸経費')} ${yen(ex.amountValue)}`).join(' / ') : '諸経費なし';
        return `<label class="seisan-driver-pay-row ${done ? 'done' : ''}">
            <span class="seisan-driver-name">${escapeHtml(car.name)}</span>
            <span class="seisan-driver-amount">${yen(car.totalPay)}</span>
            <input type="checkbox" ${done ? 'checked' : ''} data-settlement-driver-paid-name="${encodeURIComponent(car.name)}">
            <span class="seisan-driver-detail">ガソリン代 ${yen(car.gas)} / ${exText} / 協力代 ${yen(car.reward)}</span>
        </label>`;
    }).join('');
}

function renderSettlementBreakdownHtml(result) {
    return `
        <div class="seisan-break-row"><span>割勘対象</span><span>${yen(result.totalSplit)}</span></div>
        <div class="seisan-break-row"><span>集金予定</span><span>${yen(result.expectedCollected)}</span></div>
        <div class="seisan-break-row"><span>端数余り</span><span>${yen(result.surplus)}</span></div>
        <div class="seisan-break-row"><span>部費負担</span><span>${yen(result.totalClub)}</span></div>
        <div class="seisan-break-row"><span>車出し協力代</span><span>${yen(result.totalReward)}</span></div>
        <div class="seisan-break-row"><span>支払い丸め</span><span>${yen(result.totalDriverRound)}</span></div>`;
}

function toggleSettlementEmptyState(area, isEmpty) {
    if (!area) return;
    const wrap = area.querySelector('.seisan-wrap');
    let empty = byId('seisan-empty-state');
    if (!empty) {
        empty = document.createElement('div');
        empty.id = 'seisan-empty-state';
        empty.className = 'seisan-empty-state';
        empty.hidden = true;
        empty.innerHTML = `<div class="empty-card">
            <i class="fas fa-paste" aria-hidden="true"></i>
            <strong>まずは参加者登録から</strong>
            <span>企画の参加者と車出しを登録すると、ここに精算画面が表示されます。</span>
            <button class="seisan-btn primary" type="button" data-action="open-batch">参加者登録を開く</button>
        </div>`;
        if (wrap) area.insertBefore(empty, wrap);
        else area.appendChild(empty);
    }
    empty.hidden = !isEmpty;
    if (wrap) wrap.hidden = isEmpty;
}

function renderSettlementView() {
    if (isEditingSettlementCostField()) {
        settlementRenderDeferred = true;
        return;
    }
    const area = byId('seisan-view-area');
    if (!area) return;
    const state = ensureSettlementState();
    const data = getRoomDataOnly();
    const participants = getParticipantList(data);
    const hasParticipants = participants.length > 0;

    toggleSettlementEmptyState(area, !hasParticipants);
    if (!hasParticipants) {
        renderSettlementIssues({ messages: [], fields: new Set(), rows: new Set() });
        return;
    }

    syncSettlementControls(state, participants);

    const result = calculateSettlement(data, state);
    const issues = getSettlementIssues(data, state, result);
    renderSettlementIssues(issues);

    const summary = byId('seisan-summary');
    if (summary) summary.innerHTML = renderSettlementSummaryHtml(result);

    const carList = byId('seisan-car-list');
    if (carList) carList.innerHTML = renderSettlementCarsHtml(data, state, result, issues);

    const note = byId('seisan-collection-note');
    if (note) note.textContent = `1人あたり ${yen(result.perPerson)}・集金済み ${result.paidCount}/${result.payerCount}名・未回収 ${yen(result.unpaidAmount)}`;

    const collectionList = byId('seisan-collection-list');
    if (collectionList) collectionList.innerHTML = renderSettlementCollectionHtml(participants, state, result);

    const driverPayList = byId('seisan-driver-pay-list');
    if (driverPayList) driverPayList.innerHTML = renderSettlementDriverPayHtml(result, state);

    const shareNote = byId('seisan-share-note');
    if (shareNote) shareNote.textContent = `集金案内・支払いメモ・全体メモを用途別にコピーできます。未回収 ${yen(result.unpaidAmount)}`;

    const breakdown = byId('seisan-breakdown');
    if (breakdown) breakdown.innerHTML = renderSettlementBreakdownHtml(result);
}


const ROUTE_PRIVATE_ORIGIN_KEY = 'circle_route_private_origin_v1';

function getRoutePrivateOrigin() {
    try {
        return String(localStorage.getItem(ROUTE_PRIVATE_ORIGIN_KEY) || '').trim();
    } catch (e) {
        return '';
    }
}

function setRoutePrivateOrigin(value) {
    try {
        const normalized = String(value || '').trim();
        if (normalized) {
            localStorage.setItem(ROUTE_PRIVATE_ORIGIN_KEY, normalized);
        } else {
            safeLocalRemove(ROUTE_PRIVATE_ORIGIN_KEY);
        }
    } catch (e) {}
}

function renderRoutePrivateOrigin(editing = false) {
    const box = byId('routePrivateOriginBox');
    if (!box) return;
    const saved = getRoutePrivateOrigin();
    if (saved && !editing) {
        box.innerHTML = `<div class="route-private-view">
            <div class="route-private-saved"><i class="fas fa-lock"></i>出発地：保存済み（編集で確認・変更）</div>
            <button class="seisan-btn" type="button" data-action="edit-route-private-origin">編集</button>
            <button class="seisan-btn" type="button" data-action="clear-route-private-origin">削除</button>
        </div>`;
        return;
    }
    box.innerHTML = `<div class="route-private-edit">
        <input id="routePrivateOriginInput" class="route-private-input" type="text" value="${escapeHtml(saved)}" placeholder="例：イエローハイツ岡里 / 自宅" autocomplete="off">
        <button class="seisan-btn primary" type="button" data-action="save-route-private-origin">保存</button>
        <button class="seisan-btn" type="button" data-action="cancel-route-private-origin">戻る</button>
    </div>`;
}

window.editRoutePrivateOrigin = function() {
    renderRoutePrivateOrigin(true);
    const input = byId('routePrivateOriginInput');
    if (input) input.focus();
};

window.saveRoutePrivateOrigin = function() {
    const input = byId('routePrivateOriginInput');
    setRoutePrivateOrigin(input ? input.value : '');
    renderRoutePrivateOrigin(false);
    setRouteHelperStatus(getRoutePrivateOrigin() ? '自分用の出発地をこの端末に保存しました。' : '自分用の出発地を空にしました。');
};

window.clearRoutePrivateOrigin = function() {
    setRoutePrivateOrigin('');
    renderRoutePrivateOrigin(false);
    setRouteHelperStatus('自分用の出発地をこの端末から削除しました。');
};

window.cancelRoutePrivateOriginEdit = function() {
    renderRoutePrivateOrigin(false);
};

function getRouteCarNames() {
    return (getRoomDataOnly().cars || []).map(c => c.name).filter(Boolean);
}

function getSavedRouteStops() {
    const state = ensureSettlementState();
    return Array.isArray(state.routeStops) ? state.routeStops.map(v => String(v || '').trim()).filter(Boolean) : [];
}

function routeStopRowHtml(value = '', index = 0, total = 1) {
    return `<div class="route-stop-row">
        <span class="route-stop-num" title="ドラッグで並び替え">${index + 1}</span>
        <input type="text" class="route-stop-input" value="${escapeHtml(value || '')}" placeholder="例：妙高山 集合場所">
        <button class="seisan-icon-btn route-stop-delete-btn" type="button" data-action="remove-route-stop" title="削除"><i class="fas fa-times"></i></button>
    </div>`;
}

function refreshRouteStopNumbers() {
    const rows = Array.from(document.querySelectorAll('#routeStopList .route-stop-row'));
    rows.forEach((row, index) => {
        const num = row.querySelector('.route-stop-num');
        if (num) num.textContent = String(index + 1);
    });
}

function setRouteHelperStatus(message, isError = false) {
    const el = byId('routeHelperStatus');
    if (!el) return;
    el.textContent = message || '';
    el.style.color = isError ? '#ef4444' : 'var(--text-sub)';
}

function getRouteStops() {
    return Array.from(document.querySelectorAll('#routeStopList .route-stop-input'))
        .map(input => String(input.value || '').trim())
        .filter(Boolean);
}

function setRouteStops(stops) {
    const list = byId('routeStopList');
    if (!list) return;
    const normalized = Array.isArray(stops) && stops.length ? stops : [''];
    list.innerHTML = normalized.map((stop, index) => routeStopRowHtml(stop, index, normalized.length)).join('');
    refreshRouteStopNumbers();
    setupRouteStopSortable();
}

function saveRouteStopsFromModal() {
    const state = ensureSettlementState();
    state.routeStops = getRouteStops();
    save();
}

let routeStopSortable = null;
function setupRouteStopSortable() {
    const list = byId('routeStopList');
    if (!list || typeof Sortable === 'undefined') return;
    if (routeStopSortable) {
        try { routeStopSortable.destroy(); } catch (e) {}
        routeStopSortable = null;
    }
    routeStopSortable = new Sortable(list, {
        animation: 150,
        handle: '.route-stop-num',
        onEnd: () => {
            refreshRouteStopNumbers();
            saveRouteStopsFromModal();
        }
    });
}

let routeStopSaveTimer = null;
window.onRouteStopsChanged = function() {
    clearTimeout(routeStopSaveTimer);
    saveRouteStopsFromModal();
    refreshRouteStopNumbers();
};

window.onRouteStopsChangedDelayed = function() {
    clearTimeout(routeStopSaveTimer);
    routeStopSaveTimer = setTimeout(() => {
        saveRouteStopsFromModal();
        refreshRouteStopNumbers();
    }, 450);
};

window.openRouteDistanceHelper = function() {
    syncSettlementStateFromDOM();
    setRouteStops(getSavedRouteStops());
    renderRoutePrivateOrigin(false);
    setRouteHelperStatus('');
    if (modals.routeDistance) modals.routeDistance.show();
};

window.addRouteStop = function() {
    const list = byId('routeStopList');
    if (!list) return;
    const current = Array.from(list.querySelectorAll('.route-stop-input')).map(input => input.value);
    current.push('');
    setRouteStops(current);
    const input = list.querySelector('.route-stop-row:last-child .route-stop-input');
    if (input) input.focus();
    saveRouteStopsFromModal();
};

window.removeRouteStop = function(button) {
    const row = button.closest('.route-stop-row');
    if (row) row.remove();
    const list = byId('routeStopList');
    if (list && !list.querySelector('.route-stop-row')) setRouteStops(['']);
    refreshRouteStopNumbers();
    saveRouteStopsFromModal();
};


window.openGoogleRoute = function() {
    saveRouteStopsFromModal();
    const stops = getRouteStops();
    if (!stops.length) {
        setRouteHelperStatus('目的地・経由地を1つ以上入力してください。', true);
        return;
    }

    const privateOrigin = getRoutePrivateOrigin();
    const params = new URLSearchParams();
    params.set('api', '1');
    params.set('travelmode', 'driving');
    if (privateOrigin) {
        params.set('origin', privateOrigin);
        params.set('destination', privateOrigin);
        params.set('waypoints', stops.join('|'));
    } else if (stops.length === 1) {
        params.set('destination', stops[0]);
    } else {
        params.set('origin', stops[0]);
        params.set('destination', stops[stops.length - 1]);
        const waypoints = stops.slice(1, -1);
        if (waypoints.length) params.set('waypoints', waypoints.join('|'));
    }
    const url = `https://www.google.com/maps/dir/?${params.toString()}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    setRouteHelperStatus(privateOrigin ? '自分用の出発地を含めた往復ルートを開きました。' : 'Googleマップを開きました。必要なら出発地・帰着地を追加してください。');
};

window.onSettlementInput = function() {
    commitSettlementAfterKeyboardSettles();
};

window.onSettlementInputDelayed = function() {
    // 入力中に精算画面全体を再描画・クラウド同期すると、iPhoneなどで
    // フォーカスが外れてキーボードが閉じることがある。
    // 入力中はDOMから状態を拾ってローカル下書きだけ保存し、再描画と同期は
    // change / focusout の確定タイミングまで待つ。
    syncSettlementStateFromDOM();
    clearTimeout(settlementRenderTimer);
    settlementRenderTimer = setTimeout(() => {
        saveLocalDraftOnly();
    }, 450);
};

window.addSettlementExtra = function(encodedName) {
    syncSettlementStateFromDOM();
    const name = decodeURIComponent(encodedName);
    const state = ensureSettlementState();
    const car = normalizeCarSettlementState(state.cars[name] || {});
    car.extras.push({ name: '', amount: '', type: 'split' });
    state.cars[name] = car;
    renderSettlementView();
    save();
};

window.removeSettlementExtra = async function(button) {
    const row = button.closest('.seisan-extra-row');
    const carRow = button.closest('.seisan-car-row');
    if (!row || !carRow) return;

    const extraName = row.querySelector('[data-extra-field="name"]')?.value.trim() || '名称未入力';
    const amountRaw = row.querySelector('[data-extra-field="amount"]')?.value.trim();
    const amountNumber = Number(amountRaw || 0);
    const amountText = amountRaw ? `${amountNumber.toLocaleString('ja-JP')}円` : '金額未入力';
    const typeValue = row.querySelector('[data-extra-field="type"]')?.value === 'club' ? '部費' : '割勘';

    const message = `以下の諸経費を削除しますか？

名目：${extraName}
金額：${amountText}
扱い：${typeValue}

入力内容は元に戻せません。`;
    if (!await appConfirm(message, { title: '諸経費を削除', okText: '削除', danger: true })) return;

    row.remove();
    syncSettlementStateFromDOM();
    renderSettlementView();
    save();
};

window.toggleSettlementPaid = function(encodedName, checked) {
    const name = decodeURIComponent(encodedName);
    const state = ensureSettlementState();
    state.paid[name] = !!checked;
    renderSettlementView();
    save();
};

window.toggleSettlementDriverPaid = function(encodedName, checked) {
    const name = decodeURIComponent(encodedName);
    const state = ensureSettlementState();
    state.driverPaid[name] = !!checked;
    renderSettlementView();
    save();
};

function getSettlementTextContext() {
    syncSettlementStateFromDOM();
    const data = getRoomDataOnly();
    const state = ensureSettlementState();
    const result = calculateSettlement(data, state);
    return { data, state, result, title: (data.roomName || '企画名未設定').trim() };
}

function getSettlementUnpaidNames(result, state) {
    return result.participants.filter(p => {
        if (state.organizerFree && result.organizerSelected && p.name === result.excludedName) return false;
        return !state.paid?.[p.name];
    }).map(p => p.name);
}

function copyTextWithFallback(text, successMessage) {
    navigator.clipboard.writeText(text).then(() => {
        showAppNotice(successMessage || 'コピーしました');
    }).catch(() => {
        showCopyFallback('コピーしてください', text);
    });
}

function buildSettlementCollectionText({ title, state, result }) {
    const lines = [
        `【${title} 集金案内】`,
        `1人あたり：${yen(result.perPerson)}`,
        `対象：${result.payerCount}名`,
        `集金予定：${yen(result.expectedCollected)}`
    ];
    if (state.organizerFree && result.organizerSelected && result.excludedName) {
        lines.push(`対象外：${result.excludedName}`);
    }
    return lines.join('\n');
}

function buildSettlementDriverText({ title, state, result }) {
    const driverLines = result.cars.map(car => {
        const done = state.driverPaid?.[car.name] ? '（支払い済み）' : '';
        const detailParts = [
            `ガソリン ${yen(car.gas)}`,
            `諸経費 ${yen((car.splitExtras || 0) + (car.clubExtras || 0))}`,
            `協力代 ${yen(car.reward)}`
        ];
        return `・${car.name}車：${yen(car.totalPay)}${done}\n　${detailParts.join(' / ')}`;
    });
    return [`【${title} 支払いメモ】`, ...(driverLines.length ? driverLines : ['車出しなし'])].join('\n');
}

function buildSettlementOverviewText({ title, state, result }) {
    const accountingLine = result.accounting >= 0
        ? `部費から出す：${yen(result.accounting)}`
        : `部費へ戻す：${yen(Math.abs(result.accounting))}`;
    const unpaid = getSettlementUnpaidNames(result, state);
    const driverLines = result.cars.map(car => `・${car.name}車：${yen(car.totalPay)}${state.driverPaid?.[car.name] ? ' 済' : ''}`);
    return [
        `【${title} 精算メモ】`,
        `集める：${yen(result.expectedCollected)}（${yen(result.perPerson)} × ${result.payerCount}名）`,
        accountingLine,
        `渡す：${yen(result.driverTotal)}`,
        `集金：${result.paidCount}/${result.payerCount}名`,
        `未回収：${unpaid.length ? unpaid.join('、') : 'なし'}`,
        '',
        '車出しへ',
        ...(driverLines.length ? driverLines : ['なし'])
    ].join('\n');
}

window.copySettlementText = function(kind) {
    const ctx = getSettlementTextContext();
    const builders = {
        collection: buildSettlementCollectionText,
        driver: buildSettlementDriverText,
        overview: buildSettlementOverviewText
    };
    const labels = {
        collection: '集金案内をコピーしました',
        driver: '支払いメモをコピーしました',
        overview: '全体メモをコピーしました'
    };
    const builder = builders[kind] || builders.overview;
    copyTextWithFallback(builder(ctx), labels[kind] || labels.overview);
};

window.copyUrl = copyUrl;

const GUIDE_KEYS = { global: 'globalGuide', car: 'carGuide', seisan: 'seisanGuide' };
const currentGuideSteps = { global: 0, car: 0, seisan: 0 };

function guideCount(guide) {
    return document.querySelectorAll(`.guide-step-panel[data-guide="${guide}"]`).length || 1;
}

window.showGuideStep = function(guide, step) {
    if (typeof guide === 'number') {
        step = guide;
        guide = 'car';
    }
    guide = guide || 'car';
    const total = guideCount(guide);
    const safeStep = Math.max(0, Math.min(total - 1, Number(step) || 0));
    currentGuideSteps[guide] = safeStep;

    document.querySelectorAll(`.guide-step-panel[data-guide="${guide}"]`).forEach(p => {
        p.style.display = Number(p.dataset.panel) === safeStep ? '' : 'none';
    });
    document.querySelectorAll(`.guide-step-btn[data-guide="${guide}"]`).forEach(b => {
        b.classList.toggle('active', Number(b.dataset.step) === safeStep);
    });

    const prefix = GUIDE_KEYS[guide] || 'carGuide';
    const prevBtn = byId(`${prefix}PrevBtn`);
    const nextBtn = byId(`${prefix}NextBtn`);
    const closeBtn = byId(`${prefix}CloseBtn`);
    if (prevBtn) prevBtn.style.display = safeStep > 0 ? '' : 'none';
    const isLast = safeStep >= total - 1;
    if (nextBtn) nextBtn.style.display = isLast ? 'none' : '';
    if (closeBtn) closeBtn.style.display = isLast ? '' : 'none';
};

window.guideNavStep = function(guide, dir) {
    if (typeof guide === 'number') {
        dir = guide;
        guide = 'car';
    }
    guide = guide || 'car';
    const total = guideCount(guide);
    const current = currentGuideSteps[guide] || 0;
    const next = Math.max(0, Math.min(total - 1, current + dir));
    showGuideStep(guide, next);
};

document.addEventListener('DOMContentLoaded', () => {
    [
        ['globalGuideModal', 'global'],
        ['guideModal', 'car'],
        ['seisanGuideModal', 'seisan']
    ].forEach(([modalId, guide]) => {
        const el = byId(modalId);
        if (el) el.addEventListener('show.bs.modal', () => showGuideStep(guide, 0));
    });
});

window.openDebugModal = function() {
    if (!window.modals) return;
    if (!window.modals.debug) {
        const el = byId('debugModal');
        window.modals.debug = new bootstrap.Modal(el);
    }
    window.modals.debug.show();
};



let lastRemoteUpdatedAt = 0;
let isLocalEditing = false;
let remoteUpdateTimer = null;

function markLocalEditing() {
    isLocalEditing = true;
    clearTimeout(remoteUpdateTimer);
    remoteUpdateTimer = setTimeout(() => { isLocalEditing = false; }, 1800);
}

document.addEventListener('input', markLocalEditing, true);
document.addEventListener('change', markLocalEditing, true);

function shouldApplyRemoteData(remoteData) {
    if (!remoteData || typeof remoteData !== 'object') return false;
    const remoteUpdatedAt = Number(remoteData.updatedAt || 0);
    const localUpdatedAt = Number(window.__lastLocalUpdatedAt || 0);

    if (remoteUpdatedAt && remoteUpdatedAt < lastRemoteUpdatedAt) return false;
    if (isLocalEditing && remoteUpdatedAt && localUpdatedAt && remoteUpdatedAt < localUpdatedAt) {
        window.showSaveStatus?.('編集中のため同期保留');
        return false;
    }

    if (remoteUpdatedAt) lastRemoteUpdatedAt = remoteUpdatedAt;
    return true;
}

function setupStaticEventListeners() {
    const bind = (id, handler) => {
        const el = byId(id);
        if (!el || el.dataset.bound === 'true') return;
        el.dataset.bound = 'true';
        el.addEventListener('click', event => {
            event.preventDefault();
            handler(event);
        });
    };

    bind('globalGuideBtn', () => window.modals?.globalGuide?.show());
    bind('appearanceSettingsBtn', () => openAppearanceModal());
    bind('historyBtn', () => { if (canUseUnlockedMenuAction()) showHistory(); });
    bind('sampleDataBtn', () => { if (canUseUnlockedMenuAction()) openDebugModal(); });
    bind('resetDataBtn', () => { if (canUseUnlockedMenuAction()) window.resetData(); });
    bind('editLockBtn', () => toggleEditProtection());
    bind('shareLinkBtn', () => copyUrl());
    bind('fillEmptySeatsBtn', () => autoAssign('fill'));
    bind('shuffleAssignBtn', () => autoAssign('shuffle'));

    const trayHandle = byId('tray-handle');
    if (trayHandle && trayHandle.dataset.boundClick !== 'true') {
        trayHandle.dataset.boundClick = 'true';
        trayHandle.addEventListener('click', event => {
            event.preventDefault();
            toggleTray();
        });
    }
}

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

// Header illustration removed.

document.addEventListener('DOMContentLoaded', setupStaticEventListeners);



function setupGeneratedHtmlEventDelegation() {
    if (document.documentElement.dataset.generatedEventsBound === 'true') return;
    document.documentElement.dataset.generatedEventsBound = 'true';

    document.addEventListener('click', event => {
        const actionTarget = event.target.closest?.('[data-action]');
        if (!actionTarget) return;
        const action = actionTarget.dataset.action;

        if (action === 'edit-capacity') {
            event.preventDefault();
            window.editCapacity?.(actionTarget);
            return;
        }

        if (action === 'open-batch') {
            event.preventDefault();
            openBatchModal();
            return;
        }

        if (action === 'open-batch-from-sheet') {
            event.preventDefault();
            switchView('list');
            openBatchModal();
            return;
        }

        if (action === 'switch-list') {
            event.preventDefault();
            switchView('list');
            return;
        }

        if (action === 'add-settlement-extra') {
            event.preventDefault();
            window.addSettlementExtra?.(actionTarget.dataset.driverName || '');
            return;
        }

        if (action === 'remove-settlement-extra') {
            event.preventDefault();
            window.removeSettlementExtra?.(actionTarget);
            return;
        }

        if (action === 'copy-settlement-collection') {
            event.preventDefault();
            window.copySettlementText?.('collection');
            return;
        }

        if (action === 'copy-settlement-driver') {
            event.preventDefault();
            window.copySettlementText?.('driver');
            return;
        }

        if (action === 'copy-settlement-overview') {
            event.preventDefault();
            window.copySettlementText?.('overview');
            return;
        }

        if (action === 'edit-route-private-origin') {
            event.preventDefault();
            window.editRoutePrivateOrigin?.();
            return;
        }

        if (action === 'clear-route-private-origin') {
            event.preventDefault();
            window.clearRoutePrivateOrigin?.();
            return;
        }

        if (action === 'save-route-private-origin') {
            event.preventDefault();
            window.saveRoutePrivateOrigin?.();
            return;
        }

        if (action === 'cancel-route-private-origin') {
            event.preventDefault();
            window.cancelRoutePrivateOriginEdit?.();
            return;
        }

        if (action === 'remove-route-stop') {
            event.preventDefault();
            window.removeRouteStop?.(actionTarget);
        }
    });

    document.addEventListener('input', event => {
        const target = event.target;
        if (target?.matches?.('#seisan-car-list [data-field], #seisan-car-list [data-extra-field]')) {
            window.onSettlementInputDelayed?.();
            return;
        }
        if (target?.matches?.('#routeStopList .route-stop-input')) {
            window.onRouteStopsChangedDelayed?.();
        }
    });

    document.addEventListener('focusout', event => {
        const target = event.target;
        if (isSettlementCostField(target)) {
            window.onSettlementInput?.();
        }
    });

    document.addEventListener('change', event => {
        const target = event.target;
        if (!target?.matches) return;

        if (target.matches('#seisan-car-list [data-field], #seisan-car-list [data-extra-field]')) {
            window.onSettlementInput?.();
            return;
        }

        if (target.matches('[data-settlement-paid-name]')) {
            window.toggleSettlementPaid?.(target.dataset.settlementPaidName || '', target.checked);
            return;
        }

        if (target.matches('[data-settlement-driver-paid-name]')) {
            window.toggleSettlementDriverPaid?.(target.dataset.settlementDriverPaidName || '', target.checked);
            return;
        }

        if (target.matches('#routeStopList .route-stop-input')) {
            window.onRouteStopsChanged?.();
        }
    });
}

function setupRefactorEventListeners() {
    setupAppearanceFooterSafety();
    setupGeneratedHtmlEventDelegation();
    const bind = (id, handler, eventName = 'click') => {
        const el = byId(id);
        if (!el || el.dataset.refactorBound === 'true') return;
        el.dataset.refactorBound = 'true';
        el.addEventListener(eventName, event => {
            if (eventName === 'click') event.preventDefault();
            handler(event);
        });
    };

    bind('tab-list', () => switchView('list'));
    bind('tab-sheet', () => switchView('sheet'));
    bind('tab-seisan', () => switchView('seisan'));
    bind('carGuideBtn', () => window.modals?.guide?.show());
    bind('batchOpenBtn', () => openBatchModal());
    bind('sheetZoomInBtn', () => zoomIn());
    bind('sheetZoomOutBtn', () => zoomOut());
    bind('sheetZoomResetBtn', () => resetZoom());
    bind('sheet-quick-edit-btn', () => toggleQuickEdit());
    bind('seisanGuideBtn', () => window.modals?.seisanGuide?.show());
    bind('seisanRefreshBtn', () => renderSettlementView());
    bind('routeHelperBtn', () => openRouteDistanceHelper());
    bind('clearAllBtn', () => window.clearAll());
    bind('resetAppearanceBtn', () => resetAppearanceSettings());
    bind('executeBatchBtn', () => executeBatch());
    bind('executeDebugBtn', () => executeDebugMode());
    bind('executeDebugMissingBtn', () => executeDebugMissingCostMode());
    bind('addRouteStopBtn', () => window.addRouteStop?.());
    bind('openGoogleRouteBtn', () => window.openGoogleRoute?.());

    ['seisanRounding', 'seisanOrganizerName', 'seisanOrganizerFree'].forEach(id => {
        const el = byId(id);
        if (el && el.dataset.refactorBound !== 'true') {
            el.dataset.refactorBound = 'true';
            el.addEventListener('change', () => window.onSettlementInput?.());
        }
    });

    const reward = byId('seisanDriverReward');
    if (reward && reward.dataset.refactorBound !== 'true') {
        reward.dataset.refactorBound = 'true';
        reward.addEventListener('input', () => window.onSettlementInputDelayed?.());
        reward.addEventListener('change', () => window.onSettlementInput?.());
    }

    ['optFemale', 'optMale', 'optGrade'].forEach(id => {
        const el = byId(id);
        if (el && el.dataset.refactorBound !== 'true') {
            el.dataset.refactorBound = 'true';
            el.addEventListener('change', () => updateAutoAssignSummary());
        }
    });

    document.querySelectorAll('.guide-step-btn[data-guide][data-step]').forEach(btn => {
        if (btn.dataset.refactorBound === 'true') return;
        btn.dataset.refactorBound = 'true';
        btn.addEventListener('click', event => {
            event.preventDefault();
            showGuideStep(btn.dataset.guide, Number(btn.dataset.step || 0));
        });
    });

    [
        ['globalGuidePrevBtn', 'global', -1],
        ['globalGuideNextBtn', 'global', 1],
        ['carGuidePrevBtn', 'car', -1],
        ['carGuideNextBtn', 'car', 1],
        ['seisanGuidePrevBtn', 'seisan', -1],
        ['seisanGuideNextBtn', 'seisan', 1],
    ].forEach(([id, guide, dir]) => bind(id, () => guideNavStep(guide, dir)));
}

document.addEventListener('DOMContentLoaded', setupRefactorEventListeners);
