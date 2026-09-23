import { createRoomStore } from './store/room-store.js';
import { createRoomStorage } from './store/local-storage.js';
import { createRoomSync } from './sync/room-sync.js';
import { createApplicantSync } from './sync/applicant-sync.js';
import { createHistoryService } from './services/history.js';
import { createOverviewDraftStorage } from './services/overview-draft.js';
import { createShareUrl, prepareCompatibleUrl } from './services/url-compat.js';

export function createLocalRuntime({ location, history, storage, crypto, transport, legacyLoadWrites = true, routeService = null, externalAdapters = {} }) {
  const launch = prepareCompatibleUrl({ location, history, storage, crypto });
  const roomId = launch.roomId;
  const roomStorage = createRoomStorage(storage, roomId);
  const clientId = roomStorage.read('clientId') || `react_${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}`;
  roomStorage.write('clientId', clientId);
  const store = createRoomStore({ initial: roomStorage.read('room', {}), clientId, crypto, clock: transport?.clock });
  const localStatus = Object.freeze({ kind: 'local', message: 'ローカル保存', error: null });
  const sync = transport ? createRoomSync({ store, storage: roomStorage, transport, clientId, clock: transport.clock, legacyLoadWrites })
    : { start() {}, dispose() {}, getSnapshot: () => localStatus, subscribe: () => () => {}, flush: async () => null };
  let unsubscribe;
  const applicantSync = createApplicantSync({ store, transport });
  const roomHistory = createHistoryService({ storage, roomId, clock: transport?.clock });
  const overviewDraft = createOverviewDraftStorage(storage, roomId);
  const routeDraftKey = `sanpo.routePlannerState.v2:${roomId}`;
  const routeDraft = Object.freeze({
    read(fallback = {}) { try { return JSON.parse(storage.getItem(routeDraftKey) || 'null') || structuredClone(fallback); } catch { return structuredClone(fallback); } },
    write(value) { storage.setItem(routeDraftKey, JSON.stringify(value)); return value; },
  });
  const external = Object.freeze({
    async handoff(payload) {
      if (typeof externalAdapters.handoff !== 'function') throw new Error('引き継ぎデータ作成先が設定されていません。');
      return externalAdapters.handoff(payload);
    },
    async bugReport(payload) {
      if (typeof externalAdapters.bugReport !== 'function') throw new Error('バグ報告の送信先が設定されていません。');
      return externalAdapters.bugReport(payload);
    },
  });
  function start() {
    if (unsubscribe) return;
    unsubscribe = store.subscribeIntents(() => roomStorage.write('room', store.getSnapshot()));
    sync.start();
    applicantSync.start();
  }
  async function dispose() { unsubscribe?.(); unsubscribe = null; applicantSync.dispose(); sync.dispose(); await transport?.dispose(); }
  return { roomId, initialView: launch.initialView, handoffToken: launch.handoffToken, store, storage: roomStorage, sync, history: roomHistory, overviewDraft, routeDraft, routeService, external, createShareUrl: () => createShareUrl(new URL(location.href, launch.href).href), start, dispose };
}

export async function createRuntime(options, env = import.meta.env || {}) {
  if (!env.VITE_REACT_SYNC_MODE || env.VITE_REACT_SYNC_MODE === 'local') return createLocalRuntime(options);
  const url = new URL(options.location.href);
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
  return createLocalRuntime({ ...options, transport, legacyLoadWrites: env.VITE_REACT_LEGACY_LOAD_WRITES !== 'false' });
}
