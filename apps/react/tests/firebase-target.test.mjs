import test from 'node:test';
import assert from 'node:assert/strict';
import { assertFirebaseTarget } from '../src/sync/firebase-transport.js';

const productionConfig = {
  apiKey: 'public-client-key',
  authDomain: 'sanpokai-tool.firebaseapp.com',
  databaseURL: 'https://sanpokai-tool-default-rtdb.firebaseio.com',
  projectId: 'sanpokai-tool',
  appId: '1:79505558920:web:react-migration',
};

test('production transport accepts only the existing production Firebase project and database', () => {
  assert.doesNotThrow(() => assertFirebaseTarget({ config: productionConfig, mode: 'production' }));
  assert.throws(() => assertFirebaseTarget({ config: { ...productionConfig, projectId: 'demo-test' }, mode: 'production' }), /production project/);
  assert.throws(() => assertFirebaseTarget({ config: { ...productionConfig, databaseURL: 'https://demo-test-default-rtdb.firebaseio.com' }, mode: 'production' }), /production project/);
  assert.throws(() => assertFirebaseTarget({ config: { ...productionConfig, apiKey: '' }, mode: 'production' }), /production project/);
});

test('production target is never inferred from a project name or staging configuration', () => {
  assert.throws(() => assertFirebaseTarget({ config: productionConfig, mode: 'staging', stagingProjectId: 'sanpokai-tool' }), /staging project/);
  assert.throws(() => assertFirebaseTarget({ config: { ...productionConfig, projectId: 'preview-something' }, mode: 'production' }), /production project/);
});

test('emulator and staging transport target checks remain explicit', () => {
  assert.doesNotThrow(() => assertFirebaseTarget({
    config: { projectId: 'demo-circle-react' },
    mode: 'emulator',
    emulator: { host: '127.0.0.1' },
  }));
  assert.doesNotThrow(() => assertFirebaseTarget({
    config: { projectId: 'circle-preview', databaseURL: 'https://circle-preview-default-rtdb.firebaseio.com' },
    mode: 'staging',
    stagingProjectId: 'circle-preview',
  }));
  assert.throws(() => assertFirebaseTarget({
    config: { projectId: 'demo-circle-react' },
    mode: 'emulator',
    emulator: { host: 'example.com' },
  }), /Emulator/);
});
