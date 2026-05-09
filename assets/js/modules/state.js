// Pure state helpers prepared for the next staged JS split.
export function cloneState(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}
export function safeParseJSON(value, fallback = null) {
  try { return JSON.parse(value); } catch { return fallback; }
}
