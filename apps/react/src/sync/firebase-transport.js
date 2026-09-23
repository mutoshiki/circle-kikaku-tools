// SDK imports are deferred until an explicitly configured emulator/staging/production runtime.
// The legacy production firebase-config.js is never imported by this entry.
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
