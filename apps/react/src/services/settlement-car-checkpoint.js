const CHECKPOINT_TTL_MS = 30 * 60 * 1000;
const keyFor = roomId => `sanpo:settlement-car-checkpoint:v1:${encodeURIComponent(roomId)}`;

export function writeSettlementCarCheckpoint(storage, { roomId, carName, baseCar, draftCar, resetGeneration, now = Date.now() }) {
  if (!storage || !roomId || !carName || !baseCar || !draftCar) return false;
  try {
    storage.setItem(keyFor(roomId), JSON.stringify({ roomId, carName, baseCar, draftCar, resetGeneration, expiresAt: now + CHECKPOINT_TTL_MS }));
    return true;
  } catch { return false; }
}

export function readSettlementCarCheckpoint(storage, roomId, now = Date.now()) {
  if (!storage || !roomId) return null;
  try {
    const key = keyFor(roomId);
    const checkpoint = JSON.parse(storage.getItem(key) || 'null');
    if (!checkpoint) return null;
    if (checkpoint.roomId !== roomId || checkpoint.expiresAt <= now) {
      storage.removeItem(key);
      return null;
    }
    return checkpoint;
  } catch { return null; }
}

export function clearSettlementCarCheckpoint(storage, roomId) {
  try { storage?.removeItem(keyFor(roomId)); } catch {}
}
