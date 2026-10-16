import { createDomain } from '../domain/index.js';
import { applicantIdentity, rememberApplicantIdentity } from '../services/applicant-identity.js';

const clone = value => structuredClone(value);
function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

export function createRoomStore({ initial = {}, clientId = 'local', clock = { now: () => Date.now(), isServerAligned: () => false }, random, crypto = globalThis.crypto } = {}) {
  const domain = createDomain({ clientId, clock, random, crypto });
  let snapshot = freeze(domain.migrate(initial));
  let sequence = 0;
  let liveApplicationMetadata;
  const listeners = new Set();
  const intentListeners = new Set();
  const sessions = new Set();
  const notify = () => { for (const listener of listeners) listener(); };
  const requireParticipant = (room, id) => {
    if (!room.participants[id] || room.participantTombstones[id]) throw new Error('参加者が削除されています。');
    return room.participants[id];
  };
  const requireAllocation = (room, type) => {
    if (!['car', 'team'].includes(type)) throw new Error('割り当ての種類が不正です。');
    return room.allocations[type];
  };
  const createRandomizationId = () => {
    if (typeof crypto?.randomUUID !== 'function') throw new Error('ランダム割り当ての記録に必要なIDを作成できません。');
    return crypto.randomUUID();
  };
  const syncApplicantVehicle = (room, id, applicant) => {
    const now = clock.now();
    if (applicant.canDrive === true) return domain.applicants.ensureDriver(room, id, applicant, now);
    const allocation = room.allocations.car;
    const ownedGroupIds = Object.entries(allocation.groups).filter(([, group]) => group.ownerId === id).map(([groupId]) => groupId);
    for (const groupId of ownedGroupIds) {
      delete allocation.groups[groupId];
      for (const [participantId, placement] of Object.entries(allocation.placements)) {
        if (placement.groupId === groupId) allocation.placements[participantId] = { ...placement, kind: 'waiting', groupId: '', driver: participantId === id ? false : placement.driver === true, updatedAt: now };
      }
    }
    if (allocation.placements[id]?.driver) allocation.placements[id] = { ...allocation.placements[id], driver: false, updatedAt: now };
    return ownedGroupIds.length > 0;
  };

  function publish(base, local, { patch: explicitPatch, precondition = null, kind = 'edit', randomizationIntent = null } = {}) {
    if (Number(base.resetGeneration) !== Number(snapshot.resetGeneration)) throw new Error('企画がリセットされました。画面を開き直してください。');
    const randomizationResets = [];
    for (const change of domain.randomization.getRandomizationConditionChanges(base, local)) {
      const previous = base.allocations?.[change.type]?.randomization;
      const beforeStatus = domain.randomization.getRandomizationStatus(base, change.type);
      if (previous?.epochId) {
        const conditionsKey = domain.randomization.getRandomizationConditionsKey(local, change.type);
        local.allocations[change.type].randomization = domain.randomization.createRandomizationHistory(conditionsKey, createRandomizationId());
      } else if (local.allocations?.[change.type]) {
        delete local.allocations[change.type].randomization;
      }
      if (beforeStatus.count > 0) randomizationResets.push(change);
    }
    if (randomizationIntent) {
      const currentKey = domain.randomization.getRandomizationConditionsKey(local, randomizationIntent.type);
      if (currentKey !== randomizationIntent.conditionsKey) throw new Error('割り当て条件が変更されました。最新の状態でやり直してください。');
    }
    local.lastUpdatedAt = clock.now();
    local.lastUpdatedBy = clientId;
    for (const [id, participant] of Object.entries(local.participants || {})) {
      if (JSON.stringify(participant) !== JSON.stringify(base.participants?.[id])) participant.updatedAt = clock.now();
    }
    const patch = explicitPatch || domain.sync.buildEntityPatch(base, local);
    for (const type of ['car', 'team']) {
      if (JSON.stringify(base.allocations?.[type]?.randomization) !== JSON.stringify(local.allocations?.[type]?.randomization)) {
        patch[`allocations/${type}/randomization`] = clone(local.allocations?.[type]?.randomization ?? null);
      }
    }
    const baseApplicantIds = base.meta?.applicantParticipantIds || {};
    const localApplicantIds = local.meta?.applicantParticipantIds || {};
    for (const key of new Set([...Object.keys(baseApplicantIds), ...Object.keys(localApplicantIds)])) {
      if (baseApplicantIds[key] !== localApplicantIds[key]) patch[`meta/applicantParticipantIds/${key}`] = localApplicantIds[key] ?? null;
    }
    if (!domain.sync.patchHasDomainChanges(patch)) return null;
    // A draft owns only changed paths. Keep unrelated remote fields and merge
    // expense rows by stable ID, using the same legacy three-way merge.
    const mergedPatch = clone(patch);
    for (const path of Object.keys(mergedPatch)) {
      if (/^settlement\/carsBy(?:ParticipantId|Name)\/[^/]+\/extras$/.test(path)) {
        mergedPatch[path] = domain.sync.mergeConcurrentSettlementExtras(
          domain.sync.getSyncPathValue(base, path), domain.sync.getSyncPathValue(snapshot, path), patch[path], true, path,
        );
      }
    }
    const next = domain.sync.applyEntityPatchToObject(snapshot, mergedPatch);
    // Application metadata is maintained as a separate sync stream, but local
    // form-linked samples must still paint and persist their metadata immediately.
    if (domain.applicants.validApplicationSync(local.meta?.applicationSync)) {
      next.meta ||= {};
      next.meta.applicationSync = clone(local.meta.applicationSync);
      liveApplicationMetadata = clone(local.meta.applicationSync);
    }
    snapshot = freeze(domain.migrate(next));
    const intent = freeze({ base: clone(base), local: clone(local), patch: clone(patch), precondition: clone(precondition), sequence: ++sequence, kind, ...(randomizationIntent ? { randomizationIntent: clone(randomizationIntent) } : {}), ...(randomizationResets.length ? { randomizationResets: clone(randomizationResets) } : {}) });
    notify();
    for (const listener of intentListeners) listener(intent);
    return intent;
  }

  const commands = {
    rename(room, { name }) { room.roomName = String(name); },
    overview(room, { overview }) { room.overview = clone(overview); },
    addParticipants(room, { people, type = 'car' }) {
      for (const person of people) {
        const id = domain.canonical.ensureParticipant(room.participants, person, '', room.participantTombstones);
        if (!id) continue;
        for (const allocation of Object.values(room.allocations)) domain.canonical.ensureAllParticipantsPlaced(allocation, room.participants);
        if (person.driver === true) domain.applicants.ensureDriver(room, id, { canDrive: true, capacity: person.capacity }, clock.now());
      }
    },
    editParticipant(room, { id, changes }) {
      const person = requireParticipant(room, id);
      for (const field of ['name', 'memo', 'grade', 'flag', 'locked']) if (Object.hasOwn(changes, field)) person[field] = changes[field];
      if (!String(person.name || '').trim()) throw new Error('名前を入力してください。');
      person.updatedAt = clock.now();
    },
    deleteParticipant(room, { id }) {
      requireParticipant(room, id);
      domain.canonical.deleteParticipant(id, { deletedAt: clock.now() });
    },
    role(room, { id, type, driver }) {
      requireParticipant(room, id);
      const allocation = requireAllocation(room, type);
      allocation.placements[id] = { ...allocation.placements[id], driver: driver === true, updatedAt: clock.now() };
    },
    createGroup(room, { type, ownerId, capacity, id }) {
      requireParticipant(room, ownerId);
      const allocation = requireAllocation(room, type);
      const baseId = `g_${type}_${ownerId.replace(/[^A-Za-z0-9_-]/g, '_')}`;
      let groupId = id || baseId;
      let suffix = 2;
      while (allocation.groups[groupId]) groupId = `${baseId}_${suffix++}`;
      const now = clock.now();
      const order = Object.values(allocation.groups).reduce((highest, group) => Math.max(highest, Number(group.order || 0)), -1) + 1;
      const displayIndex = Math.max(1, Number(allocation.nextDisplayIndex) || 1, ...Object.values(allocation.groups).map(group => (Number(group.displayIndex) || 0) + 1));
      allocation.nextDisplayIndex = displayIndex + 1;
      allocation.groups[groupId] = { id: groupId, ownerId, capacity: Math.max(1, Math.min(type === 'team' ? 100 : 99, parseInt(capacity) || (type === 'team' ? 5 : 3))), order, displayIndex, createdAt: now, updatedAt: now };
      allocation.placements[ownerId] = { kind: 'member', groupId, driver: true, order, updatedAt: now };
      domain.canonical.ensureAllParticipantsPlaced(allocation, room.participants);
    },
    capacity(room, { type, groupId, capacity }) {
      const allocation = requireAllocation(room, type);
      if (!allocation.groups[groupId]) throw new Error('グループが削除されています。');
      allocation.groups[groupId].capacity = Math.max(1, parseInt(capacity) || 1);
      allocation.groups[groupId].updatedAt = clock.now();
      domain.canonical.ensureAllParticipantsPlaced(allocation, room.participants);
    },
    deleteGroup(room, { type, groupId }) {
      const allocation = requireAllocation(room, type);
      delete allocation.groups[groupId];
      domain.canonical.ensureAllParticipantsPlaced(allocation, room.participants);
    },
    move(room, { id, type, groupId = '', order = 0 }) {
      requireParticipant(room, id);
      const allocation = requireAllocation(room, type);
      if (groupId && !allocation.groups[groupId]) throw new Error('移動先が削除されています。');
      const sourceGroupEntry = Object.entries(allocation.groups).find(([, group]) => group.ownerId === id);
      const sourceGroupId = sourceGroupEntry?.[0];
      const sourceGroup = sourceGroupEntry?.[1];
      if (sourceGroupId && sourceGroupId === groupId) return;
      if (groupId) {
        const group = allocation.groups[groupId];
        const memberCount = Object.entries(allocation.placements).filter(([participantId, placement]) => participantId !== id
          && participantId !== group.ownerId && placement?.kind === 'member' && placement.groupId === groupId).length;
        const memberCapacity = Math.max(0, group.capacity - (type === 'team' ? 1 : 0));
        if (id !== group.ownerId && memberCount >= memberCapacity) throw new Error('空席がありません。');
      }
      if (sourceGroup) {
        const replacements = Object.entries(allocation.placements)
          .filter(([participantId, placement]) => participantId !== id && placement?.kind === 'member' && placement.groupId === sourceGroupId)
          .sort(([idA, a], [idB, b]) => (Number(a?.order) || 0) - (Number(b?.order) || 0) || String(idA).localeCompare(String(idB)));
        if (replacements.length) {
          sourceGroup.ownerId = replacements[0][0];
          sourceGroup.updatedAt = clock.now();
        } else {
          delete allocation.groups[sourceGroupId];
        }
      }
      allocation.placements[id] = { kind: groupId ? 'member' : 'waiting', driver: allocation.placements[id]?.driver === true, groupId, order, updatedAt: clock.now() };
      domain.canonical.ensureAllParticipantsPlaced(allocation, room.participants);
    },
    randomize(room, { type }) {
      requireAllocation(room, type);
      return domain.assignment.assign(room, type, domain.canonical);
    },
    applySelection(room, { selectedApplicants, selectedManual }) {
      const application = room.meta?.applicationSync;
      const entries = domain.applicants.applicantEntries(domain.applicants.validApplicationSync(application) ? application : null);
      const accepted = new Set(entries.map(([key, applicant]) => {
        const identity = applicantIdentity(room, key, applicant, domain.applicants);
        if (identity.id && !room.meta?.applicantParticipantIds?.[key]) rememberApplicantIdentity(room, key, identity.id);
        return identity.id;
      }).filter(Boolean));
      const remove = new Set();
      for (const [key, applicant] of entries) {
        const { id } = applicantIdentity(room, key, applicant, domain.applicants);
        if (id && !selectedApplicants.includes(key)) remove.add(id);
      }
      for (const id of Object.keys(room.participants)) if (!accepted.has(id) && !selectedManual.includes(id)) remove.add(id);
      for (const id of remove) domain.canonical.deleteParticipant(id, { deletedAt: clock.now() });
      for (const [key, applicant] of entries) {
        const identity = applicantIdentity(room, key, applicant, domain.applicants);
        if (!selectedApplicants.includes(key) || identity.id || identity.deleted) continue;
        const id = domain.canonical.ensureParticipant(room.participants, { name: applicant.name, memo: '', grade: Math.max(0, Math.min(4, parseInt(applicant.grade) || 0)), locked: false, flag: 'none' }, '', room.participantTombstones);
        if (id) {
          rememberApplicantIdentity(room, key, id);
          syncApplicantVehicle(room, id, applicant);
        }
      }
      for (const allocation of Object.values(room.allocations)) domain.canonical.ensureAllParticipantsPlaced(allocation, room.participants);
    },
    syncApplicantDetails(room) {
      const application = room.meta?.applicationSync;
      if (!domain.applicants.validApplicationSync(application)) return;
      for (const [key, applicant] of domain.applicants.applicantEntries(application)) {
        const identity = applicantIdentity(room, key, applicant, domain.applicants);
        const id = identity.id;
        if (!id) continue;
        if (!room.meta?.applicantParticipantIds?.[key]) rememberApplicantIdentity(room, key, id);
        const grade = Math.max(0, Math.min(4, parseInt(applicant.grade) || 0));
        const name = String(applicant.name || '').trim();
        if (name && (room.participants[id].name !== name || room.participants[id].grade !== grade)) Object.assign(room.participants[id], { name, grade, updatedAt: clock.now() });
        syncApplicantVehicle(room, id, applicant);
      }
      for (const allocation of Object.values(room.allocations)) domain.canonical.ensureAllParticipantsPlaced(allocation, room.participants);
    },
    settlement(room, { state }) {
      room.settlement = domain.canonical.settlementToStorage(domain.settlement.normalizeSettlementState(state), room.participants);
    },
    restore(room, { value }) {
      const restored = domain.migrate(value);
      // Normal samples have no metadata and keep the live application metadata;
      // an explicit form-linked sample owns its applicationSync payload.
      const restoredMeta = restored.meta && Object.keys(restored.meta).length ? restored.meta : room.meta;
      Object.assign(room, restored, { resetGeneration: room.resetGeneration, meta: clone(restoredMeta || {}) });
    },
  };

  function command(name, args = {}) {
    if (!commands[name]) throw new Error(`Unknown command: ${name}`);
    const base = snapshot;
    const local = domain.canonical.set(base);
    if (name === 'randomize' && !domain.randomization.hasRandomizationTargets(local, args.type, domain.assignment)) return null;
    const result = commands[name](local, args);
    if (name === 'randomize' && result === false) return null;
    const migrated = domain.migrate(local);
    let randomizationIntent = null;
    if (name === 'randomize') {
      const type = args.type;
      const conditionsKey = domain.randomization.getRandomizationConditionsKey(migrated, type);
      let history = domain.randomization.normalizeRandomizationHistory(migrated.allocations[type].randomization, conditionsKey);
      if (!history) history = domain.randomization.createRandomizationHistory(conditionsKey, createRandomizationId());
      const runId = createRandomizationId();
      history.runs[runId] = true;
      migrated.allocations[type].randomization = history;
      randomizationIntent = { type, epochId: history.epochId, conditionsKey, runIds: [runId] };
    }
    return publish(base, migrated, { kind: name, randomizationIntent });
  }
  function beginEdit({ kind, participantId = '', scope = '' } = {}) {
    const session = { kind, participantId, scope, base: clone(snapshot), draft: clone(snapshot), closed: false };
    sessions.add(session);
    return session;
  }
  function cancelEdit(session) { session.closed = true; sessions.delete(session); }
  function commitEdit(session, { close = true, precondition = session.precondition || null } = {}) {
    if (!sessions.has(session) || session.closed) throw new Error('編集は終了しています。');
    if (session.participantId) requireParticipant(snapshot, session.participantId);
    let patch;
    if (session.scope === 'settlement-settings') patch = domain.sync.buildSettlementSettingsIntentPatch(session.base, session.draft);
    else if (session.scope === 'settlement-car') patch = domain.sync.buildSettlementCarIntentPatch(session.base, session.draft, { participantId: session.participantId, name: session.name || '' });
    const intent = publish(session.base, session.draft, { patch, precondition, kind: session.kind || 'draft' });
    if (close) cancelEdit(session);
    return intent;
  }
  function receiveRemote(room) {
    if (domain.sync.isUnsupportedRemoteSchema(room)) throw new Error('この企画は新しいバージョンで作成されています。');
    const incoming = domain.migrate(room);
    if (liveApplicationMetadata !== undefined) {
      incoming.meta ||= {};
      if (liveApplicationMetadata) incoming.meta.applicationSync = clone(liveApplicationMetadata);
      else delete incoming.meta.applicationSync;
    }
    snapshot = freeze(incoming);
    // Open session drafts deliberately remain untouched, including IME text.
    notify();
  }
  function receiveApplicationMetadata(value) {
    liveApplicationMetadata = domain.applicants.validApplicationSync(value) ? clone(value) : null;
    receiveRemote(snapshot);
  }
  return Object.freeze({
    getSnapshot: () => snapshot,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    subscribeIntents(listener) { intentListeners.add(listener); return () => intentListeners.delete(listener); },
    command, beginEdit, cancelEdit, commitEdit, receiveRemote, receiveApplicationMetadata, domain,
    participantIdForApplicant(responseKey, applicant) { return applicantIdentity(snapshot, responseKey, applicant, domain.applicants).id; },
    getOpenEditCount: () => sessions.size,
  });
}
