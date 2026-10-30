const roomIdPattern = /^[A-Za-z0-9_-]{6,80}$/;

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function createMountainPlanHref(baseHref, { roomId, room = {} } = {}) {
  const id = String(roomId || '').trim();
  if (!roomIdPattern.test(id)) return '';
  const sync = room.meta?.applicationSync || {};
  const rawName = String(sync.title || room.roomName || '').trim() || '企画';
  const projectName = rawName.includes('企画') ? rawName : `${rawName}企画`;
  const rawDate = String(sync.eventDate || sync.date || room.eventDate || room.date || '').trim();
  const eventDate = validDate(rawDate) ? rawDate : '';
  const payload = { version: 1, roomId: id, projectName: projectName.slice(0, 120), eventDate };
  const url = new URL(baseHref);
  url.hash = `sanpo-project=${encodeURIComponent(JSON.stringify(payload))}`;
  return url.href;
}
