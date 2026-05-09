// Safe storage utilities used by future refactors.
// app.js also contains compatibility copies while inline handlers remain.

export function safeJsonParse(value, fallback = null) {
  if (value == null || value === "") return fallback;
  try { return JSON.parse(value); }
  catch { return fallback; }
}

export function safeLocalGet(key, fallback = null) {
  try { return safeJsonParse(localStorage.getItem(key), fallback); }
  catch { return fallback; }
}

export function safeLocalSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function safeLocalRemove(key) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
