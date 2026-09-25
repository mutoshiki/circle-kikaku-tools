import assert from 'node:assert/strict';
import { assertTestFirebaseTarget, offlineFirebaseConfigScript } from '../tools/test-firebase-target.mjs';

const original = { ...process.env };
try {
  for (const name of ['SANPO_TEST_FIREBASE_TARGET', 'SANPO_TEST_FIREBASE_PROJECT_ID', 'SANPO_TEST_FIREBASE_DATABASE_URL', 'SANPO_FIREBASE_CONFIG', 'SANPO_TEST_FIREBASE_CONFIG', 'SANPO_STAGING_FIREBASE_CONFIG', 'SANPO_LIVE_FIREBASE', 'SANPO_BUG_REPORT_STAGING', 'VITE_REACT_SYNC_MODE', 'VITE_REACT_FIREBASE_CONFIG', 'REACT_FIREBASE_CONFIG', 'FIREBASE_CONFIG', 'FIREBASE_DATABASE_URL', 'FIREBASE_PROJECT_ID', 'GCLOUD_PROJECT', 'GOOGLE_CLOUD_PROJECT']) delete process.env[name];
  delete process.env.SANPO_TEST_FIREBASE_TARGET;
  assert.throws(() => assertTestFirebaseTarget(), /SANPO_TEST_FIREBASE_TARGET/);

  process.env.SANPO_TEST_FIREBASE_TARGET = 'offline';
  process.env.SANPO_TEST_FIREBASE_PROJECT_ID = 'demo-circle-kikaku-tools';
  process.env.SANPO_TEST_FIREBASE_DATABASE_URL = 'http://127.0.0.1:9000';
  assert.equal(assertTestFirebaseTarget().mode, 'offline');
  assert.equal(offlineFirebaseConfigScript(), 'window.SANPO_FIREBASE_CONFIG = {};');

  process.env.SANPO_TEST_FIREBASE_PROJECT_ID = 'sanpokai-tool';
  assert.throws(() => assertTestFirebaseTarget(), /Production Firebase target detected/);
  process.env.SANPO_TEST_FIREBASE_PROJECT_ID = 'demo-circle-kikaku-tools';
  process.env.SANPO_TEST_FIREBASE_DATABASE_URL = 'https://sanpokai-tool-default-rtdb.firebaseio.com';
  assert.throws(() => assertTestFirebaseTarget(), /Production Firebase target detected/);
  process.env.SANPO_TEST_FIREBASE_DATABASE_URL = 'http://127.0.0.1:9000';
  process.env.VITE_REACT_FIREBASE_CONFIG = JSON.stringify({
    projectId: 'sanpokai-tool',
    databaseURL: 'https://sanpokai-tool-default-rtdb.firebaseio.com',
  });
  assert.throws(() => assertTestFirebaseTarget(), /Production Firebase target detected in VITE_REACT_FIREBASE_CONFIG/);
  delete process.env.VITE_REACT_FIREBASE_CONFIG;
  process.env.VITE_REACT_SYNC_MODE = 'production';
  assert.throws(() => assertTestFirebaseTarget(), /Production React sync mode is forbidden/);
  delete process.env.VITE_REACT_SYNC_MODE;
  process.env.GCLOUD_PROJECT = 'sanpokai-tool';
  assert.throws(() => assertTestFirebaseTarget(), /Production Firebase project detected in GCLOUD_PROJECT/);
  delete process.env.GCLOUD_PROJECT;
  process.env.FIREBASE_DATABASE_URL = 'https://sanpokai-tool-default-rtdb.firebaseio.com';
  assert.throws(() => assertTestFirebaseTarget(), /Production Firebase database URL detected/);
  delete process.env.FIREBASE_DATABASE_URL;

  process.env.SANPO_TEST_FIREBASE_TARGET = 'staging';
  process.env.SANPO_STAGING_FIREBASE_CONFIG = JSON.stringify({
    projectId: 'staging-fixture',
    databaseURL: 'https://sanpokai-tool-default-rtdb.firebaseio.com',
  });
  assert.throws(() => assertTestFirebaseTarget(), /Production Firebase target detected/);
  process.env.SANPO_STAGING_FIREBASE_CONFIG = JSON.stringify({
    projectId: 'sanpokai-tool-staging',
    databaseURL: 'https://sanpokai-tool-staging-default-rtdb.firebaseio.com',
  });
  assert.equal(assertTestFirebaseTarget().mode, 'staging');
  process.env.SANPO_TEST_FIREBASE_TARGET = 'offline';
  process.env.SANPO_STAGING_FIREBASE_CONFIG = JSON.stringify({
    projectId: 'staging-fixture',
    databaseURL: 'https://sanpokai-tool-default-rtdb.firebaseio.com',
  });
  assert.throws(() => assertTestFirebaseTarget(), /Production Firebase target detected in SANPO_STAGING_FIREBASE_CONFIG/);
} finally {
  for (const key of Object.keys(process.env)) if (!(key in original)) delete process.env[key];
  Object.assign(process.env, original);
}

console.log('PASS Firebase test isolation: explicit non-production target required; production project/database rejected');
