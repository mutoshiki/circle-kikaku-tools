export function productionSmokeRoomId(marker) {
  const run = /^react-(release|diagnostic)-([1-9]\d{0,19})-([1-9]\d{0,9})$/.exec(marker);
  return run ? `SMOKE-${run[1].toUpperCase()}-${run[2]}-${run[3]}` : '';
}

function assertRoomTarget(roomId, config, marker) {
  if (!roomId || roomId !== productionSmokeRoomId(marker)
    || config.projectId !== 'sanpokai-tool'
    || config.databaseURL !== 'https://sanpokai-tool-default-rtdb.firebaseio.com'
    || !config.apiKey) {
    throw new Error('Production smoke room target guard rejected this operation.');
  }
}

async function runRoomRequest(page, { config, roomId, marker, operation, data }) {
  assertRoomTarget(roomId, config, marker);
  return page.evaluate(async ({ apiKey, databaseURL, roomId, marker, operation, data }) => {
    const authResponse = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ returnSecureToken: true }),
      credentials: 'omit',
      referrerPolicy: 'origin',
    });
    if (!authResponse.ok) throw new Error(`Production smoke browser authentication failed (${authResponse.status}).`);
    const { idToken } = await authResponse.json();
    const roomUrl = new URL(`rooms/${roomId}.json`, `${databaseURL.replace(/\/$/, '')}/`);
    roomUrl.searchParams.set('auth', idToken);
    const readRoom = async () => {
      const response = await fetch(roomUrl, { credentials: 'omit', referrerPolicy: 'origin', headers: { 'X-Firebase-ETag': 'true' } });
      if (!response.ok) throw new Error(`Production smoke room read failed (${response.status}).`);
      return { data: await response.json(), etag: response.headers.get('etag') };
    };
    const existing = await readRoom();
    if (operation === 'seed') {
      if (existing.data !== null) throw new Error('Reserved smoke room already exists; no data was changed.');
      if (data?.roomName !== marker) throw new Error('Production smoke seed ownership marker mismatch.');
      const roomData = data && typeof data === 'object' && !Array.isArray(data) ? { ...data } : data;
      for (const optionalMap of ['participantTombstones', 'syncOperations']) {
        const value = roomData?.[optionalMap];
        if (value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0) {
          delete roomData[optionalMap];
        }
      }
      const response = await fetch(roomUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'If-Match': 'null_etag' },
        body: JSON.stringify(roomData),
        credentials: 'omit',
        referrerPolicy: 'origin',
      });
      if (!response.ok) {
        let reason = '';
        try {
          const error = (await response.clone().json())?.error;
          if (typeof error === 'string') reason = error.replace(/[\r\n]/g, ' ').slice(0, 120);
        } catch { /* Firebase may return a non-JSON error body. */ }
        throw new Error(`Reserved smoke room seed failed (${response.status}${reason ? `: ${reason}` : ''}).`);
      }
      return 'seeded';
    }
    if (existing.data === null) return 'already-empty';
    const existingMarker = existing.data?.roomName;
    if (existingMarker !== marker && existingMarker !== `${marker}-updated`) {
      throw new Error('Reserved smoke room marker does not belong to this release; data was left unchanged.');
    }
    if (!existing.etag) throw new Error('Reserved smoke room cleanup requires a Firebase ETag.');
    const response = await fetch(roomUrl, {
      method: 'DELETE',
      headers: { 'If-Match': existing.etag },
      credentials: 'omit',
      referrerPolicy: 'origin',
    });
    if (!response.ok || (await readRoom()).data !== null) throw new Error('Reserved smoke room cleanup could not be verified.');
    return 'cleaned';
  }, {
    apiKey: config.apiKey,
    databaseURL: config.databaseURL,
    roomId,
    marker,
    operation,
    data: data ?? null,
  });
}

export function seedProductionSmokeRoom(page, options) {
  return runRoomRequest(page, { ...options, operation: 'seed' });
}

export function cleanupProductionSmokeRoom(page, options) {
  return runRoomRequest(page, { ...options, operation: 'cleanup' });
}
