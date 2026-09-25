const PRODUCTION_PROJECT = 'sanpokai-tool';
const PRODUCTION_DATABASE = 'https://sanpokai-tool-default-rtdb.firebaseio.com';

function isProductionTarget(projectId, databaseURL) {
  let url = '';
  try { url = new URL(String(databaseURL || '')).origin.toLowerCase(); } catch {}
  return projectId === PRODUCTION_PROJECT || url === PRODUCTION_DATABASE;
}

function parseConfig(raw, label) {
  if (!raw) throw new Error(`${label} is required for Firebase-enabled tests`);
  let config;
  try { config = JSON.parse(raw); } catch { throw new Error(`${label} must be valid JSON`); }
  if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error(`${label} must be a Firebase web config object`);
  return config;
}

export function assertTestFirebaseTarget({ allowed = ['offline', 'emulator', 'staging'] } = {}) {
  const mode = process.env.SANPO_TEST_FIREBASE_TARGET;
  if (!mode || !allowed.includes(mode)) throw new Error(`Set SANPO_TEST_FIREBASE_TARGET to an allowed test target (${allowed.join(', ')})`);
  if (process.env.VITE_REACT_SYNC_MODE === 'production') throw new Error('Production React sync mode is forbidden in tests');
  if ((process.env.SANPO_LIVE_FIREBASE === '1' || process.env.SANPO_BUG_REPORT_STAGING === '1') && mode !== 'staging') {
    throw new Error('Live Firebase browser tests require an explicit staging target');
  }
  for (const name of ['GCLOUD_PROJECT', 'GOOGLE_CLOUD_PROJECT', 'FIREBASE_PROJECT_ID']) {
    if (process.env[name] === PRODUCTION_PROJECT) throw new Error(`Production Firebase project detected in ${name}`);
  }
  if (isProductionTarget('', process.env.FIREBASE_DATABASE_URL)) throw new Error('Production Firebase database URL detected in FIREBASE_DATABASE_URL');
  for (const name of ['VITE_REACT_FIREBASE_CONFIG', 'REACT_FIREBASE_CONFIG', 'FIREBASE_CONFIG', 'SANPO_FIREBASE_CONFIG', 'SANPO_TEST_FIREBASE_CONFIG', 'SANPO_STAGING_FIREBASE_CONFIG']) {
    if (!process.env[name]) continue;
    const config = parseConfig(process.env[name], name);
    if (isProductionTarget(config.projectId, config.databaseURL)) throw new Error(`Production Firebase target detected in ${name}`);
  }

  if (mode === 'offline') {
    const projectId = process.env.SANPO_TEST_FIREBASE_PROJECT_ID;
    const databaseURL = process.env.SANPO_TEST_FIREBASE_DATABASE_URL;
    if (isProductionTarget(projectId, databaseURL)) throw new Error('Production Firebase target detected in test configuration');
    if (!projectId?.startsWith('demo-') || !/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(`${databaseURL || ''}/`)) {
      throw new Error('Offline tests require an explicit demo project and loopback database URL');
    }
  } else if (mode === 'emulator') {
    const projectId = process.env.SANPO_TEST_FIREBASE_PROJECT_ID;
    const databaseURL = process.env.SANPO_TEST_FIREBASE_DATABASE_URL;
    if (isProductionTarget(projectId, databaseURL)) throw new Error('Production Firebase target detected in test configuration');
    if (!projectId?.startsWith('demo-') || !/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(`${databaseURL || ''}/`)) {
      throw new Error('Emulator tests require a demo project and loopback database URL');
    }
  } else if (mode === 'staging') {
    const config = parseConfig(process.env.SANPO_STAGING_FIREBASE_CONFIG, 'SANPO_STAGING_FIREBASE_CONFIG');
    if (!config.projectId || !config.databaseURL || isProductionTarget(config.projectId, config.databaseURL)) {
      throw new Error('Staging Firebase config is missing its target or points to production');
    }
  }
  return Object.freeze({ mode });
}

export function offlineFirebaseConfigScript() {
  assertTestFirebaseTarget();
  return 'window.SANPO_FIREBASE_CONFIG = {};';
}
