import { createRoomStore } from './store/room-store.js';
import { createRoomStorage } from './store/local-storage.js';
import { createRoomSync } from './sync/room-sync.js';
import { createApplicantSync } from './sync/applicant-sync.js';
import { createHistoryService } from './services/history.js';
import { createOverviewDraftStorage } from './services/overview-draft.js';
import { createShareUrl, prepareCompatibleUrl } from './services/url-compat.js';
import { withRoutePlaceCatalogMerge } from './route-place-sync.js';
import { recordPortalVisit, updatePortalProject } from './services/portal-history.js';
import { createHandoffClient } from './services/handoff-client.js';
import { createWorkspaceSync } from './services/project-workspace.js';
import { creationIntentKey, readCreationIntent } from './services/project-entry.js';
import { createApplicationFormHref, prepareApplicationFormContext } from './services/application-form-link.js';
import { createHandoffCapability } from './services/handoff-capability.js';
import { tokenStorageKey, validHandoffToken } from './services/url-compat.js';
import { createTemplateWorkspace, workspaceCacheKey } from './services/project-workspace.js';
import { createProjectDomain } from './services/project-domain.js';
import { createDebugSampleProject } from './services/debug-sample-project.js';

const APPLICATION_FORM_PORTAL = 'https://mutoshiki.github.io/sanpokai-kikaku-portal/form-maker/';

export function createLocalRuntime({ location, history, storage, crypto, transport, legacyLoadWrites = true, routeService = null, externalAdapters = {}, formMakerSession = null, debugSample = false }) {
  const launch = prepareCompatibleUrl({ location, history, storage, crypto });
  const roomId = launch.roomId;
  const roomStorage = createRoomStorage(storage, roomId);
  const clientId = roomStorage.read('clientId') || `react_${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}`;
  roomStorage.write('clientId', clientId);
  const store = createRoomStore({ initial: roomStorage.read('room', {}), clientId, crypto, clock: transport?.clock });
  store.domain.sync = withRoutePlaceCatalogMerge(store.domain.sync);
  const localStatus = Object.freeze({ kind: 'local', message: 'ローカル保存', error: null, hasLoadedRoom: true });
  const sync = transport ? createRoomSync({ store, storage: roomStorage, transport, clientId, clock: transport.clock, legacyLoadWrites })
    : { start() {}, dispose() {}, getSnapshot: () => localStatus, subscribe: () => () => {}, flush: async () => null };
  let unsubscribe;
  let unsubscribePortal;
  const applicantSync = createApplicantSync({ store, transport });
  const roomHistory = createHistoryService({ storage, roomId, clock: transport?.clock });
  const overviewDraft = createOverviewDraftStorage(storage, roomId);
  const routeDraftKey = `sanpo.routePlannerState.v2:${roomId}`;
  const routeDraft = Object.freeze({
    read(fallback = {}) { try { return JSON.parse(storage.getItem(routeDraftKey) || 'null') || structuredClone(fallback); } catch { return structuredClone(fallback); } },
    write(value) { storage.setItem(routeDraftKey, JSON.stringify(value)); return value; },
  });
  const workerHandoff = createHandoffClient({ transport, crypto, storage: roomStorage });
  const workspace = createWorkspaceSync({ roomId, transport, storage });
  const formReservation = roomStorage.read('applicationFormReservation');
  const handoffCapability = createHandoffCapability({ roomId, storage: roomStorage, initialJobId: formReservation?.jobId || (validHandoffToken(launch.handoffToken) ? 'legacy' : '') });
  async function acceptApplicationFormHandoff(result) {
    const current = roomStorage.read('applicationFormReservation');
    if (!current || result?.roomId !== roomId || result?.jobId !== current.jobId || !validHandoffToken(result?.token)) return false;
    // targetRoomCapability authenticates form creation; this token is the separate
    // owner-scoped export capability returned by the existing form-maker session.
    if (!handoffCapability.accept(result, current.jobId)) return false;
    try { storage.removeItem(tokenStorageKey(roomId)); } catch {}
    return true;
  }
  if (validHandoffToken(launch.handoffToken)) {
    const expectedJobId = formReservation?.jobId || 'legacy';
    handoffCapability.accept({ roomId, jobId: expectedJobId, token: launch.handoffToken }, expectedJobId);
  }
  const pendingCreate = readCreationIntent(storage, roomId);
  const setupListeners = new Set();
  let projectSetup = Object.freeze({ status: pendingCreate ? 'creating' : 'idle', error: null });
  let workspaceStarted = false;
  let setupStarted = false;
  function setProjectSetup(status, error = null) {
    projectSetup = Object.freeze({ status, error: error ? String(error.message || error) : null });
    for (const listener of setupListeners) listener();
  }
  function startWorkspace() {
    if (workspaceStarted) return;
    workspaceStarted = true;
    workspace.start();
  }
  const external = Object.freeze({
    formMakerSession: externalAdapters.formMakerSession || formMakerSession,
    async createApplicationForm({ room } = {}) {
      if (typeof externalAdapters.createApplicationForm === 'function') return externalAdapters.createApplicationForm({ room, roomId, transport, crypto });
      return createApplicationFormHref({ baseHref: APPLICATION_FORM_PORTAL, roomId, room, transport, cryptoApi: crypto, now: () => transport?.clock?.now?.() || Date.now(), storage: roomStorage });
    },
    async prepareApplicationForm({ room } = {}) {
      return prepareApplicationFormContext({ roomId, room, transport, cryptoApi: crypto, now: () => transport?.clock?.now?.() || Date.now(), storage: roomStorage });
    },
    acceptApplicationFormHandoff,
    async handoff(payload) {
      if (typeof externalAdapters.handoff === 'function') return externalAdapters.handoff(payload);
      return workerHandoff(payload);
    },
    async bugReport(payload) {
      if (typeof externalAdapters.bugReport !== 'function') throw new Error('バグ報告の送信先が設定されていません。');
      return externalAdapters.bugReport(payload);
    },
  });
  function start() {
    if (unsubscribe) return;
    unsubscribe = store.subscribeIntents(() => roomStorage.write('room', store.getSnapshot()));
    const snapshot = store.getSnapshot();
    recordPortalVisit(storage, { roomId, name: snapshot.roomName, updatedAt: snapshot.lastUpdatedAt });
    unsubscribePortal = store.subscribe(() => {
      const current = store.getSnapshot();
      updatePortalProject(storage, { roomId, name: current.roomName, updatedAt: current.lastUpdatedAt });
    });
    const startRoomServices = () => { sync.start(); applicantSync.start(); };
    const initializePendingProject = async () => {
      if (setupStarted) return;
      setupStarted = true;
      try {
        if (transport?.createRoomIfAbsent) {
          const initial = store.domain.canonical.emptyRoom();
          initial.roomName = String(pendingCreate.roomName || '').trim();
          initial.lastUpdatedAt = Number(transport.clock?.now?.() || Date.now());
          initial.lastUpdatedBy = clientId;
          initial.revision = 1;
          const result = await transport.createRoomIfAbsent(initial);
          if (!result.created && !pendingCreate.roomCreated) throw new Error('企画IDが既に使われています。企画一覧から別の企画を作成してください。');
          if (result.created) {
            pendingCreate.roomCreated = true;
            storage.setItem(creationIntentKey(roomId), JSON.stringify(pendingCreate));
          }
          // Do not subscribe the normal room sync before the explicit create transaction.
          // A null room would otherwise be treated as an empty legacy room and could race
          // this transaction by writing the canonical default first.
          startRoomServices();
        } else {
          if (pendingCreate.roomName && !String(store.getSnapshot().roomName || '').trim()) store.command('rename', { name: String(pendingCreate.roomName).trim() });
          roomStorage.write('room', store.getSnapshot());
        }
        startWorkspace();
        await workspace.ensure(pendingCreate.workspace);
        try { storage.removeItem(creationIntentKey(roomId)); } catch { /* A completed project can be reopened from browser history. */ }
        setProjectSetup('ready');
      } catch (error) {
        setProjectSetup('error', error);
      }
    };
    if (pendingCreate) void initializePendingProject();
    else {
      startRoomServices();
      if (!transport) startWorkspace();
    }
    if (pendingCreate) return;
    {
      const ready = () => {
        if (!sync.getSnapshot().hasLoadedRoom) return;
        stopSetupWait?.();
        startWorkspace();
      };
      let stopSetupWait = sync.subscribe(ready);
      ready();
    }
  }
  async function dispose() { unsubscribe?.(); unsubscribe = null; unsubscribePortal?.(); unsubscribePortal = null; applicantSync.dispose(); sync.dispose(); workspace.dispose(); await transport?.dispose(); }
  const runtime = { roomId, debugSample, initialView: launch.initialView, get handoffToken() { return handoffCapability.getSnapshot().token; }, handoffCapability, store, storage: roomStorage, sync, workspace, projectSetup: { getSnapshot: () => projectSetup, subscribe(listener) { setupListeners.add(listener); return () => setupListeners.delete(listener); } }, history: roomHistory, overviewDraft, routeDraft, routeService, external, createShareUrl: () => createShareUrl(new URL(location.href, launch.href).href), start, dispose };
  return runtime;
}

export async function createRuntime(options, env = import.meta.env || {}) {
  const requestedUrl = new URL(options.location.href);
  if (requestedUrl.searchParams.get('debugSample') === 'all-tools') {
    const idKey = 'sanpo-debug-sample:all-tools:room:v1';
    let roomId = '';
    try { roomId = options.storage.getItem(idKey) || ''; } catch {}
    if (!/^[A-Z0-9_-]{12,80}$/.test(roomId)) {
      roomId = `DEBUG-${options.crypto.randomUUID().replaceAll('-', '').slice(0, 16).toUpperCase()}`;
      try { options.storage.setItem(idKey, roomId); } catch {}
    }
    requestedUrl.searchParams.set('room', roomId);
    options.history.replaceState(options.history.state || null, '', requestedUrl);
    const namespace = `sanpo-debug-sample:all-tools:v1:${roomId}:`;
    const isolatedStorage = {
      getItem(key) { try { return window.sessionStorage.getItem(namespace + key); } catch { return null; } },
      setItem(key, value) { window.sessionStorage.setItem(namespace + key, value); },
      removeItem(key) { try { window.sessionStorage.removeItem(namespace + key); } catch {} },
    };
    try { isolatedStorage.setItem(workspaceCacheKey(roomId), JSON.stringify(createTemplateWorkspace({ templateId: 'circle-mountain', now: Date.now() }))); } catch {}
    const runtime = createLocalRuntime({ ...options, location: { href: requestedUrl.href }, storage: isolatedStorage, transport: null, routeService: null, externalAdapters: {}, debugSample: true });
    if (!runtime.store.getSnapshot().roomName) {
      const project = createProjectDomain({ getRoom: runtime.store.getSnapshot, settlement: runtime.store.domain.settlement });
      runtime.store.command('restore', { value: createDebugSampleProject({ projectDomain: project, now: Date.now() }), source: 'debug-sample' });
    }
    return runtime;
  }
  if (!env.VITE_REACT_SYNC_MODE || env.VITE_REACT_SYNC_MODE === 'local') return createLocalRuntime(options);
  const url = requestedUrl;
  if (!url.searchParams.get('room')) {
    url.searchParams.set('room', options.crypto.randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase());
    options.history.replaceState(null, '', url);
  }
  const { createFirebaseTransport } = await import('./sync/firebase-transport.js');
  let config;
  let emulator;
  if (env.VITE_REACT_SYNC_MODE === 'emulator') {
    config = { apiKey: 'demo-api-key', projectId: 'demo-circle-react', databaseURL: 'https://demo-circle-react-default-rtdb.firebaseio.com' };
    emulator = { host: '127.0.0.1', authPort: 9098, databasePort: 9008 };
  } else if (env.VITE_REACT_SYNC_MODE === 'staging' || env.VITE_REACT_SYNC_MODE === 'production') {
    config = JSON.parse(env.VITE_REACT_FIREBASE_CONFIG || '{}');
  }
  else throw new Error('同期環境の設定が不正です。');
  const transport = await createFirebaseTransport({
    config,
    roomId: url.searchParams.get('room'),
    emulator,
    stagingProjectId: env.VITE_REACT_STAGING_PROJECT_ID,
    production: env.VITE_REACT_SYNC_MODE === 'production',
  });
  const formMakerSession = env.VITE_REACT_SYNC_MODE === 'production'
    ? await createProductionFormMakerSession(options.storage)
    : null;
  return createLocalRuntime({ ...options, transport, formMakerSession, legacyLoadWrites: env.VITE_REACT_LEGACY_LOAD_WRITES !== 'false' });
}

async function createProductionFormMakerSession(storage) {
  const { createFormMakerSession, FORM_MAKER_FIREBASE_CONFIG } = await import('@sanpokai/form-maker-workspace');
  return createFormMakerSession({ config: FORM_MAKER_FIREBASE_CONFIG, storage });
}
