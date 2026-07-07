
# Fully editable Group cards, with propagation to linked places

The Group Detail modal today only edits ~8 of the ~18 fields captured at registration and never syncs shared fields back to member User records. This patch (a) exposes every registration field in the detail modal, and (b) automatically propagates the fields that are shared with members whenever the Group is edited — so admin/teacher/student surfaces stay in sync.

## 1. Extend `GroupDetailModal` in `src/routes/admin.groups.tsx`

Add the missing fields to the shared-fields grid (line 425), keeping the same order/layout as the Register modal for consistency:

- Product (`select`, VIP excluded) — resets `contracted_levels` + `current_roadmap_level` when it changes.
- Initial English Level (`select` from `getProduct(product).levels`) → writes `current_roadmap_level`.
- Sessions per Week (`number ≥ 1`) → `sessions_per_week`.
- Session Duration (`number ≥ 15`) → `session_duration`.
- Rescheduling Policy (`select` over `RESCHEDULE_PRESETS`) → `reschedule_policy`.
- Cycle Start (`date`) → `cycle_start`.
- Assign Teacher (`select`, filtered by `teachersForProduct(product)`) → `teacher_id`.
- Add-on Access block (3 numeric inputs matching the Register modal): `addon_insights_per_month`, `addon_bookclubs_per_month`, `addon_spotlight_per_month`.

Existing fields (Group Name, Company / Client, Max Capacity, Access Plan, Hired Sessions, Remaining Sessions, Payment Day, Video Call Link) stay as they are. `hired_sessions` continues to be freely editable; if a user lowers it below `remaining_sessions`, clamp `remaining_sessions` down in the same `updateGroup` call.

## 2. Auto-propagate shared fields — update `updateGroup` in `src/lib/groups-store.ts`

Currently `updateGroup` just persists the group. Rewrite so that after persisting, if any of the following fields changed it also mirrors them onto every non-archived member's `User` record (mutating `USERS`, writing `verbo:student-profile-overrides`, dispatching `verbo:students-updated`):

| Group field | Mirrored to User field |
|---|---|
| `product` | `product` |
| `focus` | `focus` |
| `access_plan` | `access_plan` + `hired_plan` |
| `contracted_levels` | `contracted_levels` |
| `current_roadmap_level` | `current_roadmap_level` |
| `company_client` | `company` |
| `video_call_link` | `video_call_link` |
| `addon_insights_per_month` | `addon_insights_per_month` |
| `addon_bookclubs_per_month` | `addon_bookclubs_per_month` |
| `addon_spotlight_per_month` | `addon_spotlight_per_month` |
| `addon_workshops_enabled` | `addon_workshops_enabled` |

If `teacher_id` changed, upsert `ASSIGNMENTS` for every active member so `/admin/students`, `/admin/sessions`, teacher panel and calendar all reflect the new teacher. If `teacher_id` is cleared, remove those assignments.

Group-level-only fields (`name`, `max_capacity`, `hired_sessions`, `remaining_sessions`, `sessions_per_week`, `session_duration`, `reschedule_policy`, `payment_day`, `cycle_start`, `next_payment`, `last_paid_at`) are NOT copied to members — they live only on the Group and are already read from the Group via `effectiveSessionCounts` and Group Detail elsewhere.

Broadcast both `verbo:groups-updated` (already done) and `verbo:students-updated` so the Students list, Sessions page, teacher panel and calendar re-render immediately.

## 3. No changes to the RegisterGroupModal

Registration flow (`registerGroupWithMembers`) already writes the initial values onto member Users. This patch only adds edit-time parity.

## Files touched
- `src/lib/groups-store.ts` — extend `updateGroup` with the propagation step (mutate USERS + persist profile overrides + upsert ASSIGNMENTS + broadcast students event).
- `src/routes/admin.groups.tsx` — expand `GroupDetailModal` with the missing fields and the level/product cascade behavior; clamp remaining when hired lowers.

Nothing else in the codebase needs to change: `admin.students.tsx` already reads live values from `USERS` and `groups-store` through the helpers added earlier, and `/admin/sessions`, teacher calendar, and teacher panel already read those same singletons.
