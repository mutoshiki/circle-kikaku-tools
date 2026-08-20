import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';

const require = createRequire(import.meta.url);
const { SEND_LEASE_MS, acquireLeaseState, sentState, failedState } = require('../functions/notification-state.js');
const rules = readFileSync(new URL('../firebase/database.rules.json', import.meta.url), 'utf8');
const projectId = 'demo-circle-kikaku-tools';
const validRoomId = 'RULES67A';
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

function canonicalRoom() {
    return {
        schemaVersion: 6,
        roomName: 'Emulator verification',
        participants: {},
        participantTombstones: {},
        allocations: {
            car: { id: 'car', type: 'car', name: '車割', groups: {}, placements: {}, lastAutoAssignLabel: '', updatedAt: 1 },
            team: { id: 'team', type: 'team', name: '班割', groups: {}, placements: {}, lastAutoAssignLabel: '', updatedAt: 1 }
        },
        activeAllocationType: 'car',
        trayMinimized: false,
        editLockEnabled: false,
        editLockPassphrase: '',
        editLockScopes: { allocation: false, settlement: false },
        settlement: {},
        overview: {},
        meta: {},
        resetGeneration: 0,
        lastUpdatedAt: 1,
        lastUpdatedBy: 'emulator-test',
        revision: 0
    };
}

function canonicalBugReport() {
    return {
        message: '精算画面で金額が反映されない',
        createdAt: Date.now(),
        roomId: validRoomId,
        pageUrl: `https://example.test/?room=${validRoomId}`,
        buildId: 'test-build',
        projectTitle: 'テスト企画',
        currentView: '精算',
        userAgent: 'Mozilla/5.0 test',
        platform: 'TestOS'
    };
}

async function mustPass(label, action) {
    try {
        return await action();
    } catch (error) {
        throw new Error(`${label}: expected success, got ${error?.message || error}`);
    }
}

async function mustFail(label, action) {
    try {
        await action();
    } catch {
        return;
    }
    throw new Error(`${label}: expected Firebase Rules rejection`);
}

const env = await initializeTestEnvironment({
    projectId,
    database: { rules }
});

try {
    const owner = env.authenticatedContext('owner').database();
    const stranger = env.unauthenticatedContext().database();
    const roomRef = owner.ref(`rooms/${validRoomId}`);

    // Normal authenticated create/read/update.
    await mustPass('authenticated canonical room creation', () => roomRef.set(canonicalRoom()));
    await mustPass('authenticated room read', () => roomRef.once('value'));
    await mustPass('authenticated room update', () => roomRef.update({ roomName: '通常操作', lastUpdatedAt: 2, revision: 1 }));

    // Rules must reject unauthenticated, malformed ID and invalid canonical values.
    await mustFail('unauthenticated read', () => stranger.ref(`rooms/${validRoomId}`).once('value'));
    await mustFail('unauthenticated write', () => stranger.ref(`rooms/${validRoomId}`).set(canonicalRoom()));
    await mustFail('invalid short room ID', () => owner.ref('rooms/bad').set(canonicalRoom()));
    await mustFail('invalid room ID characters', () => owner.ref('rooms/bad.room').set(canonicalRoom()));
    await mustFail('missing canonical schema', () => owner.ref('rooms/RULES67C').set({ roomName: 'broken' }));
    await mustFail('legacy schema v5 client write', () => owner.ref('rooms/RULES67D').set({ ...canonicalRoom(), schemaVersion: 5 }));
    await mustFail('wrong schema version', () => owner.ref('rooms/RULES67B').set({ ...canonicalRoom(), schemaVersion: 4 }));
    await mustFail('non-number lastUpdatedAt', () => roomRef.update({ lastUpdatedAt: 'now' }));
    await mustFail('negative revision', () => roomRef.update({ revision: -1 }));
    await mustFail('revision regression', () => roomRef.update({ revision: 0 }));
    await mustFail('non-string lastUpdatedBy', () => roomRef.update({ lastUpdatedBy: { spoofed: true } }));
    await mustFail('primitive participants map', () => roomRef.update({ participants: 'not-a-map' }));
    await mustFail('invalid active allocation type', () => roomRef.update({ activeAllocationType: 'bus' }));
    await mustPass('tombstone participant', () => roomRef.update({
        'participantTombstones/deleted-user': { deletedAt: 3 }
    }));
    await mustFail('tombstoned participant resurrection', () => roomRef.update({
        'participants/deleted-user': { id: 'deleted-user', name: '復活', updatedAt: 4 }
    }));
    await mustFail('tombstone removal without reset', () => roomRef.update({
        'participantTombstones/deleted-user': null
    }));

    // Bug reports are private, append-only client submissions. Notification status is server-only.
    const reportRef = owner.ref('bugReports/REPORT001');
    await mustPass('authenticated bug report create', () => reportRef.set(canonicalBugReport()));
    await mustFail('authenticated bug report read', () => reportRef.once('value'));
    await mustFail('unauthenticated bug report create', () => stranger.ref('bugReports/REPORT002').set(canonicalBugReport()));
    await mustFail('bug report update after creation', () => reportRef.update({ message: '上書き' }));
    await mustFail('bug report extra field', () => owner.ref('bugReports/REPORT003').set({ ...canonicalBugReport(), injected: true }));
    await mustFail('bug report empty message', () => owner.ref('bugReports/REPORT004').set({ ...canonicalBugReport(), message: '' }));
    await mustFail('bug report oversized message', () => owner.ref('bugReports/REPORT005').set({ ...canonicalBugReport(), message: 'x'.repeat(2001) }));
    await mustFail('client notification status read', () => owner.ref('bugReportNotifications/REPORT001').once('value'));
    await mustFail('client notification status write', () => owner.ref('bugReportNotifications/REPORT001').set({ status: 'sent' }));

    // Server-side notification state uses a transaction lease. Two near-simultaneous
    // executions must not both obtain permission to send the same report.
    await env.withSecurityRulesDisabled(async context => {
        const server = context.database();
        const now = Date.now();
        const notificationRef = server.ref('bugReportNotifications/ATOMIC001');
        const acquire = (token, eventId, at = now) => notificationRef.transaction(current => acquireLeaseState(current, {
            now: at,
            leaseToken: token,
            eventId
        }), undefined, false);

        const [first, second] = await Promise.all([
            acquire('lease-a', 'event-a'),
            acquire('lease-b', 'event-b')
        ]);
        const acquired = [first, second].filter(result => result.committed);
        assert.equal(acquired.length, 1, 'exactly one concurrent sender must acquire the lease');
        const winnerState = acquired[0].snapshot.val();
        assert.equal(winnerState.status, 'sending');
        assert.equal(winnerState.leaseExpiresAt, now + SEND_LEASE_MS);

        const winnerToken = winnerState.leaseToken;
        const winnerEvent = winnerState.eventId;
        const sentResult = await notificationRef.transaction(current => sentState(current, {
            now: now + 100,
            leaseToken: winnerToken,
            eventId: winnerEvent
        }), undefined, false);
        assert.equal(sentResult.committed, true, 'lease owner can mark sent only after delivery succeeds');
        assert.equal(sentResult.snapshot.val().status, 'sent');
        assert.equal(sentResult.snapshot.val().sentAt, now + 100);

        const [after24hA, after24hB] = await Promise.all([
            acquire('lease-c', 'event-c', now + (25 * 60 * 60 * 1000)),
            acquire('lease-d', 'event-d', now + (25 * 60 * 60 * 1000))
        ]);
        assert.equal(after24hA.committed, false, 'sent is terminal after 24h');
        assert.equal(after24hB.committed, false, 'sent is terminal for every later execution');
        assert.equal((await notificationRef.once('value')).val().status, 'sent');

        // A delivery failure releases the sending state into a retryable failed state.
        const retryRef = server.ref('bugReportNotifications/ATOMIC002');
        const leaseOne = await retryRef.transaction(current => acquireLeaseState(current, {
            now,
            leaseToken: 'retry-a',
            eventId: 'retry-event-a'
        }), undefined, false);
        assert.equal(leaseOne.committed, true);
        const failed = await retryRef.transaction(current => failedState(current, {
            now: now + 1,
            leaseToken: 'retry-a',
            eventId: 'retry-event-a',
            error: 'mail transport failed'
        }), undefined, false);
        assert.equal(failed.committed, true);
        assert.equal(failed.snapshot.val().status, 'failed');
        const retryLease = await retryRef.transaction(current => acquireLeaseState(current, {
            now: now + 2,
            leaseToken: 'retry-b',
            eventId: 'retry-event-b'
        }), undefined, false);
        assert.equal(retryLease.committed, true, 'failed send must be retryable');
        assert.equal(retryLease.snapshot.val().attemptCount, 2);

        // If an execution disappears while sending, only an expired lease can be reclaimed.
        const staleRef = server.ref('bugReportNotifications/ATOMIC003');
        await staleRef.set({
            status: 'sending',
            eventId: 'stale-event',
            leaseToken: 'stale-lease',
            leaseStartedAt: now - SEND_LEASE_MS - 10,
            leaseExpiresAt: now - 10,
            attemptCount: 1,
            updatedAt: now - 10
        });
        const [staleA, staleB] = await Promise.all([
            staleRef.transaction(current => acquireLeaseState(current, { now, leaseToken: 'stale-a', eventId: 'stale-a' }), undefined, false),
            staleRef.transaction(current => acquireLeaseState(current, { now, leaseToken: 'stale-b', eventId: 'stale-b' }), undefined, false)
        ]);
        assert.equal([staleA, staleB].filter(result => result.committed).length, 1, 'expired lease is reclaimed by only one retry');
    });

    // Five devices update distinct entity paths concurrently. Every write must survive.
    const fiveClients = Array.from({ length: 5 }, (_, index) => env.authenticatedContext(`device-${index + 1}`).database());
    await mustPass('five-device concurrent participant writes', () => Promise.all(
        fiveClients.map((client, index) => client.ref(`rooms/${validRoomId}/participants/device-${index + 1}`).set({
            id: `device-${index + 1}`,
            name: `端末${index + 1}`,
            updatedAt: 10 + index
        }))
    ));
    const afterFiveDevices = (await roomRef.once('value')).val();
    assert.equal(Object.keys(afterFiveDevices.participants).length, 5, 'five device writes must all remain');

    // Concurrent transactions on same entity node. Emulator retries one transaction.
    // `meta` is initially empty, so null is a valid first local transaction value.
    await mustPass('conflicting transactions converge', () => Promise.all([
        fiveClients[0].ref(`rooms/${validRoomId}/meta`).transaction(current => ({
            ...current,
            conflictA: true
        })),
        fiveClients[1].ref(`rooms/${validRoomId}/meta`).transaction(current => ({
            ...current,
            conflictB: true
        }))
    ]));
    const afterConflict = (await roomRef.once('value')).val();
    assert.equal(afterConflict.meta.conflictA, true, 'transaction A must survive retry');
    assert.equal(afterConflict.meta.conflictB, true, 'transaction B must survive retry');

    // Offline queued write is sent only after reconnection and then acknowledged by Rules.
    const offlineClient = fiveClients[2];
    offlineClient.goOffline();
    const queuedWrite = offlineClient.ref(`rooms/${validRoomId}/meta/offlineRecovered`).set(true);
    await wait(50);
    offlineClient.goOnline();
    await mustPass('offline write recovers after reconnect', () => queuedWrite);
    const afterReconnect = (await roomRef.once('value')).val();
    assert.equal(afterReconnect.meta.offlineRecovered, true, 'queued offline write must arrive after reconnect');

    // Reset is an allowed deletion; this was a regression risk in first rule draft.
    await mustPass('authenticated reset', () => roomRef.set(null));
    const afterReset = await roomRef.once('value');
    assert.equal(afterReset.exists(), false, 'reset must remove room');

    console.log('Firebase Emulator Rules v67: PASS (rooms + private bug reports + atomic notification lease + retry + terminal sent)');
} finally {
    await env.cleanup();
}
