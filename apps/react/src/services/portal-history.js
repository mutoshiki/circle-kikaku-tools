export const PORTAL_HISTORY_KEY = 'sanpokai_portal_project_history_v1';
const LAST_ROOM_KEY = 'syawari_last_room_id';
const OPENED_AT_PREFIX = 'syawari_last_opened_at_';

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
