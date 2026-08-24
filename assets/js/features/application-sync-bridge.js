// Shared managed-form linkage bridge.
// `meta/applicationSync` is owned by the form integration and intentionally omitted from
// normal room saves. Keep the latest authoritative linkage available to every feature even
// when a normal room save replaces the canonical snapshot in between form-sync callbacks.
(() => {
  'use strict';

  const APPLICATION_KIND = 'formApplicationSync';
  const APPLICATION_VERSION = 2;
  const REPAIR_MS = 250;
  let current = null;
  let unsubscribe = null;
  let startingRemote = false;

  function valid(sync) {
    return !!sync
      && sync.kind === APPLICATION_KIND
      && Number(sync.version || 0) === APPLICATION_VERSION;
  }

  function clone(value) {
    if (!value) return null;
    try { return JSON.parse(JSON.stringify(value)); }
    catch (_) { return null; }
  }

  function canonical() {
    return window.SanpoCanonicalState?.get?.() || null;
  }

  function canonicalSync() {
    const sync = canonical()?.meta?.applicationSync;
    return valid(sync) ? sync : null;
  }

  function refreshConsumers() {
    window.SanpoApplicantSync?.render?.();
    window.SanpoParticipantAnnouncement?.refresh?.();
  }

  function installIntoCanonical(sync = current) {
    if (!valid(sync)) return false;
    const room = canonical();
    if (!room) return false;
    room.meta = room.meta && typeof room.meta === 'object' ? room.meta : {};
    const existing = room.meta.applicationSync;
    const same = valid(existing)
      && Number(existing.syncedAt || 0) === Number(sync.syncedAt || 0)
      && Number(existing.responseCount || 0) === Number(sync.responseCount || 0)
      && String(existing.title || '') === String(sync.title || '')
      && String(existing.eventDate || existing.date || '') === String(sync.eventDate || sync.date || '');
    if (same) return false;
    room.meta.applicationSync = clone(sync);
    return true;
  }

  function publish(sync, { source = 'unknown' } = {}) {
    if (!valid(sync)) return false;
    current = clone(sync);
    installIntoCanonical(current);
    window.dispatchEvent(new CustomEvent('sanpo:application-sync-changed', {
      detail: { source, sync: clone(current) }
    }));
    refreshConsumers();
    return true;
  }

  function get() {
    if (valid(current)) return current;
    const sync = canonicalSync();
    if (valid(sync)) {
      current = clone(sync);
      return current;
    }
    return null;
  }

  function repair() {
    if (!valid(current)) {
      const sync = canonicalSync();
      if (valid(sync)) current = clone(sync);
      return false;
    }
    const repaired = installIntoCanonical(current);
    if (repaired) {
      window.dispatchEvent(new CustomEvent('sanpo:application-sync-changed', {
        detail: { source: 'repair', sync: clone(current) }
      }));
      refreshConsumers();
    }
    return repaired;
  }

  async function startRemoteSubscription() {
    if (startingRemote || typeof unsubscribe === 'function') return;
    startingRemote = true;
    try {
      const started = Date.now();
      while (Date.now() - started < 12000) {
        if (typeof firebaseEnabled !== 'undefined' && firebaseEnabled === false) return;
        if (
          typeof firebaseReady !== 'undefined' && firebaseReady
          && typeof db !== 'undefined' && db
          && typeof ref === 'function'
          && typeof onValue === 'function'
          && typeof roomId !== 'undefined' && roomId
        ) break;
        await new Promise(resolve => setTimeout(resolve, 120));
      }

      if (
        !(typeof firebaseReady !== 'undefined' && firebaseReady)
        || typeof db === 'undefined' || !db
        || typeof ref !== 'function'
        || typeof onValue !== 'function'
        || typeof roomId === 'undefined' || !roomId
      ) return;

      unsubscribe = onValue(
        ref(db, `rooms/${roomId}/meta/applicationSync`),
        snapshot => {
          const next = snapshot.val();
          if (valid(next)) publish(next, { source: 'firebase' });
        },
        error => console.warn('Application sync bridge listener failed:', error)
      );
    } finally {
      startingRemote = false;
    }
  }

  function start() {
    const initial = canonicalSync();
    if (initial) publish(initial, { source: 'canonical' });
    window.setInterval(repair, REPAIR_MS);
    void startRemoteSubscription();
  }

  window.SanpoApplicationSyncBridge = Object.freeze({
    get,
    publish,
    repair,
    valid
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
