const memory = new Map();

// Deliberately outside the shared room/storage protocol. Only unfinished UI
// input and this task's precise retry receipt are cached; no whole room
// snapshot, other feature draft, or handoff token is copied.
export function createParticipantTaskDraft({ storage, roomId, task }) {
  const key = `sanpo-ui:participant-task:v1:${encodeURIComponent(roomId)}:${task}`;
  return Object.freeze({
    read() {
      if (memory.get(key)?.dirty) return structuredClone(memory.get(key).data);
      try {
        const raw = storage().getItem(key);
        const record = raw ? JSON.parse(raw) : null;
        const value = record?.version === 1 && record.data && typeof record.data === 'object' ? record.data : null;
        memory.set(key, { data: value, dirty: false });
        return value;
      } catch {
        const data = memory.get(key)?.data || null;
        memory.set(key, { data, dirty: true });
        return structuredClone(data);
      }
    },
    isRecoverable() { return !memory.get(key)?.dirty; },
    write(data) {
      const pending = { data: structuredClone(data), dirty: true };
      memory.set(key, pending);
      try { storage().setItem(key, JSON.stringify({ version: 1, data })); pending.dirty = false; return true; }
      catch { return false; }
    },
    clear() {
      memory.set(key, { data: null, dirty: true });
      try { storage().removeItem(key); memory.delete(key); return true; }
      catch { return false; }
    },
  });
}
