# Collaborative Root Sync v46 — QA report

## Summary

This revision treats multi-device editing as one collaboration problem rather than as separate modal/button bugs.

The production model remains Schema v5 with a single participant master, ID-based allocations, ID-based settlement state, and entity/path-level Firebase transactions. v46 adds a UI-transaction boundary so remote snapshots cannot repaint an active Carbon write surface, fixes rebase ordering after local commits, makes allocation-tab/tray presentation device-local, prevents participant-registration from replacing unrelated room state, aligns conflict timestamps to Firebase server time, and makes the collapsed waiting tray the primary drag target before underlying seats.

## Root causes found and fixed

### 1. Remote snapshots could invalidate Carbon modal save interactions
While a write modal was open, an incoming room snapshot could restore/re-render the page between pointerdown and click. The visible Save control could therefore be replaced before its click/submit completed.

Fix: `remote-guard.js` now defines a shared UI transaction boundary for all editable `.app-modal` surfaces, focused Carbon/native controls, IME composition, card/sheet drags, and pointer transactions. Remote data is queued until the local interaction completes.

Protected write surfaces include participant registration, settlement settings, per-car settlement, common edit, route distance and planning/editable modals; future editable `.app-modal` surfaces are protected automatically.

### 2. A completed local transaction could advance the sync base before the merged state was painted
The old sequence could set `lastSyncedData` to the merged Firebase result while the visible canonical/DOM state still represented the pre-merge room. When the modal closed, the stale UI could then be compared to the new base and incorrectly appear to contain new local deletions/changes, causing a stale write-back.

Fix: a queued merged transaction result records the local request version it acknowledges. When the UI transaction ends, that merged result is applied as a rebase, not re-saved from stale UI.

### 3. `activeAllocationType` and waiting-tray open/closed state were room-shared
One phone switching 車割/班割 or opening/closing the waiting tray could make other phones change presentation and rebuild their UI while editing.

Fix: these fields are device-local presentation state and are removed from Firebase canonical room data.

### 4. Participant registration behaved like a room replacement
A participant-registration modal opened from an older view could overwrite participant/allocation work completed by another device while the modal was open.

Fix: participant registration is now a three-way intent editor against the canonical opening snapshot. It only submits explicit add/remove/name/grade/driver-status changes. Remote additions and unrelated car/team moves are preserved.

A related edge case was also found: if another phone renamed a driver while the participant modal stayed open, the unchanged old driver name could no longer resolve against the current roster and could accidentally remove driver status. Driver lines now resolve through the opening participant ID first.

### 5. Gender detection dropped Firebase snapshots entirely
`onValue()` previously returned immediately when the local gender-detection queue was running. With many newly registered participants this could last long enough for real remote edits to arrive and be permanently discarded.

Fix: gender detection is now a guarded local transaction. Incoming snapshots are queued rather than discarded, and pending remote data is released after the local queue finishes and its save is queued.

### 6. Client wall-clock skew could distort same-path conflict ordering
Fix: Firebase `.info/serverTimeOffset` is read before room sync and watched afterwards. Version comparisons use server-aligned action times only when both updates are known to be aligned; otherwise Lamport transaction order is used.

### 7. Waiting-tray drop target lost to an underlying seat on iOS
During transient collapse, `elementFromPoint()` can report the seat visually behind the waiting tray. Seat hit-testing used to happen first, so dropping to 未割り当て could be practically impossible.

Fix: the full-width collapsed waiting strip is resolved geometrically **before** seat hit-testing. A browser harness confirmed a point where `elementFromPoint()` returns the underlying seat now resolves to `waiting-list`.

### 8. Mixed cached JS builds across phones
Several collaboration files had changed without receiving a new cache query. Different iPhones could therefore run a mixture of v42/v44/v46 logic.

Fix: every production JS file changed by this collaboration revision now carries the `collab-modal-sync-v46` cache-bust marker in `index.html`.

## Settlement-specific behavior

- Per-car Save commits the current Carbon values before closing.
- `split-minus` / `club-minus` remain exact values; they are not collapsed to their non-minus variants.
- Settlement settings and per-car editors do not re-render the underlying settlement view until the Carbon modal has closed.
- Organizer-not-selected remains guidance where appropriate and no longer creates an inconsistent close-only failure.

## Drag / scrolling behavior

- During a card drag the waiting tray may transiently collapse without persisting or syncing that presentation state.
- The pre-drag tray state is restored when the gesture ends.
- Remote/canonical repaint preserves `#top-area`, waiting-tray and window scroll positions through immediate paint, two animation frames and the delayed WebKit scroll-anchor phase.
- Unchanged canonical remote data does not rebuild/reparent every card.

## Automated regression tests

### Main regression suite
`npm test` — PASS.

Includes Carbon dependency/static contracts, design/dark-mode contracts, feature contracts, person-card interactions, Carbon guidance, route-distance apply, focus/auto-fit, drag stability, Schema v5, root-stability v44, collaborative modal/sync v46 and five-device domain tests.

### Five-device broad chaos
`node tests/five-device-chaos-v42.mjs` — PASS

- 50 scenarios
- 15,072 operations
- 9,949 commits

### Deep concurrency / boundary suite
`node tests/deep-five-device-suite.mjs` — PASS

Covers:
- 0 / 1 / 2 / 19 / 50 / 100 participants
- exotic text and 50 settlement extras
- two devices racing for the final seat
- participant deletion while settlement checkbox commits
- participant deletion while rename modal saves
- target group deleted during drag
- five devices editing the same target with final deletion
- network packet reordering
- structural and capacity invariants

Metrics:
- 9,465 random operations
- 4,388 random commits
- 0 structural failures
- 0 capacity failures

### Five-device domain isolation
`node tests/five-device-domain-sync-v46.mjs` — PASS

Confirms settlement-only changes do not resend allocation/participants, allocation-only changes do not resend settlement, five different domains survive different server arrival orders, a stale settlement modal cannot erase a concurrent allocation move, device-local presentation creates no Firebase patch, and participant deletion remains authoritative against stale settlement writes.

### Network/offline/reorder soak
`tests/five-device-network-soak-v46.mjs` was run across 180 seeds (in multiple bounded batches), 140 steps per seed.

Combined v46 soak metrics:
- 75,590 randomized operations
- 28,312 commits/deliveries
- 28,492 invariant checks
- delayed/reordered delivery
- offline/reconnect toggles
- modal-busy intervals
- independent client request sequences
- 17 operation categories across participants, both allocations, per-car settlement, settlement settings, room metadata/locks/overview and device-local UI
- all final clients converged
- 0 invariant failures

Combined with the broad/deep suites, this revision was exercised with **100,127 modeled multi-device operations and 42,649 modeled commits**.

## Actual Carbon browser-component validation

Browser plugin classification: **not available**. Regular Playwright with system Chromium was used as the documented fallback.

Full localhost navigation is blocked by the environment policy:
`net::ERR_BLOCKED_BY_ADMINISTRATOR` for `http://127.0.0.1:8765/...`.

To still test the real components, Chromium pages were created with `page.set_content()` and the project's actual Carbon 2.60.0 bundle plus the changed controllers were loaded directly.

### Exact affected modals
Participant registration, settlement settings and per-car settlement were each tested with repeated synthetic remote-apply attempts while open. In every case:
- `SanpoRemoteGuard.isBusy()` was true while the write modal was open.
- pending remote apply did not run during the modal interaction.
- the original Save control remained connected.
- Save click fired exactly once.
- the Carbon modal closed.
- pending remote application resumed only after close.
- per-car `club-minus` remained `club-minus`.
- no page errors / relevant console errors.

### Five-browser modal stress
Five separate Chromium browser contexts simultaneously exercised:
1. participant registration
2. settlement settings
3. per-car settlement
4. common edit modal
5. planning/editable modal

Each context ran 20 open → repeated remote-apply pressure → Save → close cycles (100 saves total).

Result:
- 100/100 saves fired
- 100/100 modals closed
- remote apply was blocked during every write cycle
- minus values remained exact
- 0 page errors

### Waiting-tray hit-test
A Chromium harness intentionally placed a seat above the waiting tray in hit-test order. At the test point:
- `document.elementFromPoint()` returned `underlyingSeat`
- `getManualCardDropTarget()` returned `waiting-list`

This verifies the iOS-oriented root fix does not depend on DOM hit-test order.

## Other project checks

PASS:
- `npm run test:share`
- `npm run lint:maps`
- `npm run typecheck:maps`
- `npm run test:maps:contract`
- `npm run test:driver-reward`
- JavaScript syntax check across 68 files

Not runnable in this container:
- `npm run lint:css` because `stylelint` is not installed in the working environment (`stylelint: not found`). No CSS file is changed by v46.
- Full URL-driven Playwright app navigation due environment `ERR_BLOCKED_BY_ADMINISTRATOR`.

## Deployment note

Because this revision changes the collaboration contract, every concurrently editing device should reload after deployment. The revised cache query markers force the changed collaboration modules to reload rather than allowing a phone to continue with a mixed older build.
