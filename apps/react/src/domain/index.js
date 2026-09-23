import { createCanonicalEngine } from './generated/canonical.js';
import { withAllocationRoles } from './generated/roles.js';
import { createMigration } from './generated/migration.js';
import { createSettlementDomain } from './generated/settlement.js';
import { createSyncDomain } from './generated/sync.js';
import { createAssignmentDomain } from './generated/allocation.js';
import { createApplicantsDomain } from './generated/applicants.js';
export { formParser } from './generated/parser.js';

export function createDomain({ clock = { now: () => Date.now(), isServerAligned: () => false }, clientId = 'local', random = Math.random, crypto = globalThis.crypto } = {}) {
  const canonical = withAllocationRoles(createCanonicalEngine({ clock }));
  const migrate = createMigration(canonical);
  const settlement = createSettlementDomain({ crypto, random, clientId });
  const sync = createSyncDomain({ migrate, clock, clientId });
  const assignment = createAssignmentDomain({ random, clock });
  function settlementInput(room) {
    const state = settlement.normalizeSettlementState(canonical.settlementToUi(room.settlement, room.participants));
    const data = settlement.hasStandaloneSettlementCounts(state)
      ? settlement.createStandaloneSettlementData(state, room.roomName)
      : { ...canonical.projectAllocation(room, 'car'), roomName: room.roomName };
    return { data, state };
  }
  return { canonical, migrate, settlement, sync, assignment, settlementInput, applicants: createApplicantsDomain(canonical) };
}
