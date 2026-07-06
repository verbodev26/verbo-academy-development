## Problem

The `SectionTitle` component in `src/components/verbo/ui.tsx` (line 14) is hardcoded with `text-slate-50` on top of `text-foreground`. `text-slate-50` is near-white and overrides the theme token, so every `<SectionTitle>` in the app (Participants, Units, and dozens more across Teacher/Admin/Student panels) renders as white text — invisible on light surfaces.

## Fix

Single-line change in `src/components/verbo/ui.tsx`:

- Remove the hardcoded `text-slate-50` from the `<h2>` inside `SectionTitle`.
- Keep `text-foreground` so the title uses the theme color token (adapts to light/dark and stays readable on every surface).

That one edit fixes every occurrence of the issue across the app — no other file needs to change and no design token needs to be added.

## Out of scope

- No changes to other components, colors, or spacing.
- No design system tweaks beyond removing the stray hardcoded class.
