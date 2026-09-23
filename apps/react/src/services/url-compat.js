export const HANDOFF_TOKEN_PARAM = 'handoff';
export const HANDOFF_TOKEN_PREFIX = 'SANPO_HANDOFF_EXPORT_TOKEN_V1:';
export const validHandoffToken = value => /^h_[A-Za-z0-9_-]{48,160}$/.test(String(value || ''));
export const tokenStorageKey = roomId => `${HANDOFF_TOKEN_PREFIX}${roomId}`;

export function createShareUrl(href) {
  const current = new URL(href);
  const shared = new URL('./', current);
  shared.search = '';
  shared.hash = '';
  const roomId = current.searchParams.get('room');
  if (roomId) shared.searchParams.set('room', roomId);
  return shared.toString();
}

export function prepareCompatibleUrl({ location, history, storage, crypto }) {
  const url = new URL(location.href);
  let roomId = String(url.searchParams.get('room') || '').trim();
  if (!roomId) {
    roomId = crypto.randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase();
    url.searchParams.set('room', roomId);
  }
  const requestedView = url.searchParams.get('view');
  const initialView = requestedView === 'participants' ? 0 : requestedView === 'seisan' ? 3 : 1;
  const launchToken = String(url.searchParams.get(HANDOFF_TOKEN_PARAM) || '');
  if (validHandoffToken(launchToken)) {
    try { storage.setItem(tokenStorageKey(roomId), launchToken); } catch {}
  }
  const handoffToken = validHandoffToken(launchToken) ? launchToken : (() => {
    try { const value = storage.getItem(tokenStorageKey(roomId)); return validHandoffToken(value) ? value : ''; } catch { return ''; }
  })();
  url.searchParams.delete(HANDOFF_TOKEN_PARAM);
  if (requestedView === 'sheet' || url.searchParams.has('allocation')) {
    url.searchParams.delete('view');
    url.searchParams.delete('allocation');
  }
  const next = `${url.pathname}${url.search}${url.hash}`;
  const current = new URL(location.href);
  if (`${current.pathname}${current.search}${current.hash}` !== next) history.replaceState(history.state || null, '', next);
  return { roomId, href: url.href, initialView, handoffToken };
}
