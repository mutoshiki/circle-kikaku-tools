import { test, expect } from '@playwright/test';

const appModule = `
export function initializeApp(config) {
  globalThis.__firebaseMockConfig = config;
  return { config };
}
`;

const authModule = `
export const browserLocalPersistence = { type: 'LOCAL' };
export const browserSessionPersistence = { type: 'SESSION' };
export const inMemoryPersistence = { type: 'NONE' };
export function initializeAuth(app, options = {}) {
  globalThis.__firebaseMockAuthOptions = {
    persistence: (options.persistence || []).map(item => item && item.type),
    hasPopupRedirectResolver: Object.prototype.hasOwnProperty.call(options, 'popupRedirectResolver')
  };
  return { app };
}
export async function signInAnonymously(auth) {
  globalThis.__firebaseMockSignedIn = true;
  return { user: { uid: 'webkit-anonymous' }, auth };
}
`;

const databaseModule = `
const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
const snapshot = value => ({ val: () => clone(value) });
export function getDatabase(app) { return { app }; }
export function ref(db, path) { return { db, path }; }
export async function set(target, value) {
  if (target.path && target.path.startsWith('rooms/')) globalThis.__firebaseMockRoom = clone(value);
}
export async function update(target, patch) {
  if (!(target.path && target.path.startsWith('rooms/'))) return;
  globalThis.__firebaseMockRoom = { ...(globalThis.__firebaseMockRoom || {}), ...clone(patch) };
}
export function onValue(target, callback) {
  let value = null;
  if (target.path === '.info/serverTimeOffset') value = 0;
  else if (target.path === '.info/connected') value = true;
  else if (target.path && target.path.startsWith('rooms/')) value = globalThis.__firebaseMockRoom ?? null;
  queueMicrotask(() => callback(snapshot(value)));
  return () => {};
}
export async function get(target) {
  if (target.path === '.info/serverTimeOffset') return snapshot(0);
  if (target.path === '.info/connected') return snapshot(true);
  return snapshot(globalThis.__firebaseMockRoom ?? null);
}
export async function runTransaction(target, updater) {
  const current = clone(globalThis.__firebaseMockRoom ?? null);
  const next = updater(current);
  if (next === undefined) return { committed: false, snapshot: snapshot(current) };
  globalThis.__firebaseMockRoom = clone(next);
  return { committed: true, snapshot: snapshot(next) };
}
`;

async function mockFirebaseModules(page) {
  await page.route(/https:\/\/www\.gstatic\.com\/firebasejs\/12\.17\.1\/firebase-(?:app|auth|database)\.js/, async route => {
    const url = route.request().url();
    const body = url.endsWith('/firebase-app.js')
      ? appModule
      : (url.endsWith('/firebase-auth.js') ? authModule : databaseModule);
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      headers: { 'access-control-allow-origin': '*' },
      body
    });
  });
}

for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
  test(`${viewport.width}px WebKit initializes shared sync and persists Carbon project title`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await mockFirebaseModules(page);
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));

    await page.goto('/?room=SAFARI82&view=sheet');
    await page.waitForFunction(() => typeof firebaseReady !== 'undefined' && firebaseReady === true && globalThis.__firebaseMockSignedIn === true);
    await page.waitForFunction(() => document.getElementById('roomNameInput') && customElements.get('cds-text-input'));

    expect(await page.evaluate(() => globalThis.__firebaseMockAuthOptions)).toEqual({
      persistence: ['LOCAL', 'SESSION', 'NONE'],
      hasPopupRedirectResolver: false
    });

    const localState = await page.evaluate(() => {
      const input = document.getElementById('roomNameInput');
      input.value = 'Safari共有企画';
      input.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        composed: true,
        inputType: 'insertText',
        data: '画'
      }));
      input.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
      return {
        source: input.value,
        tag: input.tagName,
        contenteditableCount: document.querySelectorAll('[contenteditable]').length,
        snapshot: getData({ skipDomSync: true }).roomName
      };
    });
    expect(localState).toEqual({
      source: 'Safari共有企画',
      tag: 'CDS-TEXT-INPUT',
      contenteditableCount: 0,
      snapshot: 'Safari共有企画'
    });

    await expect.poll(
      () => page.evaluate(() => globalThis.__firebaseMockRoom?.roomName || ''),
      { timeout: 5000 }
    ).toBe('Safari共有企画');
    await expect(page.locator('#roomNameInput')).toHaveJSProperty('value', 'Safari共有企画');
    expect(errors).toEqual([]);
  });
}
