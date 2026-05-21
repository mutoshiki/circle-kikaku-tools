// Settlement typing/change events. Kept separate so keyboard-focus protection is easy to audit.
(function (global) {
    'use strict';

    const events = global.SanpoEvents || {};

    function setupSettlementInputEvents() {
        if (document.documentElement.dataset.settlementInputEventsBound === 'true') return;
        document.documentElement.dataset.settlementInputEventsBound = 'true';

        document.addEventListener('focusin', event => {
            if (isSettlementCostField(event.target)) protectSettlementEditing();
        });
        document.addEventListener('compositionstart', event => {
            if (isSettlementCostField(event.target)) { settlementCompositionActive = true; protectSettlementEditing(); }
        });
        document.addEventListener('compositionend', event => {
            if (isSettlementCostField(event.target)) { settlementCompositionActive = false; global.onSettlementInputDelayed?.(); releaseSettlementEditingSoon(320); }
        });
        document.addEventListener('input', event => {
            const target = event.target;
            if (target?.matches?.('.seisan-car-row [data-field], .seisan-car-row [data-extra-field]')) { global.onSettlementInputDelayed?.(); return; }
            if (target?.matches?.('#seisanStandaloneDriverCount, #seisanStandaloneMemberCount')) { syncSettlementStateFromDOM?.(); global.renderSeisanView?.(); return; }
            if (target?.matches?.('#routeStopList .route-stop-input')) global.onRouteStopsChangedDelayed?.();
        });
        document.addEventListener('focusout', event => {
            const target = event.target;
            if (isSettlementCostField(target)) { releaseSettlementEditingSoon(320); global.onSettlementInput?.(); }
        });
        document.addEventListener('change', event => {
            const target = event.target;
            if (!target?.matches) return;
            if (target.matches('.seisan-car-row [data-field], .seisan-car-row [data-extra-field]')) { global.onSettlementInput?.(); return; }
            if (target.matches('#seisanStandaloneEnabled, #seisanStandaloneDriverCount, #seisanStandaloneMemberCount')) { syncSettlementStateFromDOM?.(); global.renderSeisanView?.(); return; }
            if (target.matches('[data-settlement-paid-name]')) { global.toggleSettlementPaid?.(target.dataset.settlementPaidName || '', target.checked); return; }
            if (target.matches('[data-settlement-driver-paid-name]')) { global.toggleSettlementDriverPaid?.(target.dataset.settlementDriverPaidName || '', target.checked); return; }
            if (target.matches('#routeStopList .route-stop-input')) global.onRouteStopsChanged?.();
        });
    }

    global.SanpoEvents = Object.freeze({ ...events, setupSettlementInputEvents });
})(window);

(function (global) {
    'use strict';
    const $id = id => document.getElementById(id);
    const count = v => { const n = Math.floor(Number(String(v ?? '').trim())); return Number.isFinite(n) && n > 0 ? Math.min(n, 99) : 0; };
    function state() {
        const s = global.ensureSettlementState?.() || (global.settlementState ||= {});
        s.standalone ||= { enabled: false, driverCount: '', memberCount: '' };
        return s;
    }
    function ui() {
        if (!$id('standaloneSettlementStyle')) {
            const st = document.createElement('style');
            st.id = 'standaloneSettlementStyle';
            st.textContent = '#seisan-view-area .seisan-empty-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:10px}#settlementSettingsModal .seisan-standalone-fields{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:10px;border:1px solid var(--border-color);border-radius:12px;background:var(--bg-card)}#settlementSettingsModal .seisan-standalone-fields[hidden]{display:none}.seisan-standalone-note{grid-column:1/-1;font-size:11px;color:var(--text-sub)}#seisan-view-area .seisan-summary-pills .is-standalone{border-color:var(--accent-color);background:var(--accent-soft)}';
            document.head.appendChild(st);
        }
        const modal = $id('settlementSettingsModal');
        if (modal && !$id('seisanStandaloneEnabled')) {
            const box = document.createElement('div');
            box.innerHTML = '<label class="seisan-toggle seisan-toggle--modal seisan-standalone-toggle"><span>人数だけで精算する</span><input id="seisanStandaloneEnabled" type="checkbox"></label><div id="seisanStandaloneFields" class="seisan-standalone-fields" hidden><div class="seisan-field"><label>車出し人数</label><input id="seisanStandaloneDriverCount" type="number" min="0" max="99" inputmode="numeric" placeholder="例：3"></div><div class="seisan-field"><label>それ以外の人数</label><input id="seisanStandaloneMemberCount" type="number" min="0" max="99" inputmode="numeric" placeholder="例：8"></div><div class="seisan-standalone-note">名簿なしで概算精算します。費用は「車出し1」「車出し2」…として入力します。</div></div>';
            const anchor = $id('seisanDriverReward')?.closest('.seisan-field');
            [...box.childNodes].forEach(n => anchor ? anchor.after(n) : modal.querySelector('.modal-body')?.append(n));
        }
        const s = state().standalone;
        if ($id('seisanStandaloneEnabled')) $id('seisanStandaloneEnabled').checked = !!s.enabled;
        if ($id('seisanStandaloneDriverCount')) $id('seisanStandaloneDriverCount').value = s.driverCount || '';
        if ($id('seisanStandaloneMemberCount')) $id('seisanStandaloneMemberCount').value = s.memberCount || '';
        if ($id('seisanStandaloneFields')) $id('seisanStandaloneFields').hidden = !s.enabled;
    }
    function read() {
        ui();
        const s = state();
        s.standalone = {
            enabled: !!$id('seisanStandaloneEnabled')?.checked,
            driverCount: String(count($id('seisanStandaloneDriverCount')?.value || s.standalone.driverCount || '') || ''),
            memberCount: String(count($id('seisanStandaloneMemberCount')?.value || s.standalone.memberCount || '') || '')
        };
        ui();
        return s;
    }
    function data() {
        const s = read().standalone;
        const d = count(s.driverCount), m = count(s.memberCount);
        const members = Array.from({ length: m }, (_, i) => ({ name: `参加者${i + 1}` }));
        const cars = Array.from({ length: d }, (_, i) => ({ name: `車出し${i + 1}`, members: [] }));
        if (d) members.forEach((p, i) => cars[i % d].members.push(p));
        return { roomName: $id('roomNameInput')?.value || '', settlementPlanName: '精算だけ', isStandaloneSettlement: true, standaloneCounts: { driverCount: d, memberCount: m }, waiting: d ? [] : members, cars };
    }
    function active() { const s = read().standalone; return s.enabled && (count(s.driverCount) || count(s.memberCount)); }
    const oldData = global.getRoomDataOnly;
    if (typeof oldData === 'function' && !oldData.__standalone) {
        global.getRoomDataOnly = function () { return active() ? data() : oldData.apply(this, arguments); };
        global.getRoomDataOnly.__standalone = true;
    }
    const oldSync = global.syncSettlementStateFromDOM;
    if (typeof oldSync === 'function' && !oldSync.__standalone) {
        global.syncSettlementStateFromDOM = function () { const r = oldSync.apply(this, arguments); read(); return r; };
        global.syncSettlementStateFromDOM.__standalone = true;
    }
    const oldControls = global.syncSettlementControls;
    if (typeof oldControls === 'function' && !oldControls.__standalone) {
        global.syncSettlementControls = function () { const r = oldControls.apply(this, arguments); ui(); return r; };
        global.syncSettlementControls.__standalone = true;
    }
    const oldSummary = global.SanpoApp?.templates?.settlement?.summary;
    if (oldSummary && !oldSummary.__standalone) {
        global.SanpoApp.templates.settlement.summary = function (result) {
            let html = oldSummary.apply(this, arguments);
            if (result?.isStandaloneSettlement) {
                const c = result.standaloneCounts || {};
                html = html.replace('aria-label="現在の精算設定">', `aria-label="現在の精算設定"><span class="is-standalone"><small>入力方法</small>精算だけ</span><span><small>人数</small>車出し${c.driverCount || 0}名＋その他${c.memberCount || 0}名</span>`).replace('<span class="is-attention"><small>企画者</small>未選択</span>', '<span><small>企画者</small>なし</span>');
            }
            return html;
        };
        global.SanpoApp.templates.settlement.summary.__standalone = true;
    }
    function emptyBtn() {
        ui();
        const empty = document.querySelector('#seisan-view-area .empty-card');
        if (!empty || empty.querySelector('[data-action="open-settlement-settings"]')) return;
        const b = document.createElement('button');
        b.className = 'seisan-btn primary'; b.type = 'button'; b.dataset.action = 'open-settlement-settings'; b.textContent = '人数だけで精算';
        const actions = document.createElement('div'); actions.className = 'seisan-empty-actions'; actions.appendChild(b);
        const old = empty.querySelector('[data-action="open-batch"]');
        if (old) { old.classList.remove('primary'); old.replaceWith(actions); actions.appendChild(old); } else empty.appendChild(actions);
    }
    const oldRender = global.renderSeisanView;
    if (typeof oldRender === 'function' && !oldRender.__standalone) {
        global.renderSeisanView = function () { const r = oldRender.apply(this, arguments); emptyBtn(); return r; };
        global.renderSeisanView.__standalone = true;
    }
    document.addEventListener('DOMContentLoaded', emptyBtn);
    setTimeout(emptyBtn, 0);
})(window);
