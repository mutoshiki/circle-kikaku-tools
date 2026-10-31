export function createMountainPlanWorkspaceProps({ runtime, room, active = true, onNotice = () => {} }) {
  const sync = room?.meta?.applicationSync || {};
  const projectName = String(sync.title || room?.roomName || '').trim() || '新しい企画';
  const eventDate = String(sync.eventDate || sync.date || room?.eventDate || room?.date || '').trim();
  return {
    project: { roomId: runtime.roomId, projectName, eventDate, ...(runtime.debugSample === true ? { debugSample: true } : {}) },
    active,
    onNotice,
  };
}

export async function loadMountainPlanWorkspace() {
  const module = await import('@sanpokai/mountain-plan-workspace');
  return { default: module.MountainPlanWorkspace };
}
