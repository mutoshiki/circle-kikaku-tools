# Settlement Cross-Car Sync v49 QA

## Summary
v48 still had a collaboration defect when two devices edited **different cars**. The remote database commit could succeed, but any device with a settlement editor open treated the entire settlement surface as UI-locked and queued every incoming room snapshot. As a result, a B-car save was invisible/stale on a device currently typing in A-car, and that stale local room remained in the collaboration path until the A editor closed or saved.

v49 changes settlement collaboration from a whole-settlement UI lock to **path-scoped protection**.

## Root cause
`isRemoteUiBlocked()` deliberately blocks remote repaint while a Carbon modal or cost input is active. In v48 the `onValue` handler applied that guard to the entire Firebase room. Therefore an A-car edit also blocked unrelated `settlement/carsByParticipantId/<B>` updates.

The earlier v48 browser test also did not deliver the committed room through the other page's actual `onValue` callback, so it validated transaction merging but missed the stale-client symptom.

## Changes
- Added `applyRemoteSettlementWhileEditing()` in `assets/js/core/sync-controller.js`.
- While A-car is being edited, remote settlement paths for A-car remain protected, but unrelated B/C car paths are rebased into the local canonical model immediately.
- The full remote room remains queued so participant/allocation changes are still safely applied after the modal closes.
- Added an in-memory hybrid sync base so accepted B-car paths are no longer mistaken for A's local changes.
- Added `buildSettlementCarIntentPatch()` so saving A-car can only emit A-car settlement paths; a newly received B-car value cannot be reclassified as A's save intent.
- Added `buildSettlementSettingsIntentPatch()` so the same rule applies to settlement settings.
- `renderSettlementView()` can preserve active settings controls while unrelated settlement data is updated.
- Bumped collaborative asset cache marker to `settlement-concurrent-save-v49`.

## Exact two-device E2E
Viewport: 390x844 on two independent Chromium browser contexts, plus a fresh third context.

1. Seed A-car: distance 10 / price 160; B-car: distance 20 / price 170.
2. Device A opens A-car and types distance `111`, keeping the input focused.
3. Device B opens B-car, types price `222`, and presses Save.
4. Deliver the resulting Firebase-style `onValue` snapshot to Device A **while A is still typing**.
5. Assert on Device A:
   - A-car modal remains open.
   - A input remains `111`.
   - canonical B-car price is already `222`.
6. Device A presses Save.
7. Open a completely fresh third browser context from the final authoritative room.
8. Assert final state:
   - A-car distance = `111`.
   - B-car price = `222`.
   - page errors = 0.
   - console errors = 0.

Result: **PASS**.

## Automated checks
- `npm test`: PASS, including new `settlement-cross-car-sync-v49-contract.mjs`.
- Five-device chaos: PASS — 15,072 operations / 9,949 commits.
- Deep five-device suite: PASS — 9,465 random operations / 4,388 commits, capacity failures 0, other structural failures 0.
- Cross-car browser `onValue` E2E: PASS.

## Important difference from v48 QA
v48 only proved that two transaction patches could merge on a shared mocked server. v49 additionally delivers the remote commit through the **other device's `onValue` callback while its editor remains open**, which reproduces the reported different-car failure mode.

## Environment limitation
The browser sandbox cannot use a real Firebase backend connection. The E2E runs the production sync/controller/render code and Carbon UI, with an in-process RTDB transaction + `onValue` transport that preserves the production ordering needed for this race. The final authoritative room is then loaded into an independent third browser context.
