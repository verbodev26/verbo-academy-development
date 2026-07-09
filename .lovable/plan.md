## Scope

Refactor of the Student "Courses" tab into a real "Learning Path" wired to `product-courses-store` (the Admin > Content source of truth). Extends the existing quiz engine (`activities-store`) instead of rewriting it. Enterprise level 4 renamed **Global Leadership** in the seed to match spec. Everything else in Admin/Teacher/Live Sessions untouched except: (a) Category field in the activity form, (b) Reopen-for-review action on the student profile.

---

## 1. Data model changes

### `src/lib/activities-store.ts`
- Add optional `category?: ActivityCategory` on `Activity`.
- `ActivityCategory = "vocabulary" | "grammar" | "practice" | "reading" | "writing" | "pronunciation" | (string & {})` (extensible).
- `MANDATORY_CATEGORIES = ["vocabulary","grammar","practice"] as const`.
- `CATEGORY_LABELS` map for display.
- New per-activity scores store: `verbo:activity-scores` — `Record<activityId, { best: number; attempts: number; lastAt: string }>`. `recordActivityScore(activityId, unitId, score)` keeps only the best.
- Replace old `isUnitUnlocked(unitId)` semantics for the new rule while keeping the name/signature:
  - Unit passes iff for each mandatory category present in that unit, at least one activity has `best >= 60`.
  - `unitPassed(unitId)` helper drives both completion and the sequential unlock chain.
  - `setUnitCompleted` remains but is auto-driven by score updates (removed as a manual API from the runner; still callable for admin override).
- Drop the `Attempts: X/3` / 3-strike lock for mandatory activities. Optional-category activities never gate anything.
- Milestone units (unit numbers 10, 20, 30) → treated as **teacher-locked**: `isMilestoneUnit(id)`, `verbo:milestone-unlocks` store `Record<studentId+unitId, true>` with `unlockMilestone(...)` (admin-only manual override entry point) and `isMilestoneUnlocked(...)`. Sequential unlock chain treats a locked milestone as a hard stop.

### `src/lib/product-courses-store.ts`
- Rename Enterprise level 4 seed: `"Global Mastery"` → `"Global Leadership"` (per spec). Existing localStorage cache overrides seed, so also add a one-time migration in `loadCourses()` that patches the name in place when it reads the old value.
- No structural changes.

### `src/lib/students-store.ts` / admin.students profile edit
- Add `reopened_levels?: string[]` (commercial level names). Persist through the existing profile-overrides mechanism (mock-data `User` interface gets the optional field).
- Add helper `setLevelReopened(studentId, levelName, on)`.

### New: `src/lib/learning-path-events.ts`
- Lightweight timeline log: `Record<studentId, Array<{ ts, kind: "unit_unlocked"|"unit_completed"|"level_completed", ref: string }>>` in localStorage. Emitted from the runner + unlock helpers.

---

## 2. Admin: Category field in the activity form

`src/components/verbo/course-modals.tsx` (ActivityModal):
- Add a **Category** `<select>` next to Exercise Type. Options: Vocabulary, Grammar, Practice, Reading, Writing, Pronunciation, plus an "Add custom…" option that flips into a text input; custom values are stored on the activity as free strings.
- Category is required; default = Vocabulary.
- Save path writes `category` onto the persisted activity. No other Admin change.

Aside pane groups by category (small tweak) so admin can see "Vocabulary · 2, Grammar · 1, …" per unit — makes it obvious when a mandatory one is missing. Warning row appears if any of the 3 mandatory categories is missing.

---

## 3. Admin: "Reopen level for review" action

In `src/routes/admin.students.tsx` student detail view (the same panel that shows Info label="Current roadmap level"): add a small section listing the student's completed levels with a `Reopen for review` toggle per level → calls `setLevelReopened`. That's the only new admin touch.

---

## 4. Student navigation rename

`src/routes/student.tsx`: change the Performance-product nav entry label from `"Courses"` to `"Learning Path"`. Route path (`/student/courses`) stays the same to avoid regressions elsewhere.

---

## 5. Student page rewrite: `src/routes/student.courses.tsx`

Full rewrite of the page while reusing `ActivityRunner`, `ExerciseBody`, `MatchExercise`, `RecordExercise`, `evaluate` (extracted from the current file into a small local module or kept in-file). Everything below reads from `product-courses-store` (not `courses-store` / mock levels).

### 5.1 Level cards (top of page)
- Renders 4 cards for the student's product (skips entirely for VIP → route already unreachable via nav; add a guard that shows a "Not available for your product" placeholder if visited).
- Each card: image slot (`level.cover_image` if present in future; fallback = product-specific gradient + subtle pattern), commercial name, unit count, per-level progress bar, state pill.
- Five states, computed as:

  | State | When | Interaction |
  |---|---|---|
  | Completed | all non-milestone units + all milestone units passed | disabled unless `reopened_levels` includes it → then read-only mode with "Reopened for Review" pill |
  | Current | first non-completed level within contracted list | clickable, full color |
  | Locked — by progress | in contracted list, but prior level not completed | disabled, greyed, tooltip `"Complete {previous level name} to unlock"` |
  | Locked — not contracted | not in `contracted_levels` | disabled, greyed, tooltip `"Not included in your current plan — contact your advisor to upgrade"` |
  | Reopened | Completed + `reopened_levels` includes it | clickable, "Reopened for Review" badge, opens read-only view |

### 5.2 Global progress bar
- Above the cards: `"{X} of {Y} units completed — {Z}%"` where `Y = sum of units across contracted levels only`, `X = passed units within those levels`. Skips non-contracted levels entirely.

### 5.3 Milestone reminder banner
- If the current level has an upcoming milestone unit (10/20/30) whose predecessor unlocks are open and the student is within 3 units of it, render a single blue banner: `"Your Milestone Check is coming up in {N} units!"`.

### 5.4 Units view (after clicking a level)
- New visual layout: horizontal path of unit "stones" grouped into three 10-unit blocks, each block ending in a distinctly styled Milestone stone (trophy icon, gold border). Not a flat list.
- Unit states: `passed` (green check) / `current` (accent) / `locked` (grey lock) / `milestone_locked` (gold ring + `"Your teacher will unlock this Milestone Check"` tooltip).
- Read-only mode (Reopened level): all units clickable but the runner enters view-only — activities show best score, can be reviewed, Check Answer disabled.

### 5.5 Runner changes
- Same modal shell + carousel + evaluators; two new behaviors:
  - Categories are surfaced as chip tabs at the top of the runner (Vocabulary / Grammar / Practice / plus any optional groups). Optional groups are visible but tagged "Optional — does not affect progress".
  - Per-activity result recorded via `recordActivityScore`. Unit auto-completes when all mandatory categories have ≥60. Attempts unlimited; the "attempts X/3" and locked screen removed for mandatory. Milestone units cannot be entered here — blocked at the units grid.

### 5.6 Achievement timeline
- Below the level cards: "Achievement Timeline" section reading `learning-path-events` filtered to current student, newest first, capped at ~15 entries. Rows: icon + `"Completed {Level Name} — {date}"` / `"Unlocked Unit {N} — {date}"`.

### 5.7 Level completion modal
- Fires when the last unit of a level passes (including its unlocked+passed Milestone). Modal contents:
  - Confetti (small dependency-free CSS burst using absolute-positioned spans, no library) with `prefers-reduced-motion` fallback.
  - `"Congratulations! You completed {Level Name}"` + subtext.
  - `Download Certificate` button → generates a placeholder PDF via a lightweight canvas-to-PDF fallback: for now, generate an SVG blob with the level + student name and trigger download as `.svg` (real PDF template later).
  - `Continue` button closes the modal.

---

## 6. Files touched

**New**
- `src/lib/learning-path-events.ts`

**Edited**
- `src/lib/activities-store.ts` — categories, per-activity best scores, unit-pass rule, milestone-lock store
- `src/lib/product-courses-store.ts` — Enterprise L4 rename + migration
- `src/lib/mock-data.ts` — add optional `reopened_levels` on `User`
- `src/lib/students-store.ts` — `setLevelReopened` helper via profile overrides
- `src/components/verbo/course-modals.tsx` — Category select + grouped aside + missing-mandatory warning
- `src/routes/admin.students.tsx` — "Reopen for review" toggles in the student detail panel
- `src/routes/student.tsx` — nav label "Courses" → "Learning Path"
- `src/routes/student.courses.tsx` — full page rewrite as described above (runner internals preserved)

## Out of scope (explicitly not touched)

- Teacher-side Milestone unlock UI, notifications, or reminders.
- Audio-duration checker for `record`.
- Real certificate PDF design.
- Teacher Panel read-only Content view.
- Any Live Sessions / calendar / attendance code.
