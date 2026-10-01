# Phase D — participant workflow evidence

Validation date: 2026-10-01. Integration base: `c9fbf01`. Target: `carbon-redesign` only. This document records implementation evidence; it does not override [Product UI specification](../../SANPOKAI_PRODUCT_UI.md) v1.2.

## Outcome and contract traceability

User task: review form-linked applicants or add people manually, confirm participants, then hand off to car/team allocation and participant announcement. Overview and history remain supporting destinations.

| Specification | Implementation / observable contract |
| --- | --- |
| §§2–4,19 | Participants owns URL child tasks `import` and `announcement`; one shell h1, parent link, current section, refresh/history/deep-link restoration and logical launcher return |
| §§5–6,8.1 | One registration page, not a mandatory three-step wizard. Manual fields are editable review; pasted data has inline editable preview. One committing action, invalid-field focus, cancel/back/recovery explicitly distinguished |
| §8.1 | Original six manual capabilities, parser warnings/duplicate policy and stable command identities preserved. Source edits invalidate previous preview corrections |
| §§6,8.2,16–17 | Confirmed list stays visible. Selection is staged, cancellable and busy until acknowledgement; active collapsed filters remain visible. Cars/teams/announcement/export are grouped task links, not cards |
| §§19–21 | Carbon public components, Grid/Column and spacing/type/layer tokens; natural page scroll. Sticky selection actions wrap, account for safe area and do not require drag |

**Official guidance:** Carbon [Modal usage](https://carbondesignsystem.com/components/modal/usage/) and [Forms](https://www.carbondesignsystem.com/building-blocks/core/patterns/forms) inform short-dialog versus durable-form choice and visible, logically ordered inputs.

**Project interpretation:** nested task URLs, inline review instead of a separate confirmation step, local draft recovery, productive list/handoff grouping and the existing readable form width are product decisions. Carbon does not prescribe this app's URL, schema, participant identity or applicant synchronization policy. Appropriate short edit/delete/export dialogs remain; allocation/cost/settlement/history redesign is not included.

## Test and browser evidence

Local target: `http://127.0.0.1:4176`, offline local storage only. Shared-behavior target: Auth/Database Emulator on 9098/9008, `demo-circle-react`, synthetic rooms cleaned by each test. Browser plugin is not available in this session; repository Playwright plus interactive Playwright CLI were used, without installing dependencies.

| Gate | Result |
| --- | --- |
| React local build | PASS; existing bundle-size advisory remains |
| React unit suite | 71/71 PASS |
| Chromium/WebKit, desktop 1280×900 and touch-enabled 390×844 | 276 PASS / 12 existing skips / 0 failures. Eight skips are mobile-only shell contracts on desktop; four are opt-in Phase B capture tasks. No new skip |
| Emulator unit / browser suites | 3/3 and 22/22 PASS (Chromium desktop and WebKit mobile) |
| Legacy static contracts | 37/37 PASS |
| Protected domain/store/sync/services/Firebase/assets/types/package/tools delta against `c9fbf01` | Empty |
| Historical protected-file manifest | Known mismatch: normative Product UI doc and inherited Phase C `package.json` / classifier changes. Manifest not recaptured; this is not a new domain-source change |

Checked: initial/direct/shared/legacy entry, parent/child navigation, refresh/back/forward, current-location semantics, keyboard order and focus/return, invalid submit, touch selection/cancel, both themes, loaded fonts, narrow/short viewport, long project context, no horizontal overflow, empty/populated/filter-empty states, editable paste review and announcement clipboard retry. Existing allocation/route/settlement behavior suites remain in the cumulative browser matrix.

Interactive loop on fresh room `PHASE-D-RESUME-QA`: Add → focused registration heading → type name → Tab reaches driver input → refresh restores input → Register → participant appears in list and Add regains focus. Page identity was correct, content was non-blank, no framework overlay was present, and console showed zero errors/warnings (only Carbon informational feature-flag notices).

Native software keyboard/browser chrome, physical safe-area behavior and NVDA output are **not** proven by emulation. Retain the human/device acceptance gate for Phase I. No production action or production Firebase write was performed.

### Reviewed artifacts

- [Before: long registration Modal, 390px](registration-before.png)
- [After: registration, Chromium desktop/light](registration-chromium-desktop-light.png)
- [After: registration, Chromium mobile/light](registration-chromium-mobile-light.png)
- [After: registration, WebKit desktop/dark](registration-webkit-desktop-dark.png)
- [After: registration, WebKit mobile/dark](registration-webkit-mobile-dark.png)
- [After: registered participant and next tasks, interactive 390px](participants-mobile.png)

Registration captures are font-verified, normal page scrolling, with the document reset to the top before capture. Older diagnostic captures with unloaded fonts or a mid-page fixed-header screenshot artifact are not acceptance evidence.

## Independent review and important fixes

One fresh independent whole-branch review was performed. No re-review dispatch or feature expansion followed. Important findings were reproduced and fixed in one pass:

- An unrelated pending save no longer consumes a rejected participant registration. Precise UI recovery receipts retain the original IDs/paths, not whole rooms.
- An acknowledged receipt cannot replay over later participant edits. Conflict-adjusted registration (including tombstone rejection) retains an error/recovery draft instead of reporting success.
- Outcome comparison normalizes object key order only: the real Emulator reordered equal placement objects. Values, timestamps and array order remain compared; conflict tests remain strict.
- First confirmation stays in the busy selection task instead of prematurely displaying confirmed controls. Late acknowledgement cannot steal focus from a child task or another destination.
- Storage failure remains explicitly disclosed after remount, and newer in-memory input is not replaced by old persisted input.
- Read mode projects canonical participant attributes; selection mode projects applicant answers. Manual edit/search behavior is covered. Applicant-origin name/grade edits remain subject to existing authoritative applicant reconciliation, not a new UI override rule.

Deferred minor: duplicate-name delete confirmation still displays the raw name without the menu's disambiguating metadata; deletion retains the exact stable ID. Revisit confirmation wording in content/accessibility polish.

## Execution rulings and risks

These decisions are implementation interpretations, not official Carbon rules:

1. Inline review replaces a mandatory confirmation step because small manual additions do not need another transition. If wrong, add a review transition without changing data behavior.
2. Manual/paste registration adds canonical participants; automatic applicants use selection. If wrong, a new candidate repository needs separate domain approval, not an implicit schema change.
3. Coupled URL/form/list tasks are committed together after their gates. Cost: fewer independently revertible task commits, not reduced test coverage.
4. A precise command receipt lives in UI-local recovery because the protected outbox removes permanently rejected writes. Cost: maintain this UI adapter; shared protocol/schema remain unchanged.
5. Applicant-origin edits do not gain precedence over authoritative metadata. Cost: any requested override needs a separately scoped ownership/compatibility decision.
6. RTDB key-order differences are ignored only in UI outcome equality; all actual values remain protected. Cost if misclassified: contextual conflict and retained recovery, not silent loss.
7. Native keyboard/NVDA/physical safe area remain unverified until the human/device gate. Cost: device issues may remain for that gate.
8. The reviewer could not judge rendered geometry in its environment; executor-owned browser/geometry evidence and CI are required. Cost: missed composition issues must block later acceptance.
9. The reviewer did not rerun full matrix/production; executor owns allowed local/Emulator/CI gates, while production is prohibited. Cost: no integration before those gates pass.
10. Inherited manifest mismatches and E–H surfaces remain outside this feature change. Cost: separately review cumulative shared compatibility and deferred surfaces before final release.

## Integration

PR, CI result and integration SHA are recorded in the completion report. Only `carbon-redesign` may receive this phase; `main`, production release/deploy/cutover/smoke and production data remain untouched.
