# React migration working rules

- Resume from `migration/progress.json`; do not rerun recorded successful investigation or tests without a change-driven reason.
- Batch independent read-only checks and related file reads into one tool call.
- Return failure excerpts, summaries, and relevant tails instead of entire large logs.
- Narrow `git diff` to `--stat`, paths, or relevant hunks unless the full diff is required.
- Do not re-audit the established legacy architecture; read only legacy owners needed by the current task.
- Run targeted browser tests first. Run the full browser matrix at the release-candidate gate.
- Do not use subagents by default. Use them only for clearly independent work with substantial parallel benefit.
- After compaction, resume from the Goal, this progress file, and git state instead of reconstructing conversation history.

## UI design contract

- Before React UI work, read [`docs/design/SANPOKAI_PRODUCT_UI.md`](../../docs/design/SANPOKAI_PRODUCT_UI.md); it is the normative product UI specification and owns document precedence plus the minimum PR design-review checklist.
- Use [`CARBON_PRODUCT_PRINCIPLES.md`](../../docs/design/CARBON_PRODUCT_PRINCIPLES.md) for official Carbon evidence and cross-product rules, and [`CARBON_PATTERNS.md`](../../docs/design/CARBON_PATTERNS.md) for task-to-pattern selection.
- Treat [`CURRENT_UI_AUDIT.md`](../../docs/design/CURRENT_UI_AUDIT.md) as descriptive evidence only. Follow the current phase and gates in [`CARBON_MIGRATION_ROADMAP.md`](../../docs/design/CARBON_MIGRATION_ROADMAP.md).
- UI work must preserve protected data, calculation, sync, Firebase, persistence, and compatibility behavior unless a separately approved scope explicitly changes it.
