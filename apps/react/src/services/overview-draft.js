export function createOverviewDraftStorage(storage, roomId) {
  const key = `sanpoOverviewDraft:v1:${roomId || 'local'}`;
  return Object.freeze({
    key,
    read(fallback = {}) {
      try { const value = JSON.parse(storage.getItem(key) || 'null'); return value && typeof value === 'object' ? value : structuredClone(fallback); }
      catch { return structuredClone(fallback); }
    },
    write(value) {
      const normalized = { memo: String(value?.memo || ''), timetableItems: Array.isArray(value?.timetableItems) ? value.timetableItems.map(item => ({ time: String(item?.time || '').slice(0, 5), title: String(item?.title || '') })).filter(item => item.time || item.title) : [] };
      storage.setItem(key, JSON.stringify(normalized));
      return normalized;
    },
  });
}
