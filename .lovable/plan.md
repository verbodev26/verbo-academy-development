## Goal

Color-code the icon of each "Session Report pending/overdue" item in the Teacher Dashboard's **Needs Your Attention** list based on how much of the 24h reporting window is left. Purely visual — the KPI logic (only overdue past 24h affects Report Punctuality) already exists and is not changed here.

## Rules (icon only)

Let `remaining = (session_end + 24h) - now`.

| Remaining        | Icon         | Color                         | Extras                       |
| ---------------- | ------------ | ----------------------------- | ---------------------------- |
| 15h to <24h      | `FileEdit`   | green (`text-emerald-600`)    | —                            |
| 8h to <15h       | `FileEdit`   | yellow (`text-amber-500`)     | —                            |
| >0h to <8h       | `FileEdit`   | red (`text-red-600`)          | —                            |
| overdue (≤0h)    | `AlertCircle`| red (`text-red-600`)          | glow-pulse animation on icon |

Icon-wrapper background stays the neutral `bg-secondary` in all cases so the color reads on the glyph, not the chip.

## Changes

**`src/routes/teacher.index.tsx`**
- Extend `AttentionItem` with optional `iconClassName` (glyph color) and `iconWrapClassName` (extra classes for the wrapper — used to attach the glow-pulse animation when overdue).
- In the missing-report loop (lines ~162–176), compute `remaining` and pick `icon` + `iconClassName` from the table above; for the overdue branch swap in `AlertCircle` and add the pulse class.
- In the render (lines ~365–372), if `it.iconClassName` is set, use it instead of the default `tone`-derived color; append `it.iconWrapClassName` to the wrapper.

**`src/styles.css`**
- Add a small `@keyframes report-glow-pulse` + `.animate-report-glow` utility: pulses a red `drop-shadow` on the icon (opacity/intensity ~1s ease-in-out infinite). Scoped so it only affects the icon, not the wrapper.

Nothing else touched. `AlertCircle` is already exported by `lucide-react` (add to the existing import list if not present).

## Out of scope

- Actual Report Punctuality KPI decay curve past 24h (already flagged in a previous turn as a follow-up).
- Applying the same color scale to other attention items (strikes, availability, clubs) — only the missing-report items get the countdown coloring.