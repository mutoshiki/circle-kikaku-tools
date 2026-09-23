export function createMemoryStorage() {
  const values = new Map();
  return {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
  };
}

export function createHistoryService({ storage, roomId, clock = { now: () => Date.now() }, limit = 20 }) {
  const key = `syawari_history_${roomId}`;
  let restoreBackup = null;
  function read() {
    try {
      const value = JSON.parse(storage.getItem(key) || '[]');
      return Array.isArray(value) ? value : [];
    } catch { return []; }
  }
  function write(value) {
    try { storage.setItem(key, JSON.stringify(Array.isArray(value) ? value : [])); return true; }
    catch { return false; }
  }
  function save(room) {
    const data = structuredClone(room);
    const items = read();
    if (items[0] && JSON.stringify(items[0].data) === JSON.stringify(data)) return items[0];
    const item = { time: clock.now(), data };
    write([item, ...items].slice(0, limit));
    return item;
  }
  function restore(store, item) {
    if (!item?.data) return false;
    restoreBackup = structuredClone(store.getSnapshot());
    store.command('restore', { value: structuredClone(item.data) });
    return true;
  }
  function undo(store) {
    if (!restoreBackup) return false;
    const value = restoreBackup;
    restoreBackup = null;
    store.command('restore', { value });
    return true;
  }
  return Object.freeze({ key, read, write, save, restore, undo, canUndo: () => restoreBackup !== null });
}
