# Phase C evidence

This directory records evidence for the shared workflow contracts introduced in Phase C. Screenshots supplement behavior and semantic assertions; they are not the contract by themselves.

## Scope and environment

- Product UI specification: `docs/design/SANPOKAI_PRODUCT_UI.md`
- Browsers: Chromium and WebKit, desktop 1280 × 900 and mobile 390 × 844 with touch enabled
- Data targets: local/offline fixtures and loopback Auth/Realtime Database Emulator (`demo-circle-react`, 9098/9008); no production Firebase access
- Themes and preferences: Carbon `g10` and `g100`; `prefers-reduced-motion: reduce`
- User tasks: Overview read/edit/save/cancel, explicit feedback placement, participant validation, Modal close/focus return

## Repeatable evidence

| Contract | Assertion |
| --- | --- |
| Typed feedback | Severity and placement are supplied as metadata; Japanese wording is never parsed. Visible row/page updates do not add redundant Toasts. |
| Page form | Overview enters edit mode from the page action, keeps a local draft, commits only on Save, discards on Cancel, and restores focus. |
| Shared save | The editor stays busy until the existing sync acknowledges the intent. Rejection and a concurrent reset retain the draft with an explanation; retry/cancel remain available. |
| Concurrent edit | A memo-only edit preserves another client's changed project name. Untouched memo/timetable values are taken from the latest snapshot at submit. Existing whole-overview conflict resolution remains unchanged. |
| Validation | Invalid participant submit marks the field, explains the error, and focuses the first invalid enabled control. |
| Dialog | Every Modal task is registered; Escape/cancel closes the dialog and returns focus to the launcher where it remains present. |
| Responsive | Long project content and form actions have no document-level horizontal overflow at 390px. Mobile action targets are at least 40px high. |
| Accessibility | Main landmark, one page `h1`, form heading hierarchy, keyboard field order, accessible dialog name, invalid association, and visible focus are asserted in browser tests. |
| Theme and motion | The page form works under `g100`; reduced-motion media preference is exposed without changing task completion. |

## Captured screenshots

The opt-in `phase-c-evidence.spec.js` run writes these images for each browser project:

- `phase-c-chromium-desktop-overview-edit-dark.png`
- `phase-c-chromium-mobile-overview-edit-dark.png`
- `phase-c-webkit-desktop-overview-edit-dark.png`
- `phase-c-webkit-mobile-overview-edit-dark.png`

They show the same long-content Overview edit state in dark theme at the four required browser/viewport combinations.

## Screen-reader limitation

Native NVDA automation is not available in the repository CI environment. Phase C therefore verifies the browser accessibility tree inputs—landmarks, headings, names, `aria-invalid`, focus movement, focus return, and notification semantics—with Chromium and WebKit. A human NVDA + Chromium smoke remains an explicit final integration check before the Carbon redesign reaches production.

Actual device software-keyboard/browser-chrome behavior is also not established by desktop browser viewport emulation. Touch-enabled 390px interaction, keyboard focus, short-viewport navigation, and overflow are covered; physical mobile keyboard/safe-area verification remains a final integration check, not a claimed pass.

## Before / after and review decisions (2026-10-01)

| Observed before | Phase C result | Evidence |
| --- | --- | --- |
| Japanese message text selected severity; successful row changes produced redundant Toasts | Explicit notice metadata; contextual persistent errors; transient feedback only when the result is otherwise unclear | `ui-contracts.test.mjs`, `shared-task-contracts.spec.js` |
| Overview used a long Modal plus a separately blur-saved name | Secondary Overview read page → explicit page edit → one existing edit-session commit | Overview pilot and protected-state store contract |
| A stale memo editor overwrote an independently renamed project | Original local baseline identifies changed fields; existing edit-session merge preserves untouched owners | Real two-client Emulator regression (RED before fix) |
| Rejected/delayed saves cleared local input or appeared complete | Busy state until acknowledgement; retained draft and enabled retry on rejection | Real Emulator Rules rejection/retry and delayed WebSocket acknowledgement |
| A reset racing a save was reported connected even though the old write was discarded | Post-ack generation check retains the draft and explains Cancel/reopen | Real Emulator delayed outbound save + remote reset (RED before fix) |
| Active-dialog errors could render behind the dialog | Report/export/participant confirmation own their local error region | Failed handoff/report retry; remote participant deletion tests |
| Removing the last timetable row left focus on BODY | Next/previous row, or Add when no row remains | Interactive Chromium RED/GREEN; four-browser row-focus regression |

The independent whole-branch reviewer found no remaining Critical/Important findings after these fixes. `room-store.js`, sync, Firebase Rules, schema, domain code, and calculations have **no diff against `carbon-redesign`**. The optional baseline/name extension exists only in the pre-existing local Overview draft key; old memo/timetable drafts remain readable. No new shared save model, store command, role, or permission was added.

`TaskModal` is a transparent installed-Carbon adapter, not a custom dialog or proof that every legacy Modal is accessible. See [modal-classification.md](./modal-classification.md) for later-phase debt. Participant import/announcement, allocation internals, route/costs, settlement settings, history/collection redesign remain D–H work.

**Official guidance:** Carbon [Forms](https://www.carbondesignsystem.com/building-blocks/core/patterns/forms), [Notifications](https://www.carbondesignsystem.com/building-blocks/core/patterns/notifications), and [Modal usage](https://carbondesignsystem.com/components/modal/usage/) provide contextual errors, feedback selection, and short-task criteria. **Project interpretation:** this pilot's explicit edit/save, acknowledgement boundary, optional local baseline, and future-phase assignments apply those criteria to Sanpokai; they are not Carbon-prescribed product workflows.

## Reproduction and evidence limitations

- Browser plugin not available; used repository Playwright tests plus interactive Playwright CLI without installing another browser dependency.
- Offline suite: set `SANPO_TEST_FIREBASE_TARGET=offline`, demo project ID, and loopback database URL, then run `npm --prefix apps/react run test:browser`. The historical `production-smoke.spec.js` name runs only this isolated local preview (4176); no production smoke was run.
- Emulator: use `firebase emulators:exec --config apps/react/migration/firebase-emulator.json --only auth,database --project demo-circle-react` with explicit emulator target, then run the existing unit/browser scripts. Synthetic room mutations and temporary room-specific rejecting Rules occur only in the demo Emulator, are restored, and the owned process stops after testing.
- Set `PHASE_C_EVIDENCE_DIR` to capture the four screenshots with `phase-c-evidence.spec.js`.
- Earlier full offline runs exposed a reload test checking mobile-trigger visibility before React mounted, one non-reproduced WebKit footer-focus failure, and an immediate midpoint-scroll fade assertion racing the browser repaint. The reload helper now waits for the current main heading; the footer test additionally asserts dialog initial focus and close-button focus, retaining its original wrap assertion. Midpoint fade now waits for the same rendered state, like the existing bottom-fade assertion; neither fade expectation was removed. Diagnostic footer repeat passed 5/5; focused and CI results are recorded with the PR. No timeout, forced click, skip, or assertion relaxation was introduced.

## Verified results

- React unit/contract suite: 59 passed.
- Production build: passed; only the existing bundle-size advisory was reported.
- Protected legacy files: 1,332 unchanged.
- Final focused browser contracts: 60 passed across Chromium/WebKit desktop/mobile, after all pilot fixes and stronger modal initialization assertions.
- Final midpoint/bottom scroll-fade regression: 8 passed (all four browser projects, repeated twice) after waiting for the actual repaint rather than reading an intermediate frame.
- Full offline regressions: 239 passed, 12 intended viewport-specific skips; earlier run had one WebKit footer-focus failure, later run had one WebKit midpoint-fade assertion race investigated as above. Neither is recorded as an all-green run. Final relevant browser/CI results accompany the integration PR.
- Auth/Realtime Database Emulator unit suite: 3 passed.
- Auth/Realtime Database Emulator browser suite: 12 passed (six scenarios in Chromium desktop and WebKit 390px), including real Rules rejection/retry, independent fields, delayed acknowledgement, remote deletion, and concurrent reset.
- Legacy static contracts: 36 passed.
- Browser CLI inspection: Chromium at 390 × 844 confirmed Overview focus entry, name → memo keyboard order, Cancel return, and row-delete focus falling to BODY before the fix and Add after it.
- Visual review: all four committed dark-theme screenshots were inspected; no clipping or document-level horizontal overflow was observed.
- Production release, deployment, smoke, and production Firebase writes: not run, per the Carbon redesign integration exception.

## Integration status

PR [#78](https://github.com/mutoshiki/circle-kikaku-tools/pull/78) targets `carbon-redesign`; it must not merge while required checks fail. [First CI run](https://github.com/mutoshiki/circle-kikaku-tools/actions/runs/36781264775) (head `5224882`) found identical legacy collaboration failure IDs on head and base (`newFailureIds: []`): ten `test:collab:deep` owner/capacity boundary/race issues and `test:collab:soak :: car owner placement mismatch`. The clean-legacy gate fails because the path classifier treats `src/services/overview-draft.js` as shared, even though this change concerns only the local UI draft. React Chromium/WebKit browser, shared-collaboration, Firebase compatibility, build/unit/visual checks passed on that run. No classifier, workflow, domain owner, required check, or legacy assertion has been weakened to hide the baseline failures. Addressing this classification or the existing protected-domain defects requires a separately reviewed scope before integration; Phase C is not yet declared complete.
