# Site-wide Copy Improvements Implementation Plan

> **For agentic workers:** Follow this plan in order. Mark an item complete only after its source change and required verification are done.

**Goal:** Apply the report's adopted copy improvements to the current production-based React app while preserving calculations, persistence, and established terminology.

**Architecture:** Make owner-local text changes in the existing React components and source domain, then regenerate generated domain output only through the repository generator. Keep the audit report as the reference for adoption and defer wording that requires an unimplemented feature or a product-policy decision.

**Tech Stack:** React, Carbon React 1.115, Node test/build scripts, Vite preview.

**Spec:** `C:/Users/toshi/Documents/GitHub/circle-kikaku-tools/artifacts/reports/2026-10-26-site-copy/report.md` and `recommendations.csv` (audit of production SHA `5cbf3a4ab68af6909292412f03b7f389d7188c58`).

## Scope rulings

- Apply all `採用推奨` copy decisions where current runtime and available data support the proposed wording.
- Apply `条件付き` decisions only when their stated condition can be met without adding an unrelated capability or inventing an operational fact; otherwise record the reason as deferred.
- Do not implement `維持`, `要仕様確認`, or `保留` decisions as copy changes.
- Preserve established payment labels `割勘から` and `部費から`, optional payer-name entry, calculation and save behavior, external destinations, and shared data semantics.
- The repository's release policy applies after required verification; use its standard PR/readiness/release path and production smoke room only.

## Tasks

- [x] Inventory adopted decisions against source owners and note conditional deferrals.
- [x] Update participant registration/import and allocation/deletion copy; verified the existing handlers remain attached.
- [x] Update settlement, collection, and expense copy; preserved the established `割勘から` / `部費から` labels and calculation handlers.
- [x] Update status/error, route, announcement/export, guide, and bug-report copy; deferred proposals that need an unimplemented input or confirmation flow.
- [x] Translate Carbon ProgressStep state labels through the installed `translateWithId` API.
- [x] `git diff --check`, preview build, and preview identity check passed. Rendered UI inspected at 393×852 and 1280×900, in light and dark themes, including settlement, participant registration, and changed modals. React unit suite passed 145/145; legacy static contracts passed.
- [x] Updated browser-test labels and notice expectations to match the clarified sample copy after CI exposed stale exact-text selectors.
- [ ] Release validation and production publication are tracked through the repository PR and release workflow; record final run IDs and SHA after completion.

## Verification focus

- Japanese copy substitutions do not change message classification or settlement calculations.
- Save, retry, deletion, sample replacement, and reporting actions retain their existing timing and destination.
- Conditional warning text accurately reflects the actual state and names; avoid promising unavailable recovery or edits.
- Check responsive wrapping, focus labels, and current/error states in rendered UI.

## Completion notes

- Implemented applicable adopted copy decisions in the React UI and authoritative domain string sources, then regenerated generated domain output with the repository generator.
- Conditional proposals that require an unavailable meeting-place input or screen-reader confirmation remain deferred. No calculation, persistent data shape, or share destination was changed.
- Physical-device rendering, browser zoom, and screen-reader behavior were not verified. Automated results are recorded above; release evidence will be recorded with the corresponding PR and Actions runs.
