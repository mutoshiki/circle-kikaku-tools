> **履歴資料**: このレポートに記載された`assets/css/visual/`構成は、正規owner統合前の状態です。現在の構成は`OWNER_INTEGRATION_REPORT.md`と`CSS_OWNER_MAP.md`を参照してください。

# Product Shell V2 UI Refresh Report

## 1. Purpose

The previous minimal SaaS pass was visually too close to the original white-card interface. This pass keeps the existing information architecture, DOM order, screen layout, routes, actions, data flow, and interaction positions, while replacing the visual system with a clearly different product shell.

The theme feature remains completely removed. The application has one visual system only.

## 2. New visual direction

- Dark ink product header instead of a white utility header
- White pill navigation embedded in the dark header
- Indigo as the single primary action color
- Cool slate application canvas instead of a nearly white page
- Stronger card boundaries and a left-side accent for allocation cards
- More deliberate title and amount hierarchy
- Dark modal headers with a unified modal frame
- Dark presentation summary bar with crisp white data tables
- Flat, restrained inner controls with clearer focus and hover states
- Reduced decorative softness while retaining comfortable touch targets

## 3. Structure and behavior preserved

The following remain unchanged:

- Three main views and their order
- Header action positions
- Car/team assignment layout
- Waiting tray placement and behavior
- Presentation-view data order and zoom/edit controls
- Settlement sections, calculations, forms, and modal flow
- Drag-and-drop interactions
- Sample/debug data behavior
- Responsive breakpoints and intended scroll containers

No application JavaScript behavior was changed for this redesign.

## 4. Browser verification

Playwright-managed Chromium was used at:

- 360 × 800
- 390 × 844
- 430 × 932
- 768 × 1024
- 1280 × 720
- 1440 × 900

Captured states include:

- Allocation view
- Team allocation view
- Presentation view
- Empty presentation state
- Quick-edit state
- Settlement view
- Missing-cost/error state
- Header menu
- Overview drawer
- Batch import modal
- Guide modal
- Settlement settings modal
- Car settlement editor modal
- Route helper modal

Final audit output:

- 84 PNG screenshots
- 7 comparison/contact-sheet JPEGs
- 6 viewport audit reports
- Console errors: 0
- Failed requests: 0
- Document-level unintended horizontal overflow: 0
- Main scroll-container unintended horizontal overflow: 0

## 5. Main visual changes

### Product header

The header is now a dark product shell. The room title is rendered in high-contrast white, icon actions sit in dark bordered controls, sharing is a distinct indigo action, and the three primary views use an embedded pill navigation.

### Allocation workspace

The layout is unchanged, but the workspace now uses a cool slate canvas, strong white panels, consistent border contrast, indigo left accents, and clearer separation between vehicle headers and member slots.

### Presentation workspace

The summary area now uses a dark information bar. Car and team tables remain in the same arrangement but use stronger headers, more restrained row surfaces, and clearer table grouping.

### Settlement workspace

The settlement hierarchy now emphasizes the settings shell, total-cost equation, payment sections, and monetary values. Summary cards use restrained semantic top rules rather than soft tinted card styling alone.

### Modal system

All major modals use the same dark header, white body, clear footer, and stronger elevation. Form positions and controls remain unchanged.

## 6. CSS architecture

The former single visual skin was split by responsibility:

- `assets/css/visual/01-product-shell.css`
- `assets/css/visual/02-allocation-sheet.css`
- `assets/css/visual/03-settlement.css`
- `assets/css/visual/04-overlays-responsive.css`
- `assets/css/visual/05-header-resolution.css`

Shared colors, borders, radii, and semantic surface values are defined in:

- `assets/css/tokens/01-color-scheme.css`

No `!important` declarations were added. Component CSS does not contain hard-coded colors; visual values reference token variables.

## 7. Changed files

### Application

- `index.html`
- `package.json`
- `package-lock.json`
- `assets/css/tokens/01-color-scheme.css`
- Removed: `assets/css/visual/01-saas-skin.css`
- Added: `assets/css/visual/01-product-shell.css`
- Added: `assets/css/visual/02-allocation-sheet.css`
- Added: `assets/css/visual/03-settlement.css`
- Added: `assets/css/visual/04-overlays-responsive.css`
- Added: `assets/css/visual/05-header-resolution.css`

### Architecture guards and visual baselines

- `tests/control-consistency-check.js`
- `tests/css-fixed-scope-owner-check.js`
- `tests/css-owner-baseline.json`
- `tests/css-split-check.js`
- `tests/major-css-cleanup-check.js`
- `tests/s-deep-refactor-check.js`
- Six visual-regression PNG baselines

## 8. Tests

- CSS lint: passed
- Static test suite: 65 files passed
- Playwright interaction tests: 4 passed
- Playwright visual regression, 360/390/430: 3 passed
- Playwright visual regression, 768/1280/1440: 3 passed
- Theme-removal guard: passed

## 9. Screenshot locations

- Previous-design reference: `screenshots/20-v2-baseline/`
- First V2 browser iteration: `screenshots/21-v2-iteration/`
- Final V2 captures and audit reports: `screenshots/22-v2-final/`
- Comparisons and overview sheets: `screenshots/22-v2-final/contact-sheets/`

## 10. Remaining limitation

At narrow mobile widths, a long project title still truncates according to the existing header-space rules. This is deliberate because the header action positions and interaction structure were preserved. It does not hide any action or create horizontal overflow.
