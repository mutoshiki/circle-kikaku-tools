# Participant Import Copy QA — v32

## Scope

The participant-registration spreadsheet helper copy was corrected and moved from the expandable “貼り付け方を見る” section to the main import instructions, directly below the existing summary sentence.

## User-visible change

The main helper now reads, in this order:

1. `回答全体を貼り付けると、全員の名前・学年・車出しをまとめて読み込めます。`
2. `スプレッドシートの各項目の見出しの行も一緒にコピーしてください。`

The obsolete copy `各項目の見出し行も一緒にコピーすると、読み取りやすくなります。` was removed completely.

## Implementation

- Kept the text within the participant-registration modal’s owner markup.
- Added a small semantic helper-copy group in `assets/css/guides-modals/import-guide/01-import-shell.css`.
- Removed the now-unused custom notice CSS.
- Added `tests/participant-import-copy-v32-contract.mjs` to prevent wording or placement regressions.
- Updated the stylesheet cache version in `index.html`.

## Browser validation

- Repository-external temporary copy only.
- Empty policy directory supplied to the isolated Chromium process.
- Same `/usr/bin/chromium` binary.
- Repository and system policy files were not modified.
- Rendering used Playwright `page.set_content()` with local assets inlined.

### Viewports and themes

- 390 × 844 dark
- 390 × 844 light
- 1440 × 900 light

### Measured order at 390 px

- Summary copy y: 127.4 px
- Heading-row instruction y: 171.4 px
- Spreadsheet textarea y: 223.4 px

The required instruction renders exactly once, directly below the summary and above the textarea. No page errors occurred.

## Automated checks

- Static Carbon and project contracts: PASS
- Participant import copy v32 contract: PASS
- Share/OGP contract: PASS
- Google Maps lint, TypeScript, and contract: PASS
- Driver reward contract: PASS
- CSS parser: 121 files, 0 parse errors
- Stylelint: unavailable because the uploaded archive does not include the executable dependency
