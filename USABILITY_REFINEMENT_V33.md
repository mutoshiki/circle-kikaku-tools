# Usability refinement v33

This release addresses the 17-point usability and visual-consistency audit without changing stored data structures or primary navigation.

1. Shared presentation adds a labelled **全体表示** control. The normal readable view keeps horizontal pan available; the explicit fit action calculates the exact scale needed to include the complete canvas and reports **全体表示中**.
2. Status feedback shown while a modal is open is rendered inside that modal instead of overlaying its footer.
3. Participant registration separates spreadsheet import and manual entry with Carbon Content Switcher and Carbon Accordion.
4. The mobile route map uses viewport-relative height.
5. Edit-lock state is visible as a Carbon Tag while icon controls retain accessible names.
6. Small copy uses the shared caption/micro typography tokens and never drops below 12 px.
7. Shared-view totals are condensed into readable primary and detail lines.
8. Settlement setting values use Carbon Select instead of navigation-like Content Switchers.
9. Gender metadata uses neutral Carbon tag families so blue remains an interaction/selection color.
10. Settlement totals use neutral cards with semantic category lines.
11. Memo/timetable drawer has a labelled dialog header, keyboard focus management, and mobile full-screen geometry.
12. Shared-view edit uses a labelled Carbon Button in both edit and completion states.
13. Modal headings follow one text-only rule; contextual icons remain in body content and actions.
14. Timetable URLs render as concise accessible link labels while preserving the original href for editing and navigation.
15. Feedback surface rules are documented and enforced by the UI module.
16. **推奨** is metadata in a separate Carbon Tag, not part of the participant-registration action name.
17. Application CSS/JS references use one cache key and a contract test guards all changes.
