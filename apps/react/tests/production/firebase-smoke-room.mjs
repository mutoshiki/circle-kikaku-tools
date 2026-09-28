const expectedRoomId = 'P9A93LMQ';
const releaseMarkerPattern = /^react-release-\d+-\d+(?:-updated)?$/;

function assertRoomTarget(roomId, config) {
  if (roomId !== expectedRoomId
    || config.projectId !== 'sanpokai-tool'
    || config.databaseURL !== 'https://sanpokai-tool-default-rtdb.firebaseio.com'
    || !config.apiKey) {
    throw new Error('Production smoke room target guard rejected this operation.');
  }
}

async function runRoomRequest(page, { config, roomId, marker, operation, data, allowPriorReleaseMarker = false }) {
  assertRoomTarget(roomId, config);
  if (!releaseMarkerPattern.test(marker)) throw new Error('Production smoke marker guard rejected this operation.');
  return page.evaluate(async ({ apiKey, databaseURL, roomId, marker, operation, data, allowPriorReleaseMarker }) => {
    const browserReleaseMarkerPattern = /^react-release-\d+-\d+(?:-updated)?$/;
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
      const response = await fetch(roomUrl, { credentials: 'omit', referrerPolicy: 'origin' });
      if (!response.ok) throw new Error(`Production smoke room read failed (${response.status}).`);
      return response.json();
    };
    const existing = await readRoom();
    if (operation === 'seed') {
      if (existing !== null) {
        const priorMarker = existing?.roomName;
        if (typeof priorMarker !== 'string' || !browserReleaseMarkerPattern.test(priorMarker)) {
          throw new Error('Reserved smoke room contains unmarked data; no data was changed.');
        }
        const remove = await fetch(roomUrl, { method: 'DELETE', credentials: 'omit', referrerPolicy: 'origin' });
        if (!remove.ok || await readRoom() !== null) throw new Error('Stale reserved smoke room cleanup could not be verified.');
      }
      const response = await fetch(roomUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'omit',
        referrerPolicy: 'origin',
      });
      if (!response.ok) throw new Error(`Reserved smoke room seed failed (${response.status}).`);
      return 'seeded';
    }
    if (existing === null) return 'already-empty';
    const existingMarker = existing?.roomName;
    if (existingMarker !== marker && existingMarker !== `${marker}-updated`
      && !(allowPriorReleaseMarker && typeof existingMarker === 'string' && browserReleaseMarkerPattern.test(existingMarker))) {
      throw new Error('Reserved smoke room marker does not belong to this release; data was left unchanged.');
    }
    const response = await fetch(roomUrl, { method: 'DELETE', credentials: 'omit', referrerPolicy: 'origin' });
    if (!response.ok || await readRoom() !== null) throw new Error('Reserved smoke room cleanup could not be verified.');
    return 'cleaned';
  }, {
    apiKey: config.apiKey,
    databaseURL: config.databaseURL,
    roomId,
    marker,
    operation,
    data: data ?? null,
    allowPriorReleaseMarker,
  });
}

export function seedProductionSmokeRoom(page, options) {
  return runRoomRequest(page, { ...options, operation: 'seed' });
}

export function cleanupProductionSmokeRoom(page, options) {
  return runRoomRequest(page, { ...options, operation: 'cleanup' });
}
