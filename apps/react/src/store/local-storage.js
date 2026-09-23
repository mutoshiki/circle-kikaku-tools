// A separate origin plus a separate namespace prevents legacy outbox collisions.
export function createRoomStorage(storage, roomId) {
  const prefix = `sanpo-react:v1:${encodeURIComponent(roomId)}:`;
  return Object.freeze({
    read(name, fallback = null) {
      try { const value = storage.getItem(prefix + name); return value === null ? fallback : JSON.parse(value); }
      catch { return fallback; }
    },
    write(name, value) { storage.setItem(prefix + name, JSON.stringify(value)); },
    remove(name) { storage.removeItem(prefix + name); },
  });
}
