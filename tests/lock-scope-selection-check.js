const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const runtime = read('assets/js/core/runtime.js');
const lock = read('assets/js/features/lock-protection.js');
const state = read('assets/js/core/data-state.js');
const sync = read('assets/js/core/sync-controller.js');
const storage = read('assets/js/core/storage.js');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(runtime.includes("APP_SCHEMA_VERSION = 4"), 'lock scope data requires schema version 4');
assert(runtime.includes('editLockScopes = { allocation: false, settlement: false }'), 'lock scopes should default to unlocked');
assert(lock.includes("createScopeOption('allocation', '車割・班割'"), 'lock setup must offer allocation scope');
assert(lock.includes("createScopeOption('settlement', '精算'"), 'lock setup must offer settlement scope');
assert(lock.includes('ロックする機能を1つ以上選んでください'), 'lock setup must reject an empty scope selection');
assert(lock.includes("{ allowTrusted: false }"), 'unlocking must request the passphrase even on a trusted device');
assert(state.includes('editLockScopes: { ...editLockScopes }'), 'local state must persist lock scopes');
assert(sync.includes('editLockScopes: d.editLockScopes'), 'remote sync must persist lock scopes');
assert(storage.includes('version < 4') && storage.includes('editLockScopes'), 'older global locks must migrate to scoped locks');
console.log('Lock scope selection check OK');
