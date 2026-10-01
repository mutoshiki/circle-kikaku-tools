// Read-only UI adapters. Canonical projection/eligibility remain domain-owned.
export function allocationView(room, type, canonical) {
  const projection = canonical.projectAllocation(room, type);
  const label = type === 'team' ? '班' : '車';
  const groups = projection.cars.map(car => {
    const group = room.allocations[type].groups[car.groupId];
    const anchor = { ...room.participants[car.participantId], participantId: car.participantId, driver: car.driver === true };
    const people = [anchor, ...car.members];
    const roles = people.filter(person => person.driver === true);
    const totalLimit = Number(group.capacity) + 1;
    const issues = [];
    if (!roles.length) issues.push({ kind: 'missing-role', groupId: group.id });
    if (people.length > totalLimit) issues.push({ kind: 'over-capacity', groupId: group.id });
    return { id: group.id, name: `${car.name}${label}`, people, roles, peopleCount: people.length, totalLimit, vacancies: Math.max(0, Number(group.capacity) - car.members.length), issues };
  });
  // Distinguish equal anchor names in every consumer (heading, navigation,
  // destination and copy). This is display order, never a new group identity.
  const nameCounts = new Map(), nameOrder = new Map();
  for (const group of groups) nameCounts.set(group.name, (nameCounts.get(group.name) || 0) + 1);
  for (const group of groups) {
    if (nameCounts.get(group.name) < 2) continue;
    const ordinal = (nameOrder.get(group.name) || 0) + 1;
    nameOrder.set(group.name, ordinal);
    group.name = `${group.name}（${ordinal}）`;
  }
  const participantCount = Object.keys(room.participants).length;
  return { type, groups, waiting: projection.waiting, assignedCount: participantCount - projection.waiting.length, participantCount,
    issues: groups.flatMap(group => group.issues) };
}

export function storedAllocationCapacity(totalLimit) {
  const value = typeof totalLimit === 'number' || typeof totalLimit === 'string' && totalLimit.trim() ? Number(totalLimit) : NaN;
  if (!Number.isInteger(value) || value < 2 || value > 100) throw new Error('2〜100人で入力してください。');
  return value - 1;
}

export function randomAllocationReview(room, type, assignment) {
  const allocation = room.allocations[type];
  const people = Object.entries(room.participants).sort(([a], [b]) => a.localeCompare(b));
  const eligibleCount = people.filter(([id, person]) => assignment.isRandomlyMovablePlacement(allocation.placements[id], person)).length;
  const fixedCount = people.filter(([, person]) => person.locked === true).length;
  const roleCount = people.filter(([id]) => allocation.placements[id]?.driver === true).length;
  const fixedWaitingCount = people.filter(([id, person]) => person.locked === true && allocation.placements[id]?.kind === 'waiting').length;
  const scope = JSON.stringify({ resetGeneration: room.resetGeneration, people: people.map(([id, person]) => {
    const p = allocation.placements[id];
    return [id, person.locked === true, p?.kind, p?.groupId, p?.driver === true, p?.order];
  }), groups: Object.entries(allocation.groups).sort(([a], [b]) => a.localeCompare(b)).map(([id, group]) => [id, group.ownerId, group.capacity, group.order]) });
  return { eligibleCount, fixedCount, roleCount, fixedWaitingCount, slotCount: assignment.randomSlotsFromCanonical(allocation, room.participants).length, scope };
}

export function allocationPresentation(view, projectName) {
  const title = view.type === 'team' ? '班割' : '車割';
  const role = view.type === 'team' ? '班長' : '運転手';
  const names = new Map();
  const lines = [projectName, title].filter(Boolean);
  for (const group of view.groups) {
    lines.push('', `${group.name}（${group.peopleCount}人 / 上限${group.totalLimit}人）`);
    for (const person of group.people) {
      lines.push(`${person.driver ? `${role}：` : '・'}${person.name}`);
      names.set(person.name, (names.get(person.name) || 0) + 1);
    }
    if (!group.roles.length) lines.push(`${role}が設定されていません`);
    if (group.issues.some(issue => issue.kind === 'over-capacity')) lines.push('割り当て人数が上限を超えています');
  }
  lines.push('', `未割り当て ${view.waiting.length}人`);
  for (const person of view.waiting) {
    lines.push(`・${person.name}`);
    names.set(person.name, (names.get(person.name) || 0) + 1);
  }
  return { text: lines.join('\n'), duplicateNames: [...names].filter(([, count]) => count > 1).map(([name]) => name) };
}
