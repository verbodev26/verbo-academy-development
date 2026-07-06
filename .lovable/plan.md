## Goal

Link existing Performance Sessions to VIP builder units. When a linked session is completed via Session Report, its VIP unit is marked done and the next unit in creation order unlocks. No new session-creation entry point; VIP units keep counting toward KPIs, teacher hour count, calendar, and the 7 states through the existing session engine — nothing there changes.

## Data model

Extend `LessonPlan` in `src/lib/lesson-plans-store.ts` with an optional field:

- `vip_unit_id?: string` — id of the VIP unit this session covers. Only ever set when the student's product is `"vip"`.

Extend `src/lib/vip-courses-store.ts` with per-unit completion state:

- New key `verbo:vip-unit-completion` → `Record<vipUnitId, { session_id: string; completed_at: string }>`.
- Helpers: `markVipUnitDone(unitId, sessionId)`, `isVipUnitDone(unitId)`, `vipUnitDoneMap()`, plus subscribe/broadcast.

No changes to sessions-store shape — the link lives on the LessonPlan side, keyed by `session_id`, so the 7 states, teacher counts, KPIs, calendar, and reports stay untouched.

## Lesson Plan modal — add "Link to VIP Unit" field

In `src/components/verbo/PlanModal.tsx`:

- Detect VIP: `student.product === "vip"`.
- When VIP, render a new field `Link to VIP Unit` (optional, visible for ANY Session Type — independent from the existing Level/Unit fields that only show for Syllabus/Evaluation).
- Options come from `unitsForStudent(session.student_id)` in creation order, labeled `Unit N · <title>`, with a leading `— None —` option.
- Already-completed units (present in `vipUnitDoneMap()`) get a small "Done" tag and are still selectable (in case the teacher needs to re-tag), but the default is "None".
- Persist as `vip_unit_id` on the LessonPlan via the existing `onSave` flow — no new save path.
- Non-VIP students: field is hidden entirely; no behavior change.

## Session Report — unlock next unit on Completed

In `src/routes/teacher.index.tsx` (and `teacher.students.tsx` if it has its own report submit path) where `submitSessionReport(...)` is called:

- After the report is submitted and the session's resulting status is `completed`, look up `getLessonPlan(session.id)?.vip_unit_id`. If present, call `markVipUnitDone(vip_unit_id, session.id)`.
- Absent / cancelled / no_show reports do NOT mark the unit done — the teacher can re-link the unit to the make-up session later.
- Only one unit per session; if the plan's `vip_unit_id` changes on a later edit, the completion record follows the latest linked unit (last-write-wins), and the previous unit reverts to not-done unless another completed session still links it.

## Course Builder VIP — reflect real completion

In `src/routes/teacher.vip.tsx`:

- Replace the current "N-1 completed sessions" heuristic with the real per-unit completion map:
  - Unit is `Done` if `isVipUnitDone(unit.id)`.
  - Unit is `Unlocked` if it's unit 1, or if the previous unit (in creation order) is `Done`.
  - Otherwise `Locked until previous unit completed`.
- Badges: `Done` (success), `Unlocked` (accent), `Locked until previous unit completed` (muted). Replaces the current "Locked until session N completed" text since the trigger is now unit completion, not raw session count.
- On each Done unit, show a tiny "via <session date>" caption linking to that session (read-only) so the teacher can see which session closed it.
- Student list cards get an extra pill: `X/Y done`.

## Out of scope

- No new session-creation entry point in the VIP builder.
- No changes to the 7-state model, teacher hour count, KPIs, calendar, attendance, or Session Report contents.
- Student Panel visuals (blurring locked VIP units for the student) still deferred to the Student Panel phase.

## Language check

All new UI strings in English: "Link to VIP Unit", "— None —", "Done", "Unlocked", "Locked until previous unit completed", "X/Y done", "via <date>".