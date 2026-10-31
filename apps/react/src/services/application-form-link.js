const ROOM_ID = /^[A-Za-z0-9_-]{6,80}$/;
const LINK_TTL_MS = 6 * 60 * 60 * 1000;

function hashHex(bytes) {
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}

function validDate(value) {
  const date = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return '';
  const parsed = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date ? date : '';
}

export async function prepareApplicationFormContext({ roomId, room = {}, transport, cryptoApi = globalThis.crypto, now = Date.now, storage = null } = {}) {
  const id = String(roomId || '').trim();
  if (!ROOM_ID.test(id) || !room || typeof room !== 'object') throw new Error('企画を確認できません。企画画面を開き直してください。');
  if (room.meta?.applicationSync) throw new Error('この企画には応募フォームが連携済みです。');
  if (typeof transport?.reserveApplicationFormLink !== 'function') throw new Error('企画データに接続できません。通信状態を確認して、もう一度お試しください。');
  if (typeof cryptoApi?.randomUUID !== 'function' || typeof cryptoApi?.subtle?.digest !== 'function') throw new Error('このブラウザーでは応募フォームとの連携を開始できません。ブラウザーを更新して、もう一度お試しください。');

  const currentTime = Number(now());
  const saved = storage?.read?.('applicationFormReservation');
  const reusable = saved?.roomId === id && /^[a-f0-9]{32}$/.test(String(saved.jobId || '')) &&
    /^h_[a-f0-9]{64}$/.test(String(saved.token || '')) && /^[a-f0-9]{64}$/.test(String(saved.tokenHash || '')) &&
    Number.isSafeInteger(saved.requestedAt) && Number.isSafeInteger(saved.expiresAt) && saved.expiresAt > currentTime;
  const jobId = reusable ? saved.jobId : cryptoApi.randomUUID().replaceAll('-', '');
  const token = reusable ? saved.token : `h_${cryptoApi.randomUUID().replaceAll('-', '')}${cryptoApi.randomUUID().replaceAll('-', '')}`;
  const tokenHash = reusable ? saved.tokenHash : hashHex(await cryptoApi.subtle.digest('SHA-256', new TextEncoder().encode(token)));
  const requestedAt = reusable ? saved.requestedAt : currentTime;
  const reservation = { schemaVersion: 1, jobId, tokenHash, state: 'pending', requestedAt, expiresAt: reusable ? saved.expiresAt : requestedAt + LINK_TTL_MS };
  const rawName = String(room.meta?.applicationSync?.title || room.roomName || '').trim();
  const projectName = rawName || '新しい企画';
  const context = { version: 1, roomId: id, jobId, token, projectName: projectName.slice(0, 120), eventDate: validDate(room.eventDate || room.meta?.eventDate || room.meta?.applicationSync?.eventDate) };
  if (!reusable && storage?.write) storage.write('applicationFormReservation', { ...context, tokenHash, requestedAt, expiresAt: reservation.expiresAt });
  await transport.reserveApplicationFormLink(id, reservation);
  return context;
}

export async function createApplicationFormHref({ baseHref, roomId, room = {}, transport, cryptoApi = globalThis.crypto, now = Date.now, storage = null } = {}) {
  const payload = await prepareApplicationFormContext({ roomId, room, transport, cryptoApi, now, storage });
  const url = new URL(baseHref);
  url.hash = `sanpo-form-link=${encodeURIComponent(JSON.stringify(payload))}`;
  return url.href;
}

export { ROOM_ID as APPLICATION_FORM_ROOM_ID, LINK_TTL_MS as APPLICATION_FORM_LINK_TTL_MS };
