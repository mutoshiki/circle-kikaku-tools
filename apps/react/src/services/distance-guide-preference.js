export const DISTANCE_GUIDE_PREFERENCE_KEY = 'sanpo:google-maps-distance-guide:v1:hidden';

export function readDistanceGuideHidden(storage = globalThis.localStorage) {
  try { return storage?.getItem(DISTANCE_GUIDE_PREFERENCE_KEY) === 'true'; }
  catch { return false; }
}

export function writeDistanceGuideHidden(storage = globalThis.localStorage, hidden) {
  try {
    if (hidden) storage?.setItem(DISTANCE_GUIDE_PREFERENCE_KEY, 'true');
    else storage?.removeItem(DISTANCE_GUIDE_PREFERENCE_KEY);
    return true;
  } catch { return false; }
}
