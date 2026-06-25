## Audit results

TypeScript build is clean (`tsgo --noEmit` passes). No broken routes, no JSX/syntax errors. Below are the real issues I found, grouped by severity, plus the proposed surgical fixes.

### 1. Dead buttons (no handler, no navigation)

| # | File / line | Button | Problem |
|---|---|---|---|
| A | `src/routes/student.boost.tsx:121` | "Start exercise" on each drill card | No `onClick`, no `Link`. Clicking does nothing. |
| B | `src/routes/student.index.tsx:519` | Download icon in recent sessions table | `disabled` flag works, but enabled state has no `onClick` — clicking the row's download does nothing even when `report_pdf_url` exists. |
| C | `src/routes/student.courses.tsx:555` | Audio Play button inside `listen_select` activity | No `onClick` and no audio element wired. |

**Fixes**
- A: Make the card-level "Start exercise" a no-op toast ("Exercise coming soon") consistent with other mock-only actions, OR wire it to scroll/focus the first available drill. Recommendation: simple `alert("This drill will launch soon.")` to match the mock-app pattern already used elsewhere.
- B: Add `onClick={() => window.open(s.report_pdf_url!, "_blank")}` so the existing `report_pdf_url` mock link is honored (matches the same pattern used in the teacher "Mock download" button).
- C: Add `onClick={() => alert("Audio playback is mocked in this demo.")}` and an `aria-label="Play audio clip"`, matching the existing mock-alert convention used throughout student.courses / student.sessions.

### 2. Minor cleanup

- `src/routes/student.boost.tsx` imports `Target` from lucide but never uses it — remove the unused import.
- `RatingModal` star buttons have no `type="button"` — harmless today (no surrounding `<form>`) but good practice; add `type="button"` to prevent accidental form submits if ever embedded.

### 3. Verified OK (no change needed)

- All other `<button>` elements without `onClick` are intentionally `disabled` (e.g. "Cancelled" pill, "Overdue (Locked)", locked download row) — correct behavior.
- All `alert(...)` calls are intentional mock placeholders (PDF download, mic access, club booking limits, cancellation messages). Keeping them is consistent with the demo-data architecture.
- `/student/boost` route is properly registered and reachable from `/student/performance` Boost Skill buttons.
- TopNav links, role guards, logout flow, and route tree all wire up correctly.
- Performance percentage calc, color thresholds, and Rocket-icon Boost button match the earlier specs.

### Technical changes (one diff per fix)

1. `src/routes/student.boost.tsx` — add `onClick` to "Start exercise" button + drop unused `Target` import.
2. `src/routes/student.index.tsx` — add `onClick` to the recent-sessions download icon button using `s.report_pdf_url`.
3. `src/routes/student.courses.tsx` — add `onClick` + `aria-label` to the listen_select Play button.
4. `src/components/verbo/RatingModal.tsx` — add `type="button"` to the star buttons.

No business logic, no styling, no route changes.