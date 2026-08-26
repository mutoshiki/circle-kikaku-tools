import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = name => fs.readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const entityContext = vm.createContext({ window: { SanpoClock: { now: () => Date.now(), isServerAligned: () => true } }, console, Date, JSON, Math, Object, Array, Set, Map, String, Number, encodeURIComponent, decodeURIComponent });
vm.runInContext(`${source('assets/js/core/entity-state-v5.js')}\n;globalThis.E = window.SanpoCanonicalState`, entityContext);
const E = entityContext.E;
const syncContext = vm.createContext({
    window: { SanpoCanonicalState: E, SanpoClock: { now: () => Date.now(), isServerAligned: () => true } },
    console, Date, JSON, Math, Object, Array, Set, Map, String, Number, encodeURIComponent, decodeURIComponent,
    APP_SCHEMA_VERSION: 6, CFG: { STORE: 'test' }, roomId: 'R', myClientId: 'sim', migrateAppData: value => E.migrate(value || {}),
    safeJsonParse: JSON.parse, L: { getItem: () => null, setItem() {}, removeItem() {} }, J: JSON,
    isRemoteUpdate: false, dbRef: null, lastSyncedData: null, lastSyncedRevision: 0, pendingRemoteSettlementData: null, pendingRemoteRoomData: null,
    saveRequestVersion: 0, saveTimer: null, syncWriteInFlight: false, isSettlementInputProtected: () => false, isDraggingCards: false,
    manualCardDrag: null, manualSheetDrag: null, isProcessingQueue: false, updateStatus() {}, restore() {}, getData: () => ({}),
    queueMicrotask: fn => fn(), requestAnimationFrame: fn => fn(), editLockEnabled: false, editLockPassphrase: '', editLockScopes: {},
    carPlans: [], activeCarPlanId: '', lastAutoAssignLabel: '', rememberTrustedDevice() {}, updateEditLockButton() {}, refreshRoomTitle() {}, updateUI() {},
    hideAppLoadingSkeleton() {}, requestPassphrasePanel: async () => '', getTrustedDeviceKey: () => '', location: { reload() {} }, set: async () => {}, update: async () => {}, onValue() {}
});
vm.runInContext(`${source('assets/js/core/sync-controller.js')}\n;globalThis.S = window.SanpoEntitySyncTest`, syncContext);
const S = syncContext.S;
const clone = structuredClone;
const keys = value => Object.keys(value || {});
const rng = seed => () => ((seed = Math.imul(seed ^ (seed >>> 15), 1 | seed) + 0x6d2b79f5) >>> 0) / 4294967296;
const pick = (random, list) => list[Math.floor(random() * list.length)];

function makeRoom() {
    const room = E.emptyRoom();
    for (let index = 0; index < 12; index += 1) E.ensureParticipant(room.participants, { name: `P${index}`, updatedAt: index + 1 });
    E.ensureAllParticipantsPlaced(room.allocations.car, room.participants);
    E.ensureAllParticipantsPlaced(room.allocations.team, room.participants);
    return E.migrate(room);
}

function assertInvariants(raw, label) {
    const room = E.migrate(raw);
    const ids = new Set(keys(room.participants));
    for (const type of ['car', 'team']) {
        const allocation = room.allocations[type];
        const owners = new Set();
        for (const [groupId, group] of Object.entries(allocation.groups || {})) {
            assert.ok(ids.has(group.ownerId), `${label}: missing group owner`);
            assert.ok(!owners.has(group.ownerId), `${label}: duplicate group owner`);
            owners.add(group.ownerId);
            assert.equal(allocation.placements[group.ownerId]?.groupId, groupId, `${label}: driver placement mismatch`);
            const members = Object.entries(allocation.placements).filter(([id, placement]) => id !== group.ownerId && placement?.kind === 'member' && placement.groupId === groupId);
            assert.ok(members.length <= Number(group.capacity || 0), `${label}: capacity overflow`);
        }
        for (const id of ids) assert.ok(allocation.placements[id], `${label}: participant missing placement`);
        for (const id of keys(allocation.placements)) assert.ok(ids.has(id), `${label}: orphan placement`);
    }
    for (const id of keys(room.participantTombstones)) assert.equal(room.participants[id], undefined, `${label}: deleted participant resurrected`);
    return room;
}

function mutate(client, random, serial) {
    const room = client.local;
    const ids = keys(room.participants);
    const kind = Math.floor(random() * 6);
    if (kind === 0 && ids.length) {
        const id = pick(random, ids);
        room.participants[id].memo = `tab-${client.id}-${serial}`;
        room.participants[id].updatedAt = serial;
    } else if (kind === 1) {
        const id = E.ensureParticipant(room.participants, { name: `new-${client.id}-${serial}`, updatedAt: serial }, '', room.participantTombstones);
        if (id) for (const type of ['car', 'team']) E.ensureAllParticipantsPlaced(room.allocations[type], room.participants);
    } else if (kind === 2 && ids.length > 3) {
        const id = pick(random, ids);
        room.participantTombstones[id] = { deletedAt: serial };
        delete room.participants[id];
        for (const type of ['car', 'team']) delete room.allocations[type].placements[id];
    } else if (kind === 3 && ids.length) {
        const id = pick(random, ids);
        const allocation = room.allocations.car;
        const groupId = `g_${id}`;
        allocation.groups[groupId] = { id: groupId, ownerId: id, capacity: 1 + Math.floor(random() * 3), order: 0, updatedAt: serial };
        allocation.placements[id] = { kind: 'member', driver: true, groupId, order: 0, updatedAt: serial };
        const member = ids.find(other => other !== id);
        if (member) allocation.placements[member] = { kind: 'member', driver: false, groupId, order: 1, updatedAt: serial };
    } else if (kind === 4 && ids.length) {
        const id = pick(random, ids);
        room.settlement.paidByParticipantId[id] = random() > 0.5;
    } else if (kind === 1 || !ids.length) {
        const id = E.ensureParticipant(room.participants, { name: `new-${client.id}-${serial}`, updatedAt: serial }, '', room.participantTombstones);
        if (id) for (const type of ['car', 'team']) E.ensureAllParticipantsPlaced(room.allocations[type], room.participants);
    } else room.roomName = `room-${serial}`;
    room.lastUpdatedAt = serial;
    room.lastUpdatedBy = client.id;
    client.dirty = true;
}

let commits = 0;
let deliveries = 0;
let duplicateDeliveries = 0;
for (let seed = 1; seed <= 35; seed += 1) {
    const random = rng(seed * 10103);
    let server = makeRoom();
    const clients = Array.from({ length: 5 }, (_, index) => ({ id: `tab-${index + 1}`, base: clone(server), local: clone(server), seq: 0, dirty: false, offline: false }));
    const network = [];
    let serial = seed * 100000;
    let lastRevision = server.revision;
    const deliver = packet => {
        const patch = S.buildEntityPatch(packet.base, packet.local);
        const next = S.applyVersionedEntityPatch(server, packet.base, packet.local, patch, packet.seq, packet.operationId);
        assert.ok(next.revision >= lastRevision, `seed ${seed}: revision regressed`);
        lastRevision = next.revision;
        server = assertInvariants(next, `seed ${seed}/op ${packet.operationId}`);
        deliveries += 1;
    };
    for (let step = 0; step < 130; step += 1) {
        serial += 1;
        if (random() < 0.11) {
            const client = pick(random, clients);
            client.offline = !client.offline;
        }
        if (random() < 0.04) {
            // Root reset races queued writes. Generation must make every pre-reset packet inert.
            const reset = E.emptyRoom();
            reset.resetGeneration = server.resetGeneration + 1;
            reset.revision = server.revision + 1;
            reset.lastUpdatedAt = serial;
            reset.lastUpdatedBy = 'reset-tab';
            server = assertInvariants(E.migrate(reset), `seed ${seed}/reset`);
            lastRevision = server.revision;
        }
        const actors = [...clients].sort(() => random() - 0.5).slice(0, 1 + Math.floor(random() * 5));
        for (const client of actors) mutate(client, random, serial);
        for (const client of clients) {
            if (!client.dirty || client.offline || random() > 0.58) continue;
            client.seq += 1;
            const packet = { base: clone(client.base), local: clone(client.local), seq: client.seq, operationId: `op_${client.id}_${client.seq}` };
            network.push(packet);
            if (random() < 0.35) network.push(clone(packet)); // retry / duplicate transport delivery
            client.dirty = false;
        }
        const due = network.splice(0, Math.min(network.length, Math.floor(random() * 4))).sort(() => random() - 0.5);
        for (const packet of due) {
            const before = server.revision;
            deliver(packet);
            if (server.revision === before) duplicateDeliveries += 1;
        }
        for (const client of clients) if (!client.offline && !client.dirty && random() < 0.4) {
            client.base = clone(server);
            client.local = clone(server);
        }
    }
    for (const client of clients) {
        client.offline = false;
        if (client.dirty) {
            client.seq += 1;
            network.push({ base: clone(client.base), local: clone(client.local), seq: client.seq, operationId: `op_${client.id}_${client.seq}` });
        }
    }
    for (const packet of network.sort(() => random() - 0.5)) deliver(packet);
    server = assertInvariants(server, `seed ${seed}/final`);
    const domain = room => {
        return {
            schemaVersion: room.schemaVersion, roomName: room.roomName, participants: room.participants,
            participantTombstones: room.participantTombstones, allocations: room.allocations,
            settlement: room.settlement, overview: room.overview, resetGeneration: room.resetGeneration,
            revision: room.revision
        };
    };
    for (const client of clients) {
        client.base = clone(server);
        client.local = clone(server);
        assert.equal(JSON.stringify(domain(client.local)), JSON.stringify(domain(server)), `seed ${seed}: tab did not converge`);
    }
    commits += server.revision;
}

console.log(`Sync protocol chaos v68: PASS seeds=35 deliveries=${deliveries} duplicateNoops=${duplicateDeliveries} revisionTotal=${commits}`);
