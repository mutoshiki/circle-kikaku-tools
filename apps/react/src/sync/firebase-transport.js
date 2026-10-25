// SDK imports are deferred until an explicitly configured emulator/staging/production runtime.
// The legacy production firebase-config.js is never imported by this entry.
import { buildHandoffRequest } from '../services/handoff-export.js';
import { assertHandoffAdmission } from '../services/handoff-client.js';
export const PRODUCTION_FIREBASE_TARGET = Object.freeze({
  projectId: 'sanpokai-tool',
  databaseURL: 'https://sanpokai-tool-default-rtdb.firebaseio.com',
});

export function assertFirebaseTarget({ config, mode, emulator, stagingProjectId }) {
  if (mode === 'emulator') {
    if (!['127.0.0.1', 'localhost', '::1'].includes(emulator?.host) || !String(config?.projectId || '').startsWith('demo-')) {
      throw new Error('Emulator requires a loopback host and demo project ID');
    }
    return;
  }
  if (mode === 'production') {
    if (config?.projectId !== PRODUCTION_FIREBASE_TARGET.projectId
      || config?.databaseURL !== PRODUCTION_FIREBASE_TARGET.databaseURL
      || !config?.apiKey
      || !config?.authDomain
      || !config?.appId) {
      throw new Error('Configured production project does not match the approved production project');
    }
    return;
  }
  if (mode !== 'staging' || !stagingProjectId || config?.projectId !== stagingProjectId || !/staging|preview|test/.test(stagingProjectId)) {
    throw new Error('An explicit staging project is required');
  }
}

export async function reserveAdmissionSlot({ config, db, dbSdk, auth, request, kind, fetchImpl = globalThis.fetch }) {
  const requestHash = kind === 'create' ? request.inputHash : request.input.tokenHash;
  const start = (Number.parseInt(requestHash.slice(0, 8), 16) % 40) + 1;
  const idToken = await authSdkToken(auth);
  const databaseBase = String(config.databaseURL).replace(/\/$/, '');
  for (let offset = 0; offset < 40; offset += 1) {
    const slotId = String(((start - 1 + offset) % 40) + 1).padStart(2, '0');
    const slotRef = dbSdk.ref(db, `formMakerV1/admission/slots/${slotId}`);
    const slotUrl = `${databaseBase}/formMakerV1/admission/slots/${slotId}.json?auth=${encodeURIComponent(idToken)}`;
    const reservation = { uid: auth.currentUser.uid, jobId: request.jobId, kind, requestHash, requestedAt: request.requestedAt };
    try {
      const response = await fetchImpl(slotUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reservation),
      });
      if (response.ok) return { slotId, requestedAt: request.requestedAt };
      if (response.status !== 412 && response.status !== 401 && response.status !== 403) {
        throw new Error('Firebaseの受付枠を確認できません。時間をおいてもう一度お試しください。');
      }
    } catch (error) {
      if (error instanceof TypeError) throw new Error('Firebaseに接続できません。通信状態を確認して、もう一度お試しください。');
      if (!/^(412|401|403)$/.test(String(error?.status || ''))) throw error;
    }
    try {
      const existing = (await dbSdk.get(slotRef)).val();
      if (existing?.uid === auth.currentUser.uid && existing.jobId === request.jobId && existing.kind === kind &&
          existing.requestHash === requestHash && Number(existing.requestedAt) > 0) {
        return { slotId, requestedAt: Number(existing.requestedAt) };
      }
    } catch { /* this slot is empty or belongs to another owner */ }
  }
  throw new Error('受付枠を確保できません。申込みが混み合っているため、時間をおいてもう一度お試しください。');
}

async function authSdkToken(auth) {
  if (!auth?.currentUser?.getIdToken) throw new Error('企画ツールの利用者を確認できません。');
  return auth.currentUser.getIdToken();
}

export async function createFirebaseTransport({ config, roomId, emulator, stagingProjectId, production = false }) {
  if (!/^[A-Za-z0-9_-]{6,80}$/.test(roomId)) throw new Error('企画IDが不正です。');
  const mode = emulator ? 'emulator' : production ? 'production' : 'staging';
  assertFirebaseTarget({ config, mode, emulator, stagingProjectId });
  const [appSdk, authSdk, dbSdk] = await Promise.all([import('firebase/app'), import('firebase/auth'), import('firebase/database')]);
  const app = appSdk.initializeApp(config, `react-${roomId}-${globalThis.crypto.randomUUID()}`);
  const auth = authSdk.getAuth(app);
  const db = dbSdk.getDatabase(app);
  if (emulator) {
    authSdk.connectAuthEmulator(auth, `http://${emulator.host}:${emulator.authPort}`, { disableWarnings: true });
    dbSdk.connectDatabaseEmulator(db, emulator.host, emulator.databasePort);
  }
  try { await authSdk.setPersistence(auth, authSdk.browserLocalPersistence); }
  catch { try { await authSdk.setPersistence(auth, authSdk.browserSessionPersistence); } catch { await authSdk.setPersistence(auth, authSdk.inMemoryPersistence); } }
  try { await authSdk.signInAnonymously(auth); }
  catch (error) { await appSdk.deleteApp(app); throw error; }
  const room = dbSdk.ref(db, `rooms/${roomId}`);
  let offset = 0;
  let aligned = false;
  const stopClock = dbSdk.onValue(dbSdk.ref(db, '.info/serverTimeOffset'), snapshot => { offset = Number(snapshot.val() || 0); aligned = true; });
  const subscriptions = new Set();
  let disposed = false;
  return Object.freeze({
    clock: { now: () => Date.now() + offset, isServerAligned: () => aligned },
    subscribe(listener, onError) {
      if (disposed) throw new Error('Transport is disposed');
      const stop = dbSdk.onValue(room, snapshot => listener(snapshot.val()), onError);
      subscriptions.add(stop);
      return () => { stop(); subscriptions.delete(stop); };
    },
    async transaction(updater) { const result = await dbSdk.runTransaction(room, updater, { applyLocally: false }); return { committed: result.committed, value: result.snapshot.val() }; },
    update: patch => dbSdk.update(room, patch),
    subscribeApplicationMetadata(listener, onError) {
      const stop = dbSdk.onValue(dbSdk.ref(db, `rooms/${roomId}/meta/applicationSync`), snapshot => listener(snapshot.val()), onError);
      subscriptions.add(stop);
      return () => { stop(); subscriptions.delete(stop); };
    },
    async enqueueHandoffExport({ projectId: requestedProjectId, token, responseKeys, manualParticipantIds, jobId }) {
      if (!auth.currentUser?.uid) throw new Error('企画ツールの利用者を確認できません。');
      if (requestedProjectId !== roomId) throw new Error('この企画の引き継ぎ要求ではありません。');
      const authUid = auth.currentUser.uid;
      const status = (await dbSdk.get(dbSdk.ref(db, 'formMakerV1/status'))).val();
      const testOwner = status?.acceptanceMode === 'test'
        ? (await dbSdk.get(dbSdk.ref(db, `formMakerV1/testOwners/${authUid}`))).val()
        : false;
      assertHandoffAdmission(status, testOwner);
      const request = await buildHandoffRequest({ projectId: roomId, token, responseKeys, manualParticipantIds, jobId });
      const admission = await reserveAdmissionSlot({ config, db, dbSdk, auth, request, kind: 'handoff' });
      request.admissionSlotId = admission.slotId;
      request.requestedAt = admission.requestedAt;
      try {
        await dbSdk.set(dbSdk.ref(db, `formMakerV1/users/${authUid}/handoffs/${request.jobId}`), request);
      } catch (error) {
        try {
          const raced = (await dbSdk.get(dbSdk.ref(db, `formMakerV1/users/${authUid}/handoffs/${request.jobId}`))).val();
          if (raced?.jobId === request.jobId && raced.input?.tokenHash === request.input.tokenHash &&
              raced.input?.responseKeys === request.input.responseKeys && raced.admissionSlotId === request.admissionSlotId) return { jobId: request.jobId };
        } catch { /* leave the reservation for the worker's orphan cleanup */ }
        throw error;
      }
      return { jobId: request.jobId };
    },
    async getHandoffExport(jobId) {
      if (!auth.currentUser?.uid || !/^[A-Za-z0-9_-]{16,80}$/.test(String(jobId || ''))) return null;
      return (await dbSdk.get(dbSdk.ref(db, `formMakerV1/users/${auth.currentUser.uid}/handoffs/${jobId}`))).val();
    },
    async dispose() {
      if (disposed) return;
      disposed = true;
      stopClock();
      for (const stop of subscriptions) stop();
      subscriptions.clear();
      dbSdk.goOffline(db);
      // RTDB activates Auth's proactive token refresh. deleteApp alone in this
      // SDK version leaves that timer alive; sign out this owned app first.
      try { await authSdk.signOut(auth); } finally { await appSdk.deleteApp(app); }
    },
  });
}
