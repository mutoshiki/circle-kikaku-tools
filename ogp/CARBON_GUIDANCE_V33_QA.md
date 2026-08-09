# Carbon guidance and lock-state QA — v33

## Scope

- Participant-import wording and manual-field placeholders
- Bottom Content Switcher labels and lock indicators
- Allocation-condition Popover geometry and lifecycle
- One-time Carbon Toast guidance for allocation and shared views
- Shared-view participant count suffixes

## Root changes

- Lock state is rendered from `editLockScopes` by `updateBottomNavigationLockIndicators()`; it is not inferred from the selected tab or trusted-device state.
- Allocation conditions use the official Carbon Popover and Icon Button. Carbon owns `top-end` placement and collision handling; the previous shadow-DOM transform clamping was removed.
- One-time guidance is persisted before display, only after a stable room URL exists, so room-creation redirects cannot consume the message.
- Shared-view statistics append the Japanese counter in the summary renderer, keeping all presentation paths consistent.

## Validation

- Static project test suite: pass
- Mobile viewport: 390 × 844
- Desktop viewport: 1280 × 900
- Browser: system Chromium through Playwright (Browser plugin unavailable)
- Popover opens entirely above the settings icon, stays inside the viewport, closes on outside pointer input, and closes with Escape.
- Actual lock setup modal shows the correct lock icons for both selected scopes.
- Allocation and shared-view guidance each appears once and does not reappear after reload or revisiting the view.
- Shared-view count values render with `名`.
- No relevant app console errors were observed; expected offline Firebase/network failures were excluded from app-error assessment.
