# Design Refinement QA — v26

## Scope

v25 was rendered in an isolated Chromium session and inspected across the allocation, shared-view, settlement, and modal workflows. The audit covered light/dark semantic tokens, Carbon component host sizing, mobile clipping, focus states, notifications, menus, drawers, and desktop density. GitHub and system browser policies were not modified.

## Render environment

- Browser plugin: unavailable
- Fallback: Playwright with system Chromium
- Navigation policy: localhost navigation was blocked by the managed browser policy
- Isolated method: the project was copied outside the repository, all local styles/scripts/assets were inlined, and the page was rendered on `about:blank` with `page.set_content()`
- Viewports: 360×800, 390×844, 1440×900
- Theme: dark for the full interaction audit; light allocation smoke test also completed
- Seed state: deterministic local sample data; no Firebase writes

## Findings fixed

1. Dark low-contrast warning/error notifications inherited light surfaces and dark-theme text incorrectly.
   - Added the complete Carbon success, info, warning, and error support/background token bridge for both themes.
2. Dynamic modal headings showed a browser focus rectangle despite Carbon programmatic focus.
   - Preserved focus semantics while removing the visual outline and box shadow on modal headings.
3. Timetable time inputs clipped the last digit on mobile.
   - Increased the time column to 116 px and retained 112 px at narrow widths.
4. The extra-cost burden select clipped `割勘`.
   - Increased its column to 112 px, with a 104 px narrow-mobile variant, and shortened negative labels to `割勘 −` / `部費 −`.
5. The participant-registration primary action wrapped to two lines.
   - Renamed it to the concise `登録する`.
6. Routine header utility icons and person overflow triggers inherited the blue link accent.
   - Kept Share and locked states accented; returned ordinary utility actions to Carbon neutral icon roles.
7. Settlement section glyphs were re-accented by a later owner stylesheet.
   - Mapped them to the secondary icon role.
8. Persistent settlement labels fell below Carbon caption size.
   - Raised settings and club-expense labels to the shared caption token.
9. The fill-empty-seats action used a paint-brush metaphor.
   - Replaced it with the official Carbon `user--follow` icon.

## Rendered interaction checks

- App load and deterministic sample data
- Header utilities and share accent
- Overview drawer and all HH:MM fields
- Share modal
- Participant registration modal
- Planning-check warning notification
- Settlement page
- Settlement settings modal
- Vehicle cost editor
- Route helper and missing-Maps error state
- Lock setup, copy fallback, decision modal, history, and sample-data modal
- Header and person overflow menus
- Mobile 360 px and 390 px overflow audits
- Desktop 1440 px allocation smoke test

## Measured results

- 390 px document width: 390 px
- 390 px horizontal overflow elements: 0
- 390 px visible leaf text below 11.5 px: 0
- 360 px document width: 360 px
- 360 px extra-cost burden select: 104 px
- Timetable time control: full `HH:MM`, `scrollWidth === clientWidth`
- Dynamic modal heading: focused, `outline: none`, `box-shadow: none`
- Batch primary action: `scrollWidth === clientWidth`, one line
- Dark warning background: `#3a2b00`, support color `#f1c21b`
- Dark error background: `#520408`, support color `#ff8389`

## Automated checks

- Static Carbon contracts: PASS
- Dark accent and popup semantic contract: PASS
- Rendered design refinement contract: PASS
- Google route planner lint: PASS
- Google route planner TypeScript: PASS
- Google route planner contract: PASS
- Driver reward policy contract: PASS
- Share/OGP contract: PASS
- JavaScript syntax check for changed template: PASS
- CSS parser: 121 files, 0 parse errors

## Remaining limits

The Google Maps network/API flow was not exercised because the isolated QA configuration deliberately contains no API key. Real iOS Safari and live Firebase synchronization were not available in this environment. Chromium rendering and the local interaction/state transitions listed above were verified.
