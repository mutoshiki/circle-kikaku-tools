import test from 'node:test';
import assert from 'node:assert/strict';
import { createApplicationFormHref } from '../src/services/application-form-link.js';

const cryptoApi = {
  randomUUID: (() => {
    let index = 0;
    return () => `00000000-0000-4000-8000-${String(++index).padStart(12, '0')}`;
  })(),
  subtle: globalThis.crypto.subtle,
};

test('application form handoff reserves the current room and sends only a one-time capability in the URL fragment', async () => {
  const reservations = [];
  const href = await createApplicationFormHref({
    baseHref: 'https://mutoshiki.github.io/sanpokai-kikaku-portal/form-maker/',
    roomId: 'ROOM1234',
    room: { roomName: '秋名山企画', meta: { applicationSync: null }, eventDate: '2026-11-02' },
    transport: { reserveApplicationFormLink: async (roomId, record) => reservations.push({ roomId, record }) },
    cryptoApi,
    now: () => 1000,
  });

  const url = new URL(href);
  assert.equal(url.search, '');
  const payload = JSON.parse(decodeURIComponent(url.hash.slice('#sanpo-form-link='.length)));
  assert.deepEqual(Object.keys(payload).sort(), ['eventDate', 'jobId', 'projectName', 'roomId', 'token', 'version'].sort());
  assert.equal(payload.version, 1);
  assert.equal(payload.roomId, 'ROOM1234');
  assert.equal(payload.projectName, '秋名山企画');
  assert.equal(payload.eventDate, '2026-11-02');
  assert.match(payload.token, /^h_[a-f0-9]{64}$/);
  assert.equal(reservations.length, 1);
  assert.equal(reservations[0].roomId, 'ROOM1234');
  assert.equal(reservations[0].record.jobId, payload.jobId);
  assert.equal(reservations[0].record.tokenHash, await hashToken(payload.token));
  assert.equal(JSON.stringify(reservations).includes(payload.token), false);
});

test('application form handoff rejects an already linked or invalid room before making a reservation', async () => {
  let called = false;
  await assert.rejects(createApplicationFormHref({
    baseHref: 'https://example.com/form-maker/',
    roomId: 'bad/id',
    room: { roomName: '企画' },
    transport: { reserveApplicationFormLink: async () => { called = true; } },
    cryptoApi,
  }), /企画ルームを確認できません/);
  await assert.rejects(createApplicationFormHref({
    baseHref: 'https://example.com/form-maker/',
    roomId: 'ROOM1234',
    room: { meta: { applicationSync: { formId: 'existing' } } },
    transport: { reserveApplicationFormLink: async () => { called = true; } },
    cryptoApi,
  }), /すでに応募フォームが連携されています/);
  assert.equal(called, false);
});

async function hashToken(token) {
  const digest = await cryptoApi.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
