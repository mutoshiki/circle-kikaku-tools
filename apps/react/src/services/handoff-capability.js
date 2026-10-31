import { validHandoffToken } from './url-compat.js';

const STORAGE_KEY = 'handoffCapability';

/**
 * Room-scoped export capability. A token is usable only while paired with the
 * exact form job expected by the current room. It is never put in a URL here.
 */
export function createHandoffCapability({ roomId, storage, initialJobId = '', initialToken = '' } = {}) {
  const listeners = new Set();
  let jobId = String(initialJobId || '');
  let token = '';
  let currentSnapshot = null;

  if (jobId) {
    const saved = storage?.read(STORAGE_KEY);
    if (saved?.roomId === roomId && saved?.jobId === jobId && validHandoffToken(saved.token)) token = saved.token;
    if (!token && initialToken && validHandoffToken(initialToken)) token = initialToken;
  }

  function snapshot() {
    if (!currentSnapshot || currentSnapshot.jobId !== jobId || currentSnapshot.token !== token) {
      currentSnapshot = Object.freeze({ roomId, jobId, token, available: Boolean(token) });
    }
    return currentSnapshot;
  }
  function notify() { currentSnapshot = null; for (const listener of listeners) listener(); }
  function accept(result, expectedJobId) {
    const expected = String(expectedJobId || '');
    if (!expected || result?.roomId !== roomId || result?.jobId !== expected || !validHandoffToken(result?.token)) return false;
    if (jobId === expected && token === result.token) return true;
    jobId = expected;
    token = result.token;
    try { storage?.write(STORAGE_KEY, { roomId, jobId, token }); } catch { token = ''; return false; }
    notify();
    return true;
  }

  return Object.freeze({
    getSnapshot: snapshot,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    accept,
    clear() { if (!token) return; token = ''; try { storage?.remove(STORAGE_KEY); } catch {} notify(); },
  });
}
