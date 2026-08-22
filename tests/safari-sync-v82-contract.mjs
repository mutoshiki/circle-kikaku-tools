import assert from 'node:assert/strict';
import fs from 'node:fs';

const runtime = fs.readFileSync(new URL('../assets/js/core/runtime.js', import.meta.url), 'utf8');

assert.match(runtime, /firebasejs\/12\.17\.1\/firebase-app\.js/);
assert.match(runtime, /firebasejs\/12\.17\.1\/firebase-database\.js/);
assert.match(runtime, /firebasejs\/12\.17\.1\/firebase-auth\.js/);
assert.match(runtime, /initializeAuth = authModule\.initializeAuth/);
assert.match(runtime, /browserLocalPersistence = authModule\.browserLocalPersistence/);
assert.match(runtime, /browserSessionPersistence = authModule\.browserSessionPersistence/);
assert.match(runtime, /inMemoryPersistence = authModule\.inMemoryPersistence/);
assert.match(runtime, /initializeAuth\(app,\s*\{[\s\S]*persistence:\s*\[browserLocalPersistence, browserSessionPersistence, inMemoryPersistence\][\s\S]*\}\)/);
assert.doesNotMatch(runtime, /getAuth\(app\)/, 'Safari sync must not reintroduce Firebase Auth default persistence dependencies');
assert.doesNotMatch(runtime, /indexedDBLocalPersistence/, 'Safari sync must not depend on IndexedDB-backed Auth persistence');
assert.match(runtime, /await signInAnonymously\(auth\)/, 'anonymous auth remains required by the existing Realtime Database rules');

console.log('Safari sync v82 contract: PASS');
