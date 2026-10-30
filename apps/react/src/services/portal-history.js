export const PORTAL_HISTORY_KEY = 'sanpokai_portal_project_history_v1';
const LAST_ROOM_KEY = 'syawari_last_room_id';
const OPENED_AT_PREFIX = 'syawari_last_opened_at_';
const REACT_ROOM_PREFIX = 'sanpo-react:v1:';
const LEGACY_STORE_PREFIX = 'sampokai_v10_split_';
const LEGACY_OUTBOX_PREFIX = `${LEGACY_STORE_PREFIX}sync_outbox_`;
const LEGACY_SYNC_BASE_PREFIX = `${LEGACY_STORE_PREFIX}sync_base_`;
const LEGACY_HISTORY_PREFIX = 'syawari_history_';

function readProjects(storage) {
  try {
    const parsed = JSON.parse(storage.getItem(PORTAL_HISTORY_KEY) || '{"version":1,"projects":[]}');
    return Array.isArray(parsed.projects) ? parsed.projects.filter(project => project?.roomId) : [];
  } catch { return []; }
}

function writeProjects(storage, projects) {
  const value = JSON.stringify({ version: 1, projects });
  if (storage.getItem(PORTAL_HISTORY_KEY) !== value) storage.setItem(PORTAL_HISTORY_KEY, value);
}

function normalizedRoomId(value) { return String(value || '').trim(); }

export function recordPortalVisit(storage, { roomId, name = '', updatedAt = 0 } = {}, openedAt = Date.now()) {
  const id = normalizedRoomId(roomId);
  const visit = Number(openedAt);
  if (!id || !Number.isFinite(visit) || Math.abs(visit) > 8.64e15) return { ok: false, error: new Error('Invalid portal visit') };
  try {
    const projects = readProjects(storage);
    const previous = projects.find(project => project.roomId === id);
    const project = { ...(previous || {}), roomId: id };
    const cleanName = String(name || '').trim();
    if (cleanName) project.name = cleanName;
    const updated = Number(updatedAt);
    if (Number.isFinite(updated) && Math.abs(updated) <= 8.64e15) project.updatedAt = updated;
    project.lastOpenedAt = visit;
    writeProjects(storage, [project, ...projects.filter(item => item.roomId !== id)]);
    storage.setItem(LAST_ROOM_KEY, id);
    storage.setItem(`${OPENED_AT_PREFIX}${id}`, String(visit));
    return { ok: true };
  } catch (error) { return { ok: false, error }; }
}

export function updatePortalProject(storage, { roomId, name = '', updatedAt = 0 } = {}) {
  const id = normalizedRoomId(roomId);
  if (!id) return { ok: false, error: new Error('Invalid room ID') };
  try {
    const projects = readProjects(storage);
    const previous = projects.find(project => project.roomId === id) || { roomId: id };
    const project = { ...previous };
    const cleanName = String(name || '').trim();
    if (cleanName) project.name = cleanName;
    const updated = Number(updatedAt);
    if (Number.isFinite(updated) && Math.abs(updated) <= 8.64e15) project.updatedAt = updated;
    writeProjects(storage, [project, ...projects.filter(item => item.roomId !== id)]);
    return { ok: true };
  } catch (error) { return { ok: false, error }; }
}

function normalizeDate(value) {
  const number = Number(value);
  if (Number.isFinite(number) && number > 0 && number <= 8.64e15) return number;
  if (typeof value === 'string') {
    const date = Date.parse(value);
    if (Number.isFinite(date) && date > 0 && date <= 8.64e15) return date;
  }
  return null;
}

function parseStored(value) {
  try { return { ok: true, value: JSON.parse(value) }; }
  catch { return { ok: false, value: null }; }
}

/**
 * Rebuilds the browser-local project list from the established portal index and
 * the same React/legacy storage namespaces used by the portal. No remote room
 * scan is performed.
 */
export function readPortalProjects(storage) {
  const records = new Map();
  const errors = [];
  let found = false;
  let order = 0;
  const add = (roomId, data = {}, source, openedAt = null) => {
    const id = String(roomId || '').trim();
    if (!id) { errors.push('企画IDが空です'); return; }
    const rows = records.get(id) || [];
    rows.push({
      roomId: id,
      name: String(data.roomName ?? data.name ?? '').trim(),
      updatedAt: normalizeDate(data.lastUpdatedAt ?? data.updatedAt ?? data.meta?.updatedAt),
      lastOpenedAt: normalizeDate(openedAt ?? data.lastOpenedAt ?? data.lastOpened),
      source,
      order: order++,
    });
    records.set(id, rows);
    found = true;
  };
  try {
    const raw = storage.getItem(PORTAL_HISTORY_KEY);
    if (raw !== null) {
      const parsed = parseStored(raw);
      if (!parsed.ok || !Array.isArray(parsed.value?.projects)) errors.push('企画履歴の索引を読み取れません');
      else for (const project of parsed.value.projects) {
        if (!project || typeof project !== 'object' || Array.isArray(project)) { errors.push('企画索引の一部に不正な項目があります'); continue; }
        add(project.roomId, project, 'registry');
      }
    }
  } catch { errors.push('企画履歴の索引にアクセスできません'); }
  try {
    const keys = [];
    for (let index = 0; index < Number(storage.length || 0); index += 1) {
      const key = storage.key(index);
      if (key) keys.push(key);
    }
    for (const key of keys) {
      try {
        if (key.startsWith(REACT_ROOM_PREFIX) && key.endsWith(':room')) {
          const roomId = decodeURIComponent(key.slice(REACT_ROOM_PREFIX.length, -':room'.length));
          const result = parseStored(storage.getItem(key));
          if (!result.ok || !result.value || typeof result.value !== 'object' || Array.isArray(result.value)) { errors.push(`企画データを読み取れません: ${roomId}`); continue; }
          add(roomId, result.value, 'react');
        } else if (key.startsWith(OPENED_AT_PREFIX)) {
          add(key.slice(OPENED_AT_PREFIX.length), {}, 'opened', storage.getItem(key));
        } else if (key.startsWith(LEGACY_SYNC_BASE_PREFIX)) {
          const result = parseStored(storage.getItem(key));
          if (!result.ok) { errors.push('旧企画の同期情報を読み取れません'); continue; }
          add(key.slice(LEGACY_SYNC_BASE_PREFIX.length), result.value || {}, 'legacy');
        } else if (key.startsWith(LEGACY_STORE_PREFIX) && !key.startsWith(LEGACY_OUTBOX_PREFIX)) {
          const result = parseStored(storage.getItem(key));
          if (!result.ok) { errors.push('旧企画データを読み取れません'); continue; }
          add(key.slice(LEGACY_STORE_PREFIX.length), result.value || {}, 'legacy');
        } else if (key.startsWith(LEGACY_HISTORY_PREFIX)) {
          const roomId = key.slice(LEGACY_HISTORY_PREFIX.length);
          const result = parseStored(storage.getItem(key));
          if (!result.ok || !Array.isArray(result.value)) { errors.push(`旧企画履歴を読み取れません: ${roomId}`); continue; }
          const latest = [...result.value].sort((a, b) => (normalizeDate(b?.time) || 0) - (normalizeDate(a?.time) || 0))[0];
          add(roomId, latest?.data || {}, 'legacy', latest?.data?.lastOpenedAt ?? latest?.time);
        }
      } catch { errors.push(`企画データを読み取れません: ${key}`); }
    }
    const lastRoom = String(storage.getItem(LAST_ROOM_KEY) || '').trim();
    if (lastRoom && !records.has(lastRoom)) add(lastRoom, {}, 'opened');
  } catch { errors.push('保存された企画一覧にアクセスできません'); }

  const sourcePriority = { react: 3, legacy: 2, registry: 1, opened: 0 };
  const projects = [...records.entries()].map(([roomId, rows]) => {
    const named = rows.filter(row => row.name).sort((a, b) =>
      (b.updatedAt ?? -Infinity) - (a.updatedAt ?? -Infinity)
      || sourcePriority[b.source] - sourcePriority[a.source]
      || b.order - a.order,
    )[0];
    const max = key => {
      const values = rows.map(row => row[key]).filter(Number.isFinite);
      return values.length ? Math.max(...values) : null;
    };
    return { roomId, name: named?.name || '', updatedAt: max('updatedAt'), lastOpenedAt: max('lastOpenedAt') };
  }).sort((a, b) => (b.lastOpenedAt ?? b.updatedAt ?? 0) - (a.lastOpenedAt ?? a.updatedAt ?? 0) || a.roomId.localeCompare(b.roomId));
  return { status: errors.length ? (projects.length ? 'partial' : 'unavailable') : found ? 'ready' : 'empty', projects, errors };
}
