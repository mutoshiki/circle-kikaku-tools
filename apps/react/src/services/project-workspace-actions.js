import { normalizeWorkspace, TOOL_REGISTRY } from './project-workspace.js';

const toolIds = new Set(TOOL_REGISTRY.filter(tool => !tool.system).map(tool => tool.id));

export function setToolTabVisibility(value, toolId, visible) {
  const workspace = normalizeWorkspace(value);
  if (!toolIds.has(toolId)) return workspace;
  const shown = visible === true;
  const tools = {
    ...workspace.tools,
    [toolId]: { enabled: shown, pinned: shown },
  };
  const tabOrder = shown
    ? (workspace.tabOrder.includes(toolId) ? workspace.tabOrder : [...workspace.tabOrder, toolId])
    : workspace.tabOrder.filter(id => id !== toolId);
  return normalizeWorkspace({ ...workspace, tools, tabOrder });
}

export function setToolAvailability(value, toolId, enabled) {
  if (!toolIds.has(toolId)) return normalizeWorkspace(value);
  const workspace = normalizeWorkspace(value);
  const current = workspace.tools[toolId] || { enabled: false, pinned: false };
  const nextTools = { ...workspace.tools, [toolId]: { enabled: enabled === true, pinned: enabled === true && current.pinned } };
  const tabOrder = enabled === true
    ? workspace.tabOrder
    : workspace.tabOrder.filter(id => id !== toolId);
  return normalizeWorkspace({ ...workspace, tools: nextTools, tabOrder });
}

export function setToolPinned(value, toolId, pinned) {
  const workspace = normalizeWorkspace(value);
  if (!toolIds.has(toolId) || !workspace.tools[toolId]?.enabled) return workspace;
  const current = workspace.tools[toolId];
  const tabOrder = workspace.tabOrder.filter(id => id !== toolId);
  if (pinned === true) tabOrder.push(toolId);
  return normalizeWorkspace({ ...workspace, tools: { ...workspace.tools, [toolId]: { ...current, pinned: pinned === true } }, tabOrder });
}

export function movePinnedTool(value, toolId, targetIndex) {
  const workspace = normalizeWorkspace(value);
  const currentIndex = workspace.tabOrder.indexOf(toolId);
  if (currentIndex < 0) return workspace;
  const tabOrder = [...workspace.tabOrder];
  tabOrder.splice(currentIndex, 1);
  tabOrder.splice(Math.max(0, Math.min(tabOrder.length, Math.floor(Number(targetIndex) || 0))), 0, toolId);
  return normalizeWorkspace({ ...workspace, tabOrder });
}
