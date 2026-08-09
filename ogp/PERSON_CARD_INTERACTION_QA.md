# Person card interaction fix v32

## Root causes

1. A legacy delegated click handler treated the visible participant name as a gender toggle.
2. A card-wide `:focus-within` outline converted Carbon OverflowMenu's legitimate focus restoration into a persistent blue card state after pointer dismissal.

## Fix

- Participant names are display-only.
- Gender can change only through explicit `cds-menu-item` choices in the `cds-overflow-menu` gender submenu.
- The draggable card no longer draws its own descendant-focus outline. Carbon's OverflowMenu trigger remains responsible for keyboard focus indication.

## Regression coverage

- Static contract rejects any reintroduction of name-click gender cycling or card-wide `:focus-within` styling.
- Playwright flow verifies name taps preserve gender and outside pointer dismissal leaves no card outline.
