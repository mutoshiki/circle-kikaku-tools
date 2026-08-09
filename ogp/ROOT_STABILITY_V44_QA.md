# Root Stability v44 QA

## Scope
This build resumes the broad multi-device/chaos validation after fixing the newly reported settlement-save and drag-scroll regressions. The fixes are intentionally at the state/event/synchronization ownership level rather than CSS or one-off timer patches.

## Root fixes

### 1. Settlement car editor Save did not close/save
Root cause: validation rebuilt the entire valid car editor before the modal close completed. Re-rendered Carbon controls could lose their live host property state, so the subsequent sync read a fresh control instead of the one the user edited.

Fix:
- `validateActiveSettlementCarEditor()` now commits the live DOM first and does not rebuild a valid editor.
- It re-renders only when invalid fields actually need Carbon error presentation.
- The normal modal lifecycle can therefore close after successful validation and persist the same live values the user confirmed.

### 2. `割勘 −` / `部費 −` reverted and were not saved
Root cause: the expense `cds-select` template marked a child `cds-select-item` as selected but did not set the Carbon host's `value`. After a render/upgrade cycle, the host could expose an empty value; normalization then fell back to `split`.

Fix:
- Every expense `cds-select` now receives the canonical `value` (`split`, `club`, `split-minus`, `club-minus`) directly on the official Carbon host.
- The existing official `cds-select-selected` event path remains the immediate commit path.
- Save no longer re-renders a valid editor before reading the value.

Verified in a real Carbon 2.60.0 browser harness: `club-minus` remained `club-minus` in both application state and the canonical stored settlement after Save, and the modal closed.

### 3. Settlement settings Save did not close
Root cause: organizer-free was enabled by default, but an empty organizer was treated as a hard validation failure even though the settlement calculation already treated it as guidance. This created a modal state from which Save could never close until an optional/recommended choice was made.

Fix:
- Missing organizer is now Carbon warning/guidance, not a save-blocking invalid state.
- Actual invalid cost data remains blocking.
- Settings Save closes and persists when organizer is unset.

### 4. Card swap/drag could jump the page to the top
Root cause: iOS/WebKit scroll anchoring can run after reparenting, tray geometry restoration, UI refresh, and later paint frames. Restoring scroll only around the tray resize was insufficient.

Fix:
- Scroll state is captured at the actual drag mutation boundary.
- `#top-area.scrollTop` and window scroll are restored synchronously, on the next two animation frames, and once after the delayed WebKit anchoring window.
- The restored value is the position at release, so legitimate drag auto-scroll is preserved; only the unintended reset is cancelled.
- The waiting tray's temporary drag collapse still uses a transient class and never mutates the user's persisted open/closed preference.

Browser harness result: `scrollTop 600 -> 600 immediately -> 600 after 500 ms` after a swap.

## Additional bugs discovered by broad testing

### Final-seat race
Two devices could independently place people into the last free seat. A UI-only capacity check cannot prevent a remote race.

Fix: canonical Schema v5 normalization now enforces group capacity. Overflow placement is resolved deterministically and returned to waiting, so every device converges to a valid allocation regardless of delivery order.

### Old packet reverting a newer edit on the same entity path
Entity-level multi-location updates protected unrelated people, but an older request to the exact same participant/placement path could still arrive after a newer request and overwrite it.

Fix: remote entity writes now run through a Firebase RTDB room transaction with per-path versions (`clock`, entity time, client id, sequence). A stale version cannot replace a newer version. Canonicalization then enforces tombstones, references, owner/group coherence and capacity before commit.

## Regression and exploratory test results

### Full project contracts
`npm test`: PASS
- Carbon dependency/contracts
- no Bootstrap/Font Awesome runtime
- modal anatomy
- Carbon controls
- dark/accent theme
- design refinement
- feature fixes
- person card interaction
- Carbon guidance
- route-distance apply
- focus/expense-name fitting
- transient drag tray
- Schema v5 canonical state/entity sync
- Root Stability v44 contract

### Share and Google route contracts
- Share links/OGP contract: PASS
- Google route planner lint: PASS (8 owner files)
- Google route planner contract: PASS

### Existing five-device chaos
- 50 scenarios
- 15,072 operations
- 9,949 commits
- PASS

### Deep five-device state/concurrency suite
Passed:
- participant boundaries: 0, 1, 2, 19, 50, 100
- projection consistency
- long/emoji/exotic names and 50 expenses
- two users taking the final seat concurrently
- delete while settlement checkbox commits
- delete while rename modal saves
- target group deleted during drag
- five devices editing the same target with final delete
- network reordering: newer same-field participant edit remains authoritative
- structural invariants under random chaos
- capacity invariant under 4,388 random commits

Failures: 0

### Extended five-device soak
Four disjoint seed ranges, each 70 seeds x 120 steps:
- Batch 1: 25,240 random operations / 11,305 commits / 0 failures
- Batch 2: 24,971 random operations / 11,763 commits / 0 failures
- Batch 3: 25,070 random operations / 11,595 commits / 0 failures
- Batch 4: 24,969 random operations / 11,297 commits / 0 failures

Total:
- **100,250 random operations**
- **45,960 commits**
- **0 structural failures**
- **0 capacity failures**

### Five-browser targeted Carbon/UI harness
Viewports:
- 375x812
- 390x844
- 430x932
- 390x700
- 844x390

Verified:
- car settlement Save closes
- `club-minus` persists in state and canonical storage
- settings Save closes without forcing organizer selection
- intentionally incomplete fuel data remains open, then closes once valid
- mobile waiting tray is 2 columns
- drag temporarily collapses the waiting tray
- drag swap does not reset scroll
- 0 browser page errors

### Five-browser exploratory UI fuzz
- 5 browser contexts
- 15 mixed actions per context (75 total)
- view switching, random allocation actions, scrolling, opening/closing menus, Escape, settlement/settings, participant registration, waiting tray actions
- **0 page errors**

## Tooling limitations
- `stylelint` is not installed in the provided runtime, so `npm run lint:css` could not execute (`stylelint: not found`). No CSS files were changed for the root fixes in this build.
- The project-local `playwright` command in this runtime is not the expected Playwright test runner (`unknown command: test`), so the repository's `test:carbon:complete` script could not run here. To compensate, the modified behavior was exercised with a separate five-context Chromium harness loading the real bundled Carbon 2.60.0 components; no page errors were observed.

## Files primarily changed
- `assets/js/templates/settlement/04-extra-input-templates.js`
- `assets/js/features/settlement/03-render.js`
- `assets/js/features/drag-edit-view.js`
- `assets/js/core/entity-state-v5.js`
- `assets/js/core/sync-controller.js`
- `index.html` (cache busting)
- `package.json`
- regression/deep/soak tests under `tests/`

## Release note
All devices participating in the same room should reload after this build is deployed so an old cached controller is not left participating with pre-v44 synchronization semantics.
