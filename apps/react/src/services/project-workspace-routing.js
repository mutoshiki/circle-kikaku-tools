import { normalizeWorkspace, TOOL_REGISTRY } from './project-workspace.js';

const byView = new Map(TOOL_REGISTRY.filter(tool => !tool.system).flatMap(tool => [[tool.view, tool.id], [tool.id, tool.id]]));
byView.set('sheet', 'car');

export function requestedToolFromView(view) { return byView.get(String(view || '')) || null; }

export function workspaceTabs(value) {
  const workspace = normalizeWorkspace(value);
  const byId = new Map(TOOL_REGISTRY.map(tool => [tool.id, tool]));
  return [...workspace.tabOrder.filter(id => workspace.tools[id]?.enabled && workspace.tools[id]?.pinned).map(id => byId.get(id)).filter(Boolean), byId.get('tools')];
}

export function resolveWorkspaceSelection(value, requestedTool = null) {
  const workspace = normalizeWorkspace(value);
  const knownTool = TOOL_REGISTRY.some(tool => !tool.system && tool.id === requestedTool);
  const enabled = id => Boolean(workspace.tools[id]?.enabled);
  const pinned = id => enabled(id) && Boolean(workspace.tools[id]?.pinned);
  const fallback = pinned('settlement') ? 'settlement' : workspace.tabOrder.find(pinned) || 'tools';
  if (knownTool && !pinned(requestedTool)) return { tabId: 'tools', toolId: null, hiddenToolId: requestedTool };
  const target = requestedTool && (enabled(requestedTool) || requestedTool === 'tools') ? requestedTool : fallback;
  return {
    tabId: pinned(target) ? target : 'tools',
    toolId: target !== 'tools' && !pinned(target) ? target : null,
  };
}
