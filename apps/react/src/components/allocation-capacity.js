export function getCapacitySummary(type, storedCapacity, memberCount) {
  const totalCapacity = Number(storedCapacity) + (type === 'car' ? 1 : 0);
  const occupied = Number(memberCount) + 1;
  return { occupied, totalCapacity, remaining: Math.max(0, totalCapacity - occupied) };
}

export function toStoredCapacity(type, totalCapacity) {
  return Number(totalCapacity) - (type === 'car' ? 1 : 0);
}
