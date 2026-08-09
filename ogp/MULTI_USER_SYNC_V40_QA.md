# Multi-user sync v40 QA

## Root cause
The room was saved as one large Firebase update on every edit. A settlement edit therefore also resent stale allocation/car-plan data, and one driver's settlement edit resent the whole `settlement` object. With multiple devices, the last writer could overwrite unrelated edits or reintroduce a participant another device had deleted.

## Fix
- Firebase RTDB `runTransaction()` is now the single remote commit path.
- Each save captures the last synced base at the instant of the local action.
- Only top-level fields actually changed since that base are applied.
- `settlement`, `overview`, and lock scopes use recursive three-way merge.
- Settlement cars merge independently; payment maps merge by participant key.
- Remote data received while settlement inputs are focused is queued and folded into the transaction before rendering.
- Shared-screen quick edits use the same transaction path instead of a direct whole-room `update()`.
- The "他の人が更新しました" popup was removed; sync state remains visible via the existing status indicator.
- A synced-base snapshot is stored locally so an unsynced draft after reload can still be merged without restoring stale room data.

## Regression coverage
`npm test` passes, including `tests/multi-user-sync-v40-contract.mjs` for:
- two devices editing different cars simultaneously;
- simultaneous payment checks;
- participant deletion while another device edits settlement;
- stale settlement clients not re-adding a remotely deleted participant;
- no remote-edit popup;
- no direct whole-room sheet update bypass.

## Browser validation limitation
The environment's Chromium navigation policy blocks localhost (`ERR_BLOCKED_BY_ADMINISTRATOR`), so rendered URL navigation could not be completed. Static, syntax, and concurrency contract tests passed.
