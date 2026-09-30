# Phase C Modal task classification

This register is evidence for the Phase C boundary. It does not make every existing dialog a recommended end state.

## Basis

**Official guidance.** Carbon describes Modal as a focused layer for important information or a short task. It recommends a full page when a workflow is complex, long, or benefits from more space. Modal focus must enter the dialog, remain trapped while open, and return to the launch context when it closes. See [Carbon Modal usage](https://carbondesignsystem.com/components/modal/usage/) and [Carbon Modal accessibility](https://carbondesignsystem.com/components/modal/accessibility/).

**Project interpretation.** `approved-brief` means the current user task is intentionally allowed to remain a Modal. `legacy-migration` means Phase C preserves its behavior only; the target phase must re-evaluate and migrate it. Every rendered Modal must pass a registered `taskId` through `TaskModal`, so a new unreviewed dialog fails immediately.

## Register

| Task ID | User task | Status | Reason | Target phase | Phase C behavior preserved |
| --- | --- | --- | --- | --- | --- |
| `help-guide` | Read brief help without leaving the current task | approved-brief | Short reference information tied to the current context | — | Passive close and focus return |
| `sample-data` | Choose and apply one local test fixture | approved-brief | Single development-only decision | — | Existing sample choices and reset action |
| `bug-report` | Submit one concise report | approved-brief | One field and one submit action | — | Draft, submit, error feedback, cancel |
| `allocation-group-edit` | Add a group or change its capacity | approved-brief | Small bounded form with one commit | — | Owner/capacity validation and save |
| `allocation-group-confirm` | Confirm randomization or group/participant removal | approved-brief | One consequential decision with named effect | — | Danger treatment and cancel |
| `participant-edit` | Edit a participant's small attribute set | approved-brief | Bounded edit with one save | — | Draft isolation, validation, Escape/cancel, save |
| `participant-selection-remove` | Confirm removing selected participants | approved-brief | One decision after dependent effects are stated | — | No removal until confirmation |
| `participant-delete` | Confirm permanent participant deletion | approved-brief | High-impact single decision with explicit consequences | — | Delete/cancel behavior |
| `participant-registration` | Import, inspect, correct, and register people | legacy-migration | Import and correction form is long and repeatable | D | Existing import/parser and registration behavior |
| `participant-guidance` | Compose and review a participant announcement | legacy-migration | Requires project context and long preview | D | Existing inputs, preview, and copy behavior |
| `participant-export` | Check eligibility and generate one handoff file | approved-brief | One eligibility check and one generation action | — | Permission checks and download |
| `history-management` | Create, inspect, restore, and undo durable history | legacy-migration | Repeated management task, not a brief interruption | H | Snapshot, restore, undo, and close |
| `settlement-settings` | Complete multi-step settlement configuration | legacy-migration | Multi-step, high-impact form | G | Existing steps, validation, save/cancel |
| `settlement-car-cost` | Move between expense, movement, and route tasks | legacy-migration | Complex repeated workflow that needs surrounding context | F | Existing internal views, route apply, save/cancel |
| `settlement-collector` | Record one collector name | approved-brief | One field and one save | — | Existing save/cancel |
| `settlement-collection-review` | Review many collection states and copy unpaid people | legacy-migration | Persistent operational review over many rows | H | Filter, list, copy, close, launcher focus |

## Invariants

- `TaskModal` is the only application component that imports Carbon `Modal` directly.
- An unregistered or missing task ID throws instead of silently creating a new dialog pattern.
- `legacy-migration` is a temporary compatibility classification, not design approval.
- Phase C does not change protected data shape, calculation, persistence, or synchronization behavior.
- A failed form submit exposes the error at the field and moves focus to the first invalid enabled control.
- Closing a dialog by Escape, close, or cancel returns focus to its launch context when that context still exists.
