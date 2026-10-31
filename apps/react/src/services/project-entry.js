export const PROJECT_CREATE_INTENT_PREFIX = 'sanpo-project-create:v1:';

export function resolveEntryScreen(href) {
  const url = new URL(href);
  if (String(url.searchParams.get('room') || '').trim()) return null;
  if (url.searchParams.get('legacy') === '1') return null;
  if (url.searchParams.get('debugSample') === 'all-tools') return null;
  return url.searchParams.get('screen') === 'create' ? 'create' : 'list';
}

export function creationIntentKey(roomId) {
  return `${PROJECT_CREATE_INTENT_PREFIX}${String(roomId || '').trim()}`;
}

export function readCreationIntent(storage, roomId) {
  try {
    const value = storage?.getItem(creationIntentKey(roomId));
    if (!value) return null;
    const intent = JSON.parse(value);
    if (intent?.roomId !== String(roomId || '').trim() || !intent.workspace || typeof intent.workspace !== 'object') return null;
    return intent;
  } catch { return null; }
}
