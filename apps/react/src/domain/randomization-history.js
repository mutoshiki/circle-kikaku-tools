const ALLOCATION_TYPES = Object.freeze(['car', 'team']);
const stable = value => JSON.stringify(value);

function participantIds(room) {
  return Object.keys(room?.participants || {}).sort();
}

function fixedIds(room) {
  return participantIds(room).filter(id => room.participants[id]?.locked === true);
}

function allocationConditions(room, type) {
  const allocation = room?.allocations?.[type] || {};
  const groups = Object.entries(allocation.groups || {})
    .map(([id, group]) => ({
      id,
      ownerId: String(group?.ownerId || ''),
      capacity: Math.max(1, Number.parseInt(group?.capacity, 10) || 1),
      order: Number(group?.order) || 0,
    }))
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  const placements = room?.participants ? Object.entries(allocation.placements || {})
    .filter(([id, placement]) => room.participants[id] && (placement?.driver === true || room.participants[id]?.locked === true))
    .map(([id, placement]) => ({
      id,
      driver: placement?.driver === true,
      locked: room.participants[id]?.locked === true,
      kind: placement?.kind === 'member' ? 'member' : 'waiting',
      groupId: placement?.kind === 'member' ? String(placement.groupId || '') : '',
    }))
    .sort((a, b) => a.id.localeCompare(b.id)) : [];
  return { groups, placements };
}

function fixedPlacementConditions(room, type) {
  return allocationConditions(room, type).placements.filter(item => item.locked || item.driver);
}

function conditionParts(room, type) {
  return {
    participantIds: participantIds(room),
    fixedIds: fixedIds(room),
    allocation: allocationConditions(room, type),
  };
}

export function getRandomizationConditionsKey(room, type) {
  if (!ALLOCATION_TYPES.includes(type)) return '';
  return stable(conditionParts(room, type));
}

export function normalizeRandomizationHistory(value, conditionsKey) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
      || value.version !== 1
      || typeof value.epochId !== 'string' || !value.epochId
      || typeof value.conditionsKey !== 'string' || value.conditionsKey !== conditionsKey
      || !value.runs || typeof value.runs !== 'object' || Array.isArray(value.runs)) return null;
  const runs = Object.fromEntries(Object.entries(value.runs)
    .filter(([id, accepted]) => typeof id === 'string' && id.length > 0 && accepted === true)
    .sort(([a], [b]) => a.localeCompare(b)));
  return { version: 1, epochId: value.epochId, conditionsKey, runs };
}

export function getRandomizationStatus(room, type) {
  const conditionsKey = getRandomizationConditionsKey(room, type);
  const history = normalizeRandomizationHistory(room?.allocations?.[type]?.randomization, conditionsKey);
  return { count: Object.keys(history?.runs || {}).length, epochId: history?.epochId || '', conditionsKey };
}

export function createRandomizationHistory(conditionsKey, epochId) {
  if (!conditionsKey || !epochId) throw new TypeError('Randomization history requires a condition key and epoch ID');
  return { version: 1, epochId: String(epochId), conditionsKey, runs: {} };
}

export function hasRandomizationTargets(room, type, assignment) {
  if (!ALLOCATION_TYPES.includes(type) || !assignment?.randomSlotsFromCanonical || !assignment?.isRandomlyMovablePlacement) return false;
  const allocation = room?.allocations?.[type];
  if (!allocation) return false;
  const slots = assignment.randomSlotsFromCanonical(allocation, room?.participants || {});
  if (!slots?.length) return false;
  return Object.entries(allocation.placements || {}).some(([id, placement]) =>
    assignment.isRandomlyMovablePlacement(placement, room?.participants?.[id]));
}

export function getRandomizationConditionChanges(before, after) {
  return ALLOCATION_TYPES.flatMap(type => {
    const previous = conditionParts(before, type);
    const next = conditionParts(after, type);
    if (stable(previous) === stable(next)) return [];
    let reason = 'allocation';
    if (stable(previous.participantIds) !== stable(next.participantIds)) reason = 'participants';
    else if (stable(previous.fixedIds) !== stable(next.fixedIds)
        || stable(fixedPlacementConditions(before, type)) !== stable(fixedPlacementConditions(after, type))) reason = 'fixed';
    return [{ type, reason }];
  });
}

