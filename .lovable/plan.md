Plan

1. Problem
   - The new red animated sign-out button expands to 125px on hover but the "Sign out" label at 1.2em is too large for the allocated space, causing it to wrap to two lines and overlap with itself.
   - The percentage-based widths (30% icon / 70% text) plus padding do not add up cleanly inside the 125px hover width.

2. Files to change
   - src/styles.css
   - (No change to src/components/verbo/TopNav.tsx required unless the new width causes header issues, in which case the button wrapper will be verified.)

3. Implementation steps
   - Set `box-sizing: border-box` on `.Btn`, `.Btn .sign`, and `.Btn .text` so padding is included in the declared widths.
   - Increase `.Btn:hover` width from 125px to 160px so the label fits without overflow.
   - Change `.Btn .text` font-size from 1.2em to 1em and add `white-space: nowrap` so "Sign out" stays on one line.
   - Adjust `.Btn:hover .sign` to width: 20% and padding-left: 14px.
   - Adjust `.Btn:hover .text` to width: 80% and padding-right: 14px.
   - Keep the existing transition durations, colors, and active/click effect so the button feels the same as before, only proportional.

4. Verification
   - Hover the sign-out button in the preview and confirm the text "Sign out" is rendered as a single, fully readable line with no overlap.
   - Check both light and dark header variants if available.
