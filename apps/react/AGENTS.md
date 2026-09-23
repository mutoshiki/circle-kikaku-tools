# React migration working rules

- Resume from `migration/progress.json`; do not rerun recorded successful investigation or tests without a change-driven reason.
- Batch independent read-only checks and related file reads into one tool call.
- Return failure excerpts, summaries, and relevant tails instead of entire large logs.
- Narrow `git diff` to `--stat`, paths, or relevant hunks unless the full diff is required.
- Do not re-audit the established legacy architecture; read only legacy owners needed by the current task.
- Run targeted browser tests first. Run the full browser matrix at the release-candidate gate.
- Do not use subagents by default. Use them only for clearly independent work with substantial parallel benefit.
- After compaction, resume from the Goal, this progress file, and git state instead of reconstructing conversation history.
