const memory = new Map();

// Recovery of unfinished UI input, never another room persistence owner.
export function createVehicleCostDraft({ storage, roomId, carKey }) {
  const key = `sanpo-ui:vehicle-cost:v1:${encodeURIComponent(roomId)}:${encodeURIComponent(carKey)}`;
  return Object.freeze({
    read() {
      if (memory.get(key)?.dirty) return structuredClone(memory.get(key).data);
      try {
        const record = JSON.parse(storage().getItem(key) || 'null');
        const data = record?.version === 1 && record.data && typeof record.data === 'object' ? record.data : null;
        memory.set(key, { data, dirty: false });
        return structuredClone(data);
      } catch {
        const data = memory.get(key)?.data || null;
        memory.set(key, { data, dirty: true });
        return structuredClone(data);
      }
    },
    write(data) {
      const entry = { data: structuredClone(data), dirty: true };
      memory.set(key, entry);
      try { storage().setItem(key, JSON.stringify({ version: 1, data })); entry.dirty = false; return true; }
      catch { return false; }
    },
    clear() {
      memory.set(key, { data: null, dirty: true });
      try { storage().removeItem(key); memory.delete(key); return true; }
      catch { return false; }
    },
    isRecoverable() { return !memory.get(key)?.dirty; },
  });
}
