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

export async function createApplicationFormHref({ baseHref, roomId, room = {}, transport, cryptoApi = globalThis.crypto, now = Date.now } = {}) {
  const id = String(roomId || '').trim();
  if (!ROOM_ID.test(id) || !room || typeof room !== 'object') throw new Error('企画を確認できません。企画画面を開き直してください。');
  if (room.meta?.applicationSync) throw new Error('この企画には応募フォームが連携済みです。');
  if (typeof transport?.reserveApplicationFormLink !== 'function') throw new Error('企画データに接続できません。通信状態を確認して、もう一度お試しください。');
  if (typeof cryptoApi?.randomUUID !== 'function' || typeof cryptoApi?.subtle?.digest !== 'function') throw new Error('このブラウザーでは応募フォームとの連携を開始できません。ブラウザーを更新して、もう一度お試しください。');

  const jobId = cryptoApi.randomUUID().replaceAll('-', '');
  const token = `h_${cryptoApi.randomUUID().replaceAll('-', '')}${cryptoApi.randomUUID().replaceAll('-', '')}`;
  const tokenHash = hashHex(await cryptoApi.subtle.digest('SHA-256', new TextEncoder().encode(token)));
  const requestedAt = Number(now());
  const reservation = { schemaVersion: 1, jobId, tokenHash, state: 'pending', requestedAt, expiresAt: requestedAt + LINK_TTL_MS };
  await transport.reserveApplicationFormLink(id, reservation);

  const rawName = String(room.meta?.applicationSync?.title || room.roomName || '').trim();
  const projectName = rawName || '新しい企画';
  const payload = { version: 1, roomId: id, jobId, token, projectName: projectName.slice(0, 120), eventDate: validDate(room.eventDate || room.meta?.eventDate || room.meta?.applicationSync?.eventDate) };
  const url = new URL(baseHref);
  url.hash = `sanpo-form-link=${encodeURIComponent(JSON.stringify(payload))}`;
  return url.href;
}

export { ROOM_ID as APPLICATION_FORM_ROOM_ID, LINK_TTL_MS as APPLICATION_FORM_LINK_TTL_MS };
