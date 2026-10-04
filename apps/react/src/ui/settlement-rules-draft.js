const memory = new Map();
export const RULE_FIELDS = Object.freeze(['rounding', 'organizerFree', 'organizerName', 'driverCollectionOffset', 'driverCollectionFree', 'driverReward', 'driverRewardType', 'standalone.enabled', 'standalone.driverCount', 'standalone.memberCount', 'standalone.driverNames']);
const booleanFields = new Set(['organizerFree', 'driverCollectionOffset', 'driverCollectionFree', 'standalone.enabled']);
const settingsPath = path => /^settlement\/(rounding|organizerFree|organizerParticipantId|organizerNameFallback|driverCollectionOffset|driverCollectionFree|driverReward|driverRewardType|standalone)(\/|$)/.test(path);
const object = value => value && typeof value === 'object' && !Array.isArray(value);
function valid(record) {
  if (!object(record) || Object.keys(record).some(key => !['fields', 'before', 'resetGeneration', 'organizerId', 'receipt'].includes(key))) return false;
  if (!object(record.fields) || !object(record.before) || !Number.isFinite(record.resetGeneration) || ![null, undefined].includes(record.organizerId) && typeof record.organizerId !== 'string') return false;
  for (const [key, value] of Object.entries(record.fields)) {
    if (!RULE_FIELDS.includes(key)) return false;
    if (booleanFields.has(key) ? typeof value !== 'boolean' : key === 'standalone.driverNames' ? !Array.isArray(value) || value.length > 99 || value.some(name => typeof name !== 'string') : typeof value !== 'string') return false;
  }
  if (Object.keys(record.before).some(path => !settingsPath(path))) return false;
  const receipt = record.receipt;
  if (receipt && (!object(receipt) || receipt.type !== 'settlement-rules' || !object(receipt.patch) || !object(receipt.before) || !Number.isFinite(receipt.resetGeneration) || typeof receipt.operationId !== 'string'
    || Object.keys(receipt.patch).some(path => !settingsPath(path)) || Object.keys(receipt.before).some(path => !settingsPath(path)))) return false;
  return true;
}

// Raw unfinished UI input only, never another shared persistence owner.
export function createSettlementRulesDraft({ storage, roomId }) {
  const key = `sanpo-ui:settlement-rules:v1:${encodeURIComponent(roomId)}`;
  return Object.freeze({
    read() {
      if (memory.get(key)?.dirty) return structuredClone(memory.get(key).data);
      try {
        const payload = JSON.parse(storage().getItem(key) || 'null');
        const data = payload?.version === 1 && valid(payload.data) ? payload.data : null;
        memory.set(key, { data, dirty: false }); return structuredClone(data);
      } catch {
        const data = memory.get(key)?.data || null; memory.set(key, { data, dirty: true }); return structuredClone(data);
      }
    },
    write(data) {
      if (!valid(data)) throw new Error('Invalid settlement rules recovery record');
      const entry = { data: structuredClone(data), dirty: true }; memory.set(key, entry);
      try { storage().setItem(key, JSON.stringify({ version: 1, data })); entry.dirty = false; return true; } catch { return false; }
    },
    clear() {
      memory.set(key, { data: null, dirty: true });
      try { storage().removeItem(key); memory.delete(key); return true; } catch { return false; }
    },
    isRecoverable() { return !memory.get(key)?.dirty; },
  });
}
