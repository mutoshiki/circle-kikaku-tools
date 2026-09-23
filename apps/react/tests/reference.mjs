// Test-only oracle. Never included in the browser application.
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const root = new URL('../../../', import.meta.url);
export function createReference({ now = 1000, clientId = 'fixture-client', random = () => 0.25 } = {}) {
  const math = Object.create(Math);
  math.random = random;
  const context = vm.createContext({
    console, Date, JSON, Math: math, Object, Array, Set, Map, String, Number, Boolean, RegExp, parseInt, parseFloat, encodeURIComponent, decodeURIComponent,
    APP_SCHEMA_VERSION: 6, myClientId: clientId, CFG: { STORE: 'reference' }, roomId: 'FIXTURE-ROOM',
    SanpoClock: { now: () => now, isServerAligned: () => true },
    getInt: value => parseInt(value) || 0,
    settlementState: null,
    crypto: { randomUUID: () => '00000000-0000-4000-8000-000000000001' },
    isRemoteUpdate: false, dbRef: null, lastSyncedData: null, lastSyncedRevision: 0,
    pendingRemoteSettlementData: null, saveRequestVersion: 0, saveTimer: null, syncWriteInFlight: false,
    L: { getItem: () => null, setItem() {}, removeItem() {} }, J: JSON,
    updateStatus() {}, updateUI() {}, save() {}, renderActiveCarPlanToDom() {},
    appConfirm: async () => true,
  });
  context.window = context;
  const execute = path => vm.runInContext(readFileSync(new URL(path, root), 'utf8'), context, { filename: path });
  execute('assets/js/core/entity-state-v5.js');
  execute('assets/js/core/allocation-role-state.js');
  execute('assets/js/core/storage.js');
  execute('assets/js/core/sync-controller.js');
  execute('assets/js/features/settlement/01-state.js');
  execute('assets/js/features/settlement/02-calculator.js');
  execute('assets/js/features/google-form-import-parser.js');
  execute('assets/js/features/auto-assign.js');
  return context;
}

export const fixture = JSON.parse(readFileSync(new URL('./fixtures/legacy-v4.json', import.meta.url)));
export function plain(value) {
  if (value instanceof Set || Object.prototype.toString.call(value) === '[object Set]') return [...value].map(plain).sort();
  if (value instanceof Map || Object.prototype.toString.call(value) === '[object Map]') return Object.fromEntries([...value].map(([key, child]) => [key, plain(child)]));
  if (Array.isArray(value)) return Array.from(value, plain);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, plain(value[key])]));
  return value;
}

// This projection is for business equivalence only. Protocol tests compare versions,
// operation IDs, timestamps and revisions separately with deterministic inputs.
export function semanticRoom(room) {
  const project = value => {
    if (Array.isArray(value)) return Array.from(value, project);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.keys(value).sort().filter(key => !['createdAt', 'updatedAt', 'lastUpdatedAt', 'lastUpdatedBy', 'revision', 'syncClock', 'pathVersions', 'syncOperations'].includes(key)).map(key => [key, project(value[key])]));
  };
  return project(room);
}
