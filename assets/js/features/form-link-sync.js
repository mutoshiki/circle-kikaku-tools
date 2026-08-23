// Automatic Google Form response linking.
// The form maker creates a response spreadsheet and mirrors only planning-safe fields
// into a capability-addressed Firebase source room. This feature links that source to
// the current planning room and imports new responses additively.

(() => {
    const SOURCE_ROOM_PREFIX = 'FORM_';
    const SOURCE_KIND = 'formImportSource';
    const IMPORT_SCHEMA_VERSION = 1;
    const LINK_POLL_MS = 1500;
    const SPREADSHEET_ID_RE = /^[A-Za-z0-9_-]{20,70}$/;

    let activeSourceRoomId = '';
    let activeUnsubscribe = null;
    let syncInFlight = false;
    let pendingSourceSnapshot = null;
    let lastRenderedLinkKey = '';

    function sourceRoomIdForSpreadsheet(spreadsheetId) {
        return `${SOURCE_ROOM_PREFIX}${spreadsheetId}`;
    }

    function parseSpreadsheetId(value) {
        const text = String(value || '').trim();
        const urlMatch = text.match(/\/spreadsheets\/d\/([A-Za-z0-9_-]{20,70})(?:[\/#?]|$)/i);
        if (urlMatch) return urlMatch[1];
        if (SPREADSHEET_ID_RE.test(text)) return text;
        return '';
    }

    function looksLikeGoogleFormUrl(value) {
        const text = String(value || '').trim();
        return /docs\.google\.com\/forms\//i.test(text) || /forms\.gle\//i.test(text);
    }

    function currentCanonical() {
        return window.SanpoCanonicalState?.get?.() || null;
    }

    function currentLink() {
        const link = currentCanonical()?.meta?.formImport;
        if (!link || Number(link.importSchemaVersion || 0) !== IMPORT_SCHEMA_VERSION) return null;
        const spreadsheetId = String(link.spreadsheetId || '');
        if (!SPREADSHEET_ID_RE.test(spreadsheetId)) return null;
        return link;
    }

    function importUi() {
        return {
            root: byId('formAutoLinkPanel'),
            input: byId('formAutoLinkUrl'),
            linkButton: byId('formAutoLinkBtn'),
            syncButton: byId('formAutoSyncNowBtn'),
            unlinkButton: byId('formAutoUnlinkBtn'),
            status: byId('formAutoLinkStatus')
        };
    }

    function setStatus(message, tone = 'neutral') {
        const status = byId('formAutoLinkStatus');
        if (!status) return;
        status.textContent = String(message || '');
        status.dataset.tone = tone;
    }

    function setBusy(busy) {
        const ui = importUi();
        [ui.linkButton, ui.syncButton, ui.unlinkButton].forEach(button => {
            if (!button) return;
            button.disabled = Boolean(busy);
            if (busy) button.setAttribute('disabled', '');
            else button.removeAttribute('disabled');
        });
    }

    function ensureUi() {
        if (byId('formAutoLinkPanel')) return true;
        const helper = document.querySelector('#batchImportModal .batch-import-helper-card');
        if (!helper) return false;

        const panel = document.createElement('div');
        panel.id = 'formAutoLinkPanel';
        panel.className = 'form-auto-link';
        panel.innerHTML = `
            <div class="form-auto-link__heading">
                <span data-carbon-icon="link" aria-hidden="true"></span>
                フォームメーカーと自動連携
            </div>
            <p class="form-auto-link__description">
                フォームメーカーが自動作成した回答スプレッドシートのURLを一度貼ると、以後の回答から氏名・学年・車出し情報をこの企画へ自動追加します。応募フォームのURLではなく回答スプレッドシートのURLを使用してください。
            </p>
            <cds-text-input
                id="formAutoLinkUrl"
                label="回答スプレッドシートURL"
                placeholder="https://docs.google.com/spreadsheets/d/..."
                type="url">
            </cds-text-input>
            <div class="form-auto-link__actions">
                <cds-button id="formAutoLinkBtn" kind="primary" size="md" type="button">この企画と連携</cds-button>
                <cds-button id="formAutoSyncNowBtn" kind="secondary" size="md" type="button" hidden>今すぐ同期</cds-button>
                <cds-button id="formAutoUnlinkBtn" kind="ghost" size="md" type="button" hidden>連携解除</cds-button>
            </div>
            <p id="formAutoLinkStatus" class="form-auto-link__status" aria-live="polite"></p>
        `;
        helper.insertBefore(panel, helper.firstChild);

        byId('formAutoLinkBtn')?.addEventListener('click', linkFromInput);
        byId('formAutoSyncNowBtn')?.addEventListener('click', syncNow);
        byId('formAutoUnlinkBtn')?.addEventListener('click', unlinkCurrentForm);
        renderLinkUi(true);
        return true;
    }

    function renderLinkUi(force = false) {
        if (!ensureUi()) return;
        const link = currentLink();
        const key = link
            ? `${link.spreadsheetId}:${Number(link.lastResponseCount || 0)}:${Number(link.lastSyncedAt || 0)}`
            : 'none';
        if (!force && key === lastRenderedLinkKey) return;
        lastRenderedLinkKey = key;

        const ui = importUi();
        const linked = Boolean(link);
        if (ui.input) {
            ui.input.readOnly = linked;
            if (linked) ui.input.setAttribute('readonly', '');
            else ui.input.removeAttribute('readonly');
            if (linked && !String(ui.input.value || '').trim()) {
                ui.input.value = `https://docs.google.com/spreadsheets/d/${link.spreadsheetId}/edit`;
            }
            if (!linked && ui.input.readOnly) ui.input.readOnly = false;
        }
        if (ui.linkButton) ui.linkButton.hidden = linked;
        if (ui.syncButton) ui.syncButton.hidden = !linked;
        if (ui.unlinkButton) ui.unlinkButton.hidden = !linked;

        if (!linked) {
            setStatus('未連携です。回答スプレッドシートURLは後から一度だけ設定すれば大丈夫です。');
            return;
        }
        const responseCount = Math.max(0, Number(link.lastResponseCount || 0));
        const importedCount = Object.keys(link.importedResponses || {}).length;
        setStatus(`連携中です。フォーム回答 ${responseCount}件 / 取り込み済み ${importedCount}件`, 'success');
    }

    async function waitForFirebaseReady(timeoutMs = 12000) {
        const started = Date.now();
        while (Date.now() - started < timeoutMs) {
            if (firebaseReady && db && ref && get && onValue) return true;
            await new Promise(resolve => setTimeout(resolve, 120));
        }
        return false;
    }

    function validateSourceRoom(source, spreadsheetId) {
        if (!source || Number(source.schemaVersion) !== 6) return false;
        if (source.meta?.kind !== SOURCE_KIND) return false;
        if (Number(source.meta?.importSchemaVersion || 0) !== IMPORT_SCHEMA_VERSION) return false;
        return String(source.meta?.spreadsheetId || '') === spreadsheetId;
    }

    async function linkFromInput() {
        const input = byId('formAutoLinkUrl');
        const raw = String(input?.value || '').trim();
        if (looksLikeGoogleFormUrl(raw)) {
            setStatus('応募フォームのURLでは連携できません。フォームメーカーが作成した「回答スプレッドシート」のURLを貼ってください。', 'error');
            return;
        }
        const spreadsheetId = parseSpreadsheetId(raw);
        if (!spreadsheetId) {
            setStatus('回答スプレッドシートURLを確認してください。GoogleスプレッドシートのURLをそのまま貼れます。', 'error');
            return;
        }
        if (!await waitForFirebaseReady()) {
            setStatus('同期サービスに接続できませんでした。通信状態を確認してもう一度お試しください。', 'error');
            return;
        }

        setBusy(true);
        setStatus('回答スプレッドシートを確認しています…');
        try {
            const sourceRoomId = sourceRoomIdForSpreadsheet(spreadsheetId);
            const snapshot = await get(ref(db, `rooms/${sourceRoomId}`));
            const source = snapshot.val();
            if (!validateSourceRoom(source, spreadsheetId)) {
                setStatus('この回答スプレッドシートはまだ自動連携の準備ができていません。フォームメーカーで作成した回答スプレッドシートか確認してください。', 'error');
                return;
            }

            const canonical = currentCanonical();
            if (!canonical) throw new Error('企画データを取得できませんでした。');
            canonical.meta = canonical.meta || {};
            canonical.meta.formImport = {
                importSchemaVersion: IMPORT_SCHEMA_VERSION,
                spreadsheetId,
                sourceRoomId,
                linkedAt: window.SanpoClock?.now?.() ?? Date.now(),
                lastSyncedAt: 0,
                lastResponseCount: 0,
                importedResponses: {}
            };
            persistCanonicalImport(canonical);
            renderLinkUi(true);
            subscribeToCurrentLink(true);
            await importSourceSnapshot(source, { forceStatus: true });
        } catch (error) {
            console.error('Form auto-link failed:', error);
            setStatus(error?.message || '自動連携に失敗しました。', 'error');
        } finally {
            setBusy(false);
        }
    }

    function makeDriverGroupId(participantId) {
        return `g_car_${String(participantId || '').replace(/[^A-Za-z0-9_-]/g, '_')}`;
    }

    function ensureDriver(canonical, participantId, sourceParticipant, now) {
        if (!sourceParticipant?.canDrive || !participantId) return false;
        const allocation = canonical.allocations?.car;
        if (!allocation) return false;
        allocation.groups = allocation.groups || {};
        allocation.placements = allocation.placements || {};

        const existingOwned = Object.entries(allocation.groups)
            .find(([, group]) => group?.ownerId === participantId);
        const groupId = existingOwned?.[0] || makeDriverGroupId(participantId);
        const existingGroup = existingOwned?.[1] || allocation.groups[groupId];
        const capacity = Math.max(1, Math.min(20, parseInt(sourceParticipant.capacity, 10) || 3));

        if (existingGroup) {
            // Respect organizer changes after the initial import. Only fill capacity from
            // the form while the group is still at its default/imported value.
            allocation.groups[groupId] = {
                ...existingGroup,
                ownerId: participantId,
                capacity: Number(existingGroup.capacity) > 0 ? Number(existingGroup.capacity) : capacity,
                updatedAt: Math.max(Number(existingGroup.updatedAt || 0), now)
            };
        } else {
            allocation.groups[groupId] = {
                id: groupId,
                ownerId: participantId,
                capacity,
                order: Object.keys(allocation.groups).length,
                createdAt: now,
                updatedAt: now
            };
        }
        const previousPlacement = allocation.placements[participantId];
        allocation.placements[participantId] = {
            kind: 'driver',
            groupId,
            order: Number(allocation.groups[groupId].order || 0),
            updatedAt: Math.max(Number(previousPlacement?.updatedAt || 0), now)
        };
        allocation.updatedAt = now;
        return true;
    }

    function persistCanonicalImport(canonical) {
        carPlans = window.SanpoCanonicalState.projectPlans(canonical);
        const previousSuspend = Boolean(window.__suspendActiveDomPlanSync);
        window.__suspendActiveDomPlanSync = true;
        try {
            save();
        } finally {
            window.__suspendActiveDomPlanSync = previousSuspend;
        }
        queueMicrotask(() => {
            renderActiveCarPlanToDom();
            updateUI();
            renderLinkUi(true);
        });
    }

    async function importSourceSnapshot(source, options = {}) {
        if (syncInFlight) {
            pendingSourceSnapshot = source;
            return;
        }
        syncInFlight = true;
        try {
            const link = currentLink();
            if (!link || !validateSourceRoom(source, link.spreadsheetId)) return;
            const canonical = currentCanonical();
            if (!canonical) return;
            canonical.meta = canonical.meta || {};
            canonical.meta.formImport = canonical.meta.formImport || link;
            const importMeta = canonical.meta.formImport;
            importMeta.importedResponses = importMeta.importedResponses || {};
            const participants = canonical.participants || (canonical.participants = {});
            const now = window.SanpoClock?.now?.() ?? Date.now();
            const newParticipantIds = [];
            let imported = 0;
            let changed = false;

            Object.entries(source.participants || {}).forEach(([responseKey, sourceParticipant]) => {
                if (!sourceParticipant?.name || importMeta.importedResponses[responseKey]) return;
                let participantId = window.SanpoCanonicalState.findParticipantIdByName(participants, sourceParticipant.name);
                if (!participantId) {
                    participantId = window.SanpoCanonicalState.ensureParticipant(
                        participants,
                        {
                            name: sourceParticipant.name,
                            memo: '',
                            gender: 'unknown',
                            grade: Math.max(0, Math.min(4, parseInt(sourceParticipant.grade, 10) || 0)),
                            locked: false,
                            flag: 'none'
                        },
                        '',
                        canonical.participantTombstones || {}
                    );
                    if (participantId) newParticipantIds.push(participantId);
                } else if (!Number(participants[participantId]?.grade) && Number(sourceParticipant.grade) >= 1 && Number(sourceParticipant.grade) <= 4) {
                    participants[participantId].grade = Number(sourceParticipant.grade);
                    participants[participantId].updatedAt = now;
                }
                if (!participantId) return;

                ensureDriver(canonical, participantId, sourceParticipant, now);
                importMeta.importedResponses[responseKey] = {
                    participantId,
                    importedAt: now
                };
                imported += 1;
                changed = true;
            });

            window.SanpoCanonicalState.ensureAllParticipantsPlaced(canonical.allocations?.car, participants);
            window.SanpoCanonicalState.ensureAllParticipantsPlaced(canonical.allocations?.team, participants);

            const nextResponseCount = Math.max(0, Number(source.meta?.responseCount || Object.keys(source.participants || {}).length));
            if (Number(importMeta.lastResponseCount || 0) !== nextResponseCount) changed = true;
            if (Number(importMeta.sourceSyncedAt || 0) !== Number(source.meta?.syncedAt || 0)) changed = true;
            importMeta.lastResponseCount = nextResponseCount;
            importMeta.sourceSyncedAt = Number(source.meta?.syncedAt || 0);
            importMeta.lastSyncedAt = now;

            if (changed) persistCanonicalImport(canonical);
            newParticipantIds.forEach(id => {
                const name = canonical.participants?.[id]?.name;
                if (name) detectGender(name);
            });

            if (imported > 0) {
                setStatus(`${imported}件の新しい回答を追加しました。フォーム回答は合計 ${nextResponseCount}件です。`, 'success');
            } else if (options.forceStatus) {
                setStatus(`同期しました。フォーム回答 ${nextResponseCount}件はすべて取り込み済みです。`, 'success');
            } else {
                renderLinkUi(true);
            }
        } catch (error) {
            console.error('Automatic form response import failed:', error);
            setStatus('フォーム回答の自動取り込みに失敗しました。通信状態を確認してください。', 'error');
        } finally {
            syncInFlight = false;
            if (pendingSourceSnapshot) {
                const pending = pendingSourceSnapshot;
                pendingSourceSnapshot = null;
                queueMicrotask(() => importSourceSnapshot(pending));
            }
        }
    }

    function stopSourceSubscription() {
        if (typeof activeUnsubscribe === 'function') {
            try { activeUnsubscribe(); } catch (error) { console.warn(error); }
        }
        activeUnsubscribe = null;
        activeSourceRoomId = '';
    }

    async function subscribeToCurrentLink(force = false) {
        const link = currentLink();
        if (!link) {
            stopSourceSubscription();
            renderLinkUi();
            return;
        }
        if (!await waitForFirebaseReady()) return;
        const sourceRoomId = sourceRoomIdForSpreadsheet(link.spreadsheetId);
        if (!force && sourceRoomId === activeSourceRoomId && activeUnsubscribe) return;

        stopSourceSubscription();
        activeSourceRoomId = sourceRoomId;
        activeUnsubscribe = onValue(
            ref(db, `rooms/${sourceRoomId}`),
            snapshot => {
                const source = snapshot.val();
                if (!validateSourceRoom(source, link.spreadsheetId)) {
                    setStatus('連携元の回答データを確認できません。フォームメーカー側の同期状態を確認してください。', 'warning');
                    return;
                }
                void importSourceSnapshot(source);
            },
            error => {
                console.error('Form import source listener failed:', error);
                setStatus('フォーム回答との接続が切れました。再接続を待っています。', 'warning');
            }
        );
        renderLinkUi(true);
    }

    async function syncNow() {
        const link = currentLink();
        if (!link) return;
        if (!await waitForFirebaseReady()) {
            setStatus('同期サービスに接続できませんでした。', 'error');
            return;
        }
        setBusy(true);
        setStatus('最新の回答を確認しています…');
        try {
            const snapshot = await get(ref(db, `rooms/${sourceRoomIdForSpreadsheet(link.spreadsheetId)}`));
            const source = snapshot.val();
            if (!validateSourceRoom(source, link.spreadsheetId)) {
                setStatus('連携元の回答データを確認できませんでした。', 'error');
                return;
            }
            await importSourceSnapshot(source, { forceStatus: true });
        } catch (error) {
            console.error('Manual form sync failed:', error);
            setStatus('最新回答の確認に失敗しました。', 'error');
        } finally {
            setBusy(false);
        }
    }

    async function unlinkCurrentForm() {
        const link = currentLink();
        if (!link) return;
        const confirmed = await appConfirm(
            'この企画と応募フォーム回答の自動連携を解除しますか？\nすでに取り込んだ参加者は削除されません。',
            { title: '自動連携を解除', okText: '連携解除' }
        );
        if (!confirmed) return;

        const canonical = currentCanonical();
        if (!canonical?.meta) return;
        delete canonical.meta.formImport;
        persistCanonicalImport(canonical);
        stopSourceSubscription();
        const input = byId('formAutoLinkUrl');
        if (input) {
            input.readOnly = false;
            input.removeAttribute('readonly');
            input.value = '';
        }
        lastRenderedLinkKey = '';
        renderLinkUi(true);
        setStatus('自動連携を解除しました。取り込み済みの参加者はそのまま残っています。');
    }

    function monitorRoomLink() {
        const link = currentLink();
        const desired = link ? sourceRoomIdForSpreadsheet(link.spreadsheetId) : '';
        if (desired !== activeSourceRoomId) void subscribeToCurrentLink();
        renderLinkUi();
    }

    function start() {
        if (!ensureUi()) {
            setTimeout(start, 250);
            return;
        }
        void subscribeToCurrentLink();
        window.setInterval(monitorRoomLink, LINK_POLL_MS);
    }

    window.SanpoFormLinkSync = Object.freeze({
        parseSpreadsheetId,
        sourceRoomIdForSpreadsheet,
        syncNow: () => syncNow()
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start, { once: true });
    } else {
        start();
    }
})();
