# React migration working rules

- Resume from `migration/progress.json`; do not rerun recorded successful investigation or tests without a change-driven reason.
- Batch independent read-only checks and related file reads into one tool call.
- Return failure excerpts, summaries, and relevant tails instead of entire large logs.
- Narrow `git diff` to `--stat`, paths, or relevant hunks unless the full diff is required.
- Do not re-audit the established legacy architecture; read only legacy owners needed by the current task.
- Run targeted browser tests first. Run the full browser matrix at the release-candidate gate.
- Do not use subagents by default. Use them only for clearly independent work with substantial parallel benefit.
- After compaction, resume from the Goal, this progress file, and git state instead of reconstructing conversation history.
- Before opening any React preview, read [`docs/development/current-workspace.md`](../../docs/development/current-workspace.md), refresh the public `release-build.json` manifest, and use its `sourceSha` as the baseline. Never infer source identity from a port, URL, or visual similarity.
- Build local previews with `npm run build:preview -- --baseline-source-sha <published-sourceSha>` and require `npm run check:preview -- --url <localhost-url> --expected-source-sha <published-sourceSha>` to pass before browser comparison. The verified preview uses local-only storage; do not connect it to production Firebase or mutate the live room.
- Keep existing user worktrees, open reference tabs, and uncommitted files intact. A preview/build identity mismatch is a stop condition; explain the source, output directory, and data target before continuing.
- For React UI changes that affect text, spacing, alignment, density, or responsive layout, read [`docs/design/react-typography-spacing.md`](../../docs/design/react-typography-spacing.md) and complete its review checklist before calling the UI work complete. Check actual rendered computed styles at a mobile and desktop width, in light and dark themes; verify the Carbon type mixin emitted real values rather than relying on undefined custom properties.
- For a new screen or modal, add it to `docs/design/ui-screen-matrix.md`, choose an existing UI pattern before creating a new one, and verify its narrow/desktop and empty/populated/error boundaries in the browser tests.
- For shared UI or copy changes, compare the presence and placement of headings, descriptions, labels, empty/loading/error states, actions, save feedback, and close/back controls across equivalent states. Keep differences only when the tool's workflow requires them; update `docs/design/ui-screen-matrix.md` with the owner and evidence.
- For modal or dialog UI changes, add a state-by-state entry to the modal review record described in `docs/design/react-typography-spacing.md`, including viewport, theme, keyboard result, evidence, and any unverified reason. In completion reports, list the tested modal states and call out untested zoom, physical-device, or screen-reader behavior; never report an untested state as passed.
