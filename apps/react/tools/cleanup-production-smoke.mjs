import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, signInAnonymously, signOut } from 'firebase/auth';
import { getDatabase, ref, get, remove } from 'firebase/database';

const roomId = process.env.REACT_PRODUCTION_SMOKE_ROOM || '';
const marker = process.env.REACT_PRODUCTION_SMOKE_MARKER || '';
const config = JSON.parse(process.env.REACT_FIREBASE_CONFIG || '{}');
if (process.env.REACT_PRODUCTION_RELEASE !== 'true'
  || roomId !== 'P9A93LMQ'
  || !/^react-release-\d+-\d+$/.test(marker)
  || config.projectId !== 'sanpokai-tool'
  || config.databaseURL !== 'https://sanpokai-tool-default-rtdb.firebaseio.com') {
  throw new Error('Production smoke cleanup target guard rejected this run.');
}

const app = initializeApp(config, `release-smoke-cleanup-${globalThis.crypto.randomUUID()}`);
const auth = getAuth(app);
try {
  await signInAnonymously(auth);
  const database = getDatabase(app);
  const room = ref(database, `rooms/${roomId}`);
  const snapshot = await get(room);
  if (snapshot.exists()) {
    const roomMarker = snapshot.child('roomName').val();
    if (roomMarker !== marker && !(typeof roomMarker === 'string' && /^react-release-\d+-\d+$/.test(roomMarker))) {
      throw new Error('Reserved smoke room marker is not a release smoke marker; data was left unchanged.');
    }
    await remove(room);
    if ((await get(room)).exists()) throw new Error('Reserved smoke room cleanup could not be verified.');
  }
  process.stdout.write('Reserved smoke room cleanup verified.\n');
} finally {
  try { await signOut(auth); } finally { await deleteApp(app); }
}
