# Phase C CI scope review (2026-10-01)

This is verification evidence, not a Product UI specification. The user approved reviewing the UI-only change classification after the existing shared classification blocked Phase C integration. The approved destination remains `carbon-redesign`; main and production are out of scope.

## Observed blocker

Run [36782399205](https://github.com/mutoshiki/circle-kikaku-tools/actions/runs/36782399205) passed every React check, Firebase compatibility and shared collaboration. Legacy Browser compared three identical head/base failures; Five-device collaboration compared eleven identical failures. Both comparisons reported `newFailureIds: []`. Only the additional clean-legacy gates failed because every `src/services/` path was classified as shared.

Against the reviewed integration base, the only product source path matching that shared rule is `apps/react/src/services/overview-draft.js`. Inspection confirms that its responsibility is the existing local browser recovery cache: optional name/baseline UI metadata, memo/timetable normalization, read/write/clear. It does not own room persistence, schema, Firebase, sync, network I/O or calculations. Its older cache entries remain readable. No domain defect was repaired or suppressed in this review.

## Narrow classification contract

- Only that exact local-cache path is excluded from the shared-source classification. Unknown services, nearby names, nested files, domain/store/sync, Firebase, types and protected legacy owners remain shared.
- React gates still run for this path. Existing workflow conditions continue to run Firebase compatibility and shared collaboration for React changes.
- Tools/tests/package changes in this PR still run legacy head/base comparisons, and newly introduced legacy failures still fail CI. Actual legacy/shared source changes still require clean legacy checks.
- Git diff now disables rename collapsing, retaining the deleted protected owner as well as the destination. Moving shared code to a UI path cannot bypass its gate.
- This exception applies to the reviewed responsibility, not permission to put domain code in this file. Any future room persistence, schema, sync, network or calculation responsibility must remove the exception in the same PR (or use a protected owner).
- No workflow condition, failure comparator, required check, Firebase target guard or legacy assertion was changed.

## Verification

`tests/release-change-scope-contract.mjs` executes the real classifier CLI against isolated temporary Git repositories and verifies JSON, appended GitHub outputs, additions, deletions and renames. Literal expected gate decisions cover eight behavior contracts, including protected owner paths, mixed changes and infrastructure changes. It runs in the regular static-contract command, not an optional manual-only check.

RED: local-cache classification, mixed CI/UI classification, and protected-owner rename contracts failed against the old classifier (5 passed / 3 failed). GREEN: all eight passed after the narrow exception and old-owner retention. Unknown/protected owners were passing before and remain guarded afterward.

The initial static-runner invocation rejected a single combined `--test filename` argument; the package command now invokes the test file directly, preserving the runner's existing one-script interface. The final static runner passed all 37 scripts; React unit passed all 59 tests.

The historical 1,332-file hash manifest now reports exactly the two approved CI-tool edits: `package.json` and `tools/classify-release-changes.mjs`. It has not been re-captured or its allowlist changed to manufacture an unchanged-file pass. There is still no diff from the integration base in protected product owners (domain/store/sync/Firebase/legacy source/types). Product source and browser behavior are unchanged by this CI review. Final PR CI remains the integration gate.
