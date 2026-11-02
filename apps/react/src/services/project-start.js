import { normalizeWorkspace } from './project-workspace.js';

export const PROJECT_LAST_TOOL_PREFIX = 'sanpo-project-last-tool:v1:';
export const projectLastToolKey = roomId => `${PROJECT_LAST_TOOL_PREFIX}${encodeURIComponent(String(roomId || '').trim())}`;

const knownTools = new Set(['application-form', 'submission-documents', 'mountain-plan', 'participants', 'car', 'team', 'settlement', 'tools']);

function visible(workspace, id) {
  return id === 'tools' || Boolean(workspace.tools[id]?.enabled && workspace.tools[id]?.pinned);
}

export function readLastProjectTool(storage, roomId) {
  try {
    const value = storage?.getItem(projectLastToolKey(roomId));
    return knownTools.has(value) ? value : null;
  } catch { return null; }
}

export function writeLastProjectTool(storage, roomId, toolId) {
  if (!roomId || !knownTools.has(toolId)) return false;
  try { storage?.setItem(projectLastToolKey(roomId), toolId); return true; }
  catch { return false; }
}

export function resolveProjectStart({ requestedToolId = null, legacyEntry = false, standalone = false, workspace: value, room = null, lastToolId = null, isNewProject = false } = {}) {
  const workspace = normalizeWorkspace(value);
  if (knownTools.has(requestedToolId)) {
    return { toolId: requestedToolId, reason: 'requested' };
  }
  if (standalone) return { toolId: 'settlement', reason: 'standalone' };
  if (legacyEntry) return { toolId: 'participants', reason: 'legacy' };

  const firstVisible = workspace.tabOrder.find(id => visible(workspace, id)) || 'tools';
  if (isNewProject) {
    if (visible(workspace, 'application-form')) return { toolId: 'application-form', reason: 'new-project-form' };
    if (visible(workspace, 'participants')) return { toolId: 'participants', reason: 'new-project-participants' };
    return { toolId: firstVisible, reason: 'new-project-fallback' };
  }

  if (knownTools.has(lastToolId) && visible(workspace, lastToolId)) return { toolId: lastToolId, reason: 'last-used' };
  if (Object.keys(room?.participants || {}).length > 0 && visible(workspace, 'participants')) return { toolId: 'participants', reason: 'participants-exist' };
  if (visible(workspace, 'application-form')) return { toolId: 'application-form', reason: 'form-available' };
  if (visible(workspace, 'participants')) return { toolId: 'participants', reason: 'participants-fallback' };
  return { toolId: firstVisible, reason: 'first-visible' };
}
