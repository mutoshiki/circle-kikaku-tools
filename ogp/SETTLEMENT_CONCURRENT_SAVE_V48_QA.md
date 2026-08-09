# Settlement concurrent explicit-save v48 QA

Date: 2026-08-09

## Root cause

The settlement domain merge in v47 could merge disjoint remote fields, but the explicit **Save** flow did not wait for the remote transaction. It called the generic debounced `save()` (180 ms) and closed the Carbon modal immediately. During concurrent editing this created a misleading success path and let an older modal snapshot participate in later synchronization.

## Fix

- Added `SanpoSync.saveImmediate()` as the explicit-save commit boundary.
- Explicit settlement Save now cancels the generic pending save timer, starts the RTDB entity transaction immediately, and awaits the committed authoritative snapshot before closing the modal.
- While the transaction is in flight, the Save button is disabled and the modal stays open.
- If the transaction fails, the modal remains open and the typed values are preserved; a Carbon-style app notice reports the failure.
- Settlement modals record both the room snapshot at open time and the last synced base at open time.
- The commit contains:
  - any already-pending local patch that existed before the modal opened; and
  - only the settlement paths actually changed in this modal session.
- Therefore a user saving from a stale opening snapshot does not send the untouched settlement fields back over another user's newer values.
- Applied to both **精算設定** and **車ごとの費用**.
- Added a stable `saveSettlementCarEditBtn` id for save-state control and E2E verification.
- Cache identifiers for the changed sync/render modules were bumped to `settlement-concurrent-save-v48`.

## Exact two-device browser reproduction

Full application HTML, actual bundled Carbon web components, all app JS/CSS, and the real v48 sync controller were loaded in Chromium. Top-level localhost navigation is blocked by the execution environment, so the previously used policy workaround (`about:blank` + full app `set_content`) was used. Only the Firebase transport was replaced with a shared mock implementing the same `runTransaction(dbRef, updater)` interface, with an artificial 450 ms network delay.

### Same car, different fields

Both devices opened **A車の費用** from the same base (`distance=10`, `price=160`).

1. Device A typed `distance=111` and kept the editor open.
2. Device B typed `price=222` and pressed Save.
3. At +100 ms, B's modal was still open and its Save button was disabled (transaction still in flight).
4. A's modal remained open and A's input was still `111`.
5. After B committed, authoritative state was `distance=10`, `price=222`.
6. A then pressed Save from its older opening snapshot.
7. Final authoritative state was `distance=111`, `price=222`.
8. Fresh third-page load from the final authoritative room displayed both values together.
9. Page errors: 0. Console errors: 0.

Result: **PASS** on 390×844 and 1280×900.

### Settlement settings, different fields

Both devices opened **精算設定** from the same base.

1. Device A typed `車出し協力代=1234` and kept the editor open.
2. Device B changed `端数処理=50円` and pressed Save.
3. B committed while A's input remained `1234`.
4. A pressed Save afterwards.
5. Final authoritative state preserved both `driverReward=1234` and `rounding=50`.
6. Page errors: 0.

Result: **PASS** on 390×844.

## Automated checks

- `npm test`: PASS, including the new `Settlement concurrent explicit-save v48` contract.
- Five-device chaos: PASS, 50 scenarios / 15,072 operations / 9,949 commits.
- Deep five-device suite: PASS, 9,465 random operations / 4,388 commits; capacity failures 0; other structural failures 0.
- JavaScript syntax: all 68 application JS files passed `node --check`.
- Diff scope from v47 is intentionally limited to:
  - `assets/js/core/sync-controller.js`
  - `assets/js/features/settlement/03-render.js`
  - `index.html`
  - `package.json` / `package-lock.json`
  - v47 compatibility contract update
  - new v48 regression contract

## Remaining environment limitation

The execution environment blocks direct top-level localhost/GitHub Pages-style navigation with `ERR_BLOCKED_BY_ADMINISTRATOR`. Full rendered app E2E was therefore run with the known `about:blank` / `set_content` policy workaround. The real Firebase network endpoint was not contacted; the E2E uses the actual sync-controller transaction updater against a shared two-page mock transport, while the existing multi-device model tests exercise reordering/conflict behavior independently.
