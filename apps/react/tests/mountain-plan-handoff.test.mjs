import test from 'node:test';
import assert from 'node:assert/strict';
import { createMountainPlanHref } from '../src/services/mountain-plan-handoff.js';

test('mountain maker handoff uses a versioned URL fragment with only supported project metadata', () => {
  const href = createMountainPlanHref('https://example.test/maker/', {
    roomId: 'ROOM-42',
    room: {
      roomName: '秋名山登山',
      meta: { applicationSync: { title: '秋名山登山', eventDate: '2026-11-02' } },
      participants: [{ id: 'private', name: '個人情報' }],
    },
  });
  const url = new URL(href);
  const query = new URLSearchParams(url.hash.slice(1));

  assert.equal(url.origin + url.pathname, 'https://example.test/maker/');
  assert.deepEqual(JSON.parse(query.get('sanpo-project')), {
    version: 1,
    roomId: 'ROOM-42',
    projectName: '秋名山登山企画',
    eventDate: '2026-11-02',
  });
});

test('mountain maker handoff leaves missing or invalid dates empty and rejects invalid room IDs', () => {
  const href = createMountainPlanHref('https://example.test/maker/', {
    roomId: 'ROOM-42',
    room: { roomName: '企画', eventDate: 'not-a-date' },
  });
  assert.equal(JSON.parse(new URLSearchParams(new URL(href).hash.slice(1)).get('sanpo-project')).eventDate, '');
  assert.equal(createMountainPlanHref('https://example.test/maker/', { roomId: 'x', room: {} }), '');
});
