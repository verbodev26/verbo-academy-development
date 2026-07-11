# DATA_MODEL.md — Verbo Academy

**Generado:** 2026-07-11, leyendo el código real del repo `verbodev26/verbo-academy-development` (rama `main`) vía `raw.githubusercontent.com` (único método de acceso de solo-lectura disponible en este entorno; `git clone`/`api.github.com` están bloqueados aquí).

**Alcance de esta versión:** se leyeron los ~45 archivos de `src/lib/*.ts` (stores + modelos + utilidades de datos), `src/lib/mock-data.ts` (fuente de `User`, `Session`, `ASSIGNMENTS`, `LEVELS`, `MATERIALS`), `src/components/verbo/RoleGuard.tsx` y `TopNav.tsx`, los tres layouts de rol (`admin.tsx`, `teacher.tsx`, `student.tsx`), y una muestra de 17 componentes/rutas para la sección de Deuda de Datos. **No se leyeron línea por línea** todas las ~40 rutas ni los ~50 componentes de UI genéricos (`src/components/ui/`) — donde algo depende de un archivo no leído, se marca explícitamente con ⚠️ en vez de asumirlo.

**Regla seguida:** ningún campo, entidad o enum de este documento fue inventado — todo proviene de código fuente citado. Donde algo es ambiguo o no se pudo verificar, se marca con ⚠️ en vez de resolverlo.

---

## Índice

1. Núcleo — Usuarios y Roles
2. Sesiones y Calendario
3. Cursos y Contenido Académico
4. Retos y Gamificación (Challenges / Verbo Flash)
5. Clubs y Workshops
6. Grupos, Asistencia y Disciplina
7. Comunicación (anuncios, notificaciones, reportes, log de actividad)
8. Financiero (solo tracking, nunca cobro real)
9. Performance / KPIs
10. Configuración y Taxonomías
11. Matriz de permisos por rol
12. Enums y estados (consolidado)
13. Deuda de datos (consolidado)

---

## 1. Núcleo — Usuarios y Roles

### `User` (`src/lib/mock-data.ts`)

**Propósito:** entidad maestra única para Admin, Teacher y Student (discriminada por `role`) — combina perfil del alumno, modelo comercial, perfil de maestro y datos de nómina en una sola interfaz plana ("god object").

| campo | tipo | requerido/opcional | notas |
|---|---|---|---|
| id | string | requerido | |
| name | string | requerido | |
| email | string | requerido | |
| password | string | requerido | ⚠️ texto plano en seed data |
| role | `"student" \| "teacher" \| "admin"` | requerido | |
| current_level | string | opcional | referencia informal a `Level.id`, sin FK tipada |
| admin_type | `"super_admin" \| "coordinator_ops" \| "coordinator_fin"` | opcional | solo relevante si `role === "admin"` |
| attendance_percentage | number | opcional | |
| avatar | string | opcional | (ver también `avatar-store.ts`, que guarda avatares por separado, ver §10) |
| company | string | opcional | perfil corporativo del alumno |
| hired_plan | string | opcional | ⚠️ alias legacy de `access_plan`, documentado como tal en el propio código |
| member_since | string (ISO date) | opcional | |
| hired_sessions | number | opcional | |
| remaining_sessions | number | opcional | |
| product | `"enterprise" \| "go" \| "international" \| "vip"` | opcional | |
| focus | string | opcional | nombre de "Enfoque" (solo GO/International) |
| access_plan | `"Core" \| "Advance" \| "Elite" \| "Signature"` | opcional | |
| contracted_levels | string[] | opcional | nombres comerciales de nivel del roadmap |
| current_roadmap_level | string | opcional | |
| reopened_levels | string[] | opcional | niveles reabiertos por admin, modo solo-lectura |
| sessions_per_week | number | opcional | |
| session_duration | number | opcional | minutos |
| reschedule_policy | string | opcional | preset o "Custom" |
| reschedule_custom_hours | number | opcional | |
| reschedule_custom_pct | number | opcional | |
| payment_day | number | opcional | 1–31 |
| cycle_start | string (ISO date) | opcional | |
| next_payment | string (ISO date) | opcional | |
| video_call_link | string | opcional | ⚠️ también existe en `Group`, sincronizado manualmente (ver §6) |
| status | `"active" \| "suspended" \| "frozen"` | opcional | estado del alumno |
| insights_strikes | number | opcional | |
| bookclub_strikes | number | opcional | |
| sessions_auto | boolean | opcional | |
| admin_notes | string | opcional | |
| freeze_start / freeze_end | string | opcional | |
| product_type | `"performance" \| "workshops" \| "insights"` | opcional | legacy default a "performance" si falta |
| addon_insights_per_month | number | opcional | |
| addon_bookclubs_per_month | number | opcional | |
| addon_spotlight_per_month | number | opcional | |
| addon_workshops_enabled | boolean | opcional | solo toggle; membresías de cohorte viven en `workshops-store.ts` |
| qualified_products | (`"enterprise"\|"go"\|"international"\|"vip"`)[] | opcional | perfil de maestro |
| hourly_rate | number | opcional | MXN/hora |
| teacher_status | `"active" \| "frozen" \| "removed"` | opcional | |
| rating | number | opcional | 0–5 |
| plan_punctuality / report_punctuality | number | opcional | % |
| hours_month / hours_cycle | number | opcional | |
| availability | `{ day: string; slots: string[] }[]` | opcional | |
| availability_request | `{ note: string; requested_on: string } \| null` | opcional | |
| payment_frequency | `"weekly" \| "biweekly" \| "monthly"` | opcional | |
| payment_records | `{ id; date; status: "pending"\|"paid" }[]` | opcional | |
| adjustments | `{ id; date; amount: number; reason: string }[]` | opcional | |

**Relaciones:** casi todas las demás entidades del sistema referencian `User.id` vía `student_id`/`teacher_id`/`actorId`/etc. Ver `ASSIGNMENTS` abajo para la relación maestro↔alumno.

---

### `AdminType` / `CoordinatorType` (`src/lib/admin-roles.ts`)

- `AdminType`: `"super_admin" | "coordinator_ops" | "coordinator_fin"`
- `CoordinatorType` (etiqueta derivada): `"operations" | "financial"` — se deriva de `admin_type` vía `coordinatorTypeOf()`.

### `UserStatusOverride` (`src/lib/admin-roles.ts`)
Override de activo/desactivado para usuarios internos (admins), persistido aparte de `User`.

| campo | tipo | notas |
|---|---|---|
| status | `"active" \| "deactivated"` | clave del mapa = `User.id` |

### `CreateInternalUserInput` (`src/lib/admin-roles.ts`)
Payload de creación de usuario interno (no persistido como tal, produce un `User`).

| campo | tipo | requerido | notas |
|---|---|---|---|
| name | string | sí | |
| email | string | sí | único, case-insensitive |
| password | string | sí | mínimo 4 caracteres |
| role | Role | sí | |
| admin_type | AdminType | condicional | obligatorio si `role === "admin"` |

### `ASSIGNMENTS` (`src/lib/mock-data.ts`)
**Propósito:** tabla puente maestro↔alumno — **la única fuente de verdad** de esta relación referenciada por `teacher-model.ts`, `groups-store.ts`, `teacher.tsx`, `substitute-engine.ts`.

```ts
{ teacher_id: string; student_id: string }[]
```
Tipo anónimo, sin `id` propio, sin `interface` exportada, sin timestamps de auditoría.

### `Avatar` (`src/lib/avatar-store.ts`)
Mapa `userId → dataUrl` (base64 completa). Sin interfaz formal (`Record<string,string>`).

---

## 2. Sesiones y Calendario

### `Session` (base, `src/lib/mock-data.ts`)

| campo | tipo | requerido/opcional | notas |
|---|---|---|---|
| id | string | requerido | |
| student_id | string | requerido | ⚠️ para sesiones de workshop, guarda el `cohort_id`, no un alumno real |
| teacher_id | string | requerido | |
| date_time | string (ISO) | requerido | |
| duration_minutes | number | requerido | |
| teams_link | string | requerido | |
| status | `SessionStatus` | requerido | |
| absent_cause | `"student" \| "teacher"` | opcional | |
| report_pdf_url | string | opcional | |
| student_rating | number | opcional | |
| student_comment | string | opcional | |
| review_status | `"pending" \| "reviewed"` | opcional | |
| review_note | string | opcional | |
| notes | string | opcional | |
| attendance_delayed | boolean | opcional | ver ⚠️ en §12 sobre `"delayed"` |
| report_submitted_at | string | opcional | alimenta KPI `report_punctuality` |
| origin | `"course" \| "workshop"` | opcional | |
| workshop_cohort_id / workshop_template_id / workshop_topic | string | opcional | |

### `ExtSession` (`src/lib/sessions-store.ts`)
Extiende `Session` (con `Omit<Session,"status">`), agregando el ciclo de vida real de la sesión:

| campo | tipo | requerido/opcional | notas |
|---|---|---|---|
| status | `ExtSessionStatus` (11 valores, ver §12) | requerido | sobrescribe `Session.status` |
| group_id | string | opcional | agrupa sesiones de un mismo grupo |
| member_statuses | `Record<string, ExtSessionStatus>` | opcional | key = studentId implícito |
| member_absent_cause | `Record<string, "student"\|"teacher">` | opcional | |
| attendance_sub_status | `AttendanceSubStatus` | opcional | |
| member_sub_statuses | `Record<string, AttendanceSubStatus>` | opcional | |
| report_locked | boolean | opcional | |
| report_admin_edits | `ReportAdminEdit[]` | opcional | auditoría |
| cancellation_reason | `"illness"\|"personal"\|"major_issue"\|"other"` | opcional | |
| cancellation_note | string | opcional | |
| needs_substitute | boolean | opcional | |
| report_comments | string | opcional | |

### `ReportAdminEdit` (`src/lib/sessions-store.ts`)
| campo | tipo | requerido/opcional |
|---|---|---|
| at | string | requerido |
| actorId | string | requerido |
| actorName | string | opcional |
| studentId | string | opcional |
| field | `"status"\|"sub_status"\|"member_status"\|"member_sub_status"` | requerido |
| from / to | string | requerido |
| note | string | opcional |

### `LessonPlan` (`src/lib/lesson-plans-store.ts`)
**Propósito:** plan de clase que el maestro llena por sesión.

| campo | tipo | requerido/opcional | notas |
|---|---|---|---|
| session_id | string | requerido | PK/clave del store, 1 plan por sesión |
| title | string | requerido | |
| type | `"Syllabus content"\|"Additional Content"\|"Review Session"\|"Casual Topic"\|"Evaluation"` | requerido | |
| level_id / unit_id | string | opcional | |
| vip_unit_id | string | opcional | solo si el alumno es producto `vip` — completar la sesión marca la unidad VIP como hecha |
| comments | string | requerido | |
| planning_status | `"on-time" \| "late"` | requerido | |
| saved_at | string (ISO) | requerido | |

**Relación confirmada:** este es el campo que resuelve el vínculo "sesión completada ↔ unidad VIP" mencionado (sin definirse) en `vip-courses-store.ts` — `LessonPlan.vip_unit_id` es la clave real.

### `CalendarEvent` (`src/lib/calendar-events.ts`) — **derivado, no persistido**
Proyección unificada de `Session`/`Club` para pintar el calendario. No se guarda en ningún lado — se recalcula on-demand. `studentCalendarEvents(studentId)` incluye 1:1 sessions del alumno **y** todos los `Club` (`insight`+`book`) no cancelados, para que el alumno pueda navegar/reservar directamente desde el calendario (la gating de cupo por plan ocurre al reservar, no al listar). En `student.sessions.tsx`, `availableKinds` se calcula dinámicamente según `resolvedRemainingSeats`/`resolvedMonthlyCap` — Advance/Elite/Signature solo ven las kinds a las que su plan da acceso; Core mantiene visibilidad completa por ahora.


| campo | tipo | notas |
|---|---|---|
| id, kind, date, duration_minutes, title | — | ver detalle completo en el archivo fuente |
| kind | `"class"\|"workshop"\|"insight"\|"book_club"\|"spotlight"` | |
| status | `ExtSessionStatus \| TimeStatus` | |
| is_group / group_id / spots_taken / spots_total / enrolled_names | — | solo aplican según el tipo de evento |

### `AvailabilityChangeRequest`, `TeacherAvailability`, `TimeBlock` — ver §6.

---

## 3. Cursos y Contenido Académico

### `Level` / `Unit` (`src/lib/mock-data.ts`) — catálogo genérico CEFR (A1–B2)

**`Level`**: `id` (ej. "A1"), `title` (ej. "A1 — Beginner"), `units: Unit[]`.
**`Unit`**: `id` (ej. "A1-U1"), `title`, `video_url` (requerido, vacío en seed), `pdf_url` (requerido, vacío en seed).

⚠️ Ver §13 — este catálogo (`courses-store.ts`) coexiste sin relación de código con el catálogo por producto (`product-courses-store.ts`) y con `VipUnit` — tres representaciones distintas de "unidad".

### `ProductCourse` / `CourseLevel` / `CourseUnit` (`src/lib/product-courses-store.ts`)

**Propósito:** catálogo de cursos por producto comercial (GO/Enterprise/International), 3 niveles: Producto → Nivel comercial → Unidades.

```ts
ProductId = "go" | "enterprise" | "international"
ProductCourse { product: ProductId; levels: CourseLevel[] }
CourseLevel { id: string; name: string; units: CourseUnit[] }
CourseUnit { id: string; title: string; video_url: string; pdf_url: string }
```

Nombres de nivel confirmados por producto:
- **go:** Kickstart, Everyday Flow, Confident Voice, Culture Master
- **enterprise:** Core Foundations, Strategic Fluency, Executive Presence, Global Leadership (migración automática desde el nombre legacy "Global Mastery")
- **international:** Survival Basics, Travel Ready, Social Fluency, Full Command

⚠️ **No existe ningún campo de gating/progreso** (`Completed`/`Current`/`Locked`, "Contracted Levels") en este archivo — se buscó explícitamente y no aparece. Si esa lógica existe en producción, vive en otro archivo (componente de UI o store de inscripciones) no cubierto en esta lectura.

### `VipUnit` / `VipUnitCompletion` (`src/lib/vip-courses-store.ts`)

**`VipUnit`**: unidad de curso "a medida" creada por el maestro para un alumno VIP.

| campo | tipo | requerido/opcional | notas |
|---|---|---|---|
| id | string | requerido | patrón `VIP-<studentId>-<timestamp>` |
| student_id | string | requerido | FK → estudiante |
| title | string | requerido | |
| file_url | string | requerido | material descargable |
| file_name | string | opcional | |
| created_at | string | requerido | |

**`VipUnitCompletion`**: `{ session_id: string; completed_at: string }`, clave = `unitId`. Se vincula a `LessonPlan.vip_unit_id` (ver §2).

### `Activity` (`src/lib/activities-store.ts`)

| campo | tipo | requerido/opcional | notas |
|---|---|---|---|
| id | string | requerido | |
| unit_id | string | requerido | patrón `"A1-U1"` |
| name | string | requerido | |
| type | `ExerciseType` | requerido | ver §12 |
| category | string | opcional | libre, admin-extensible |
| session_phase | `"pre"\|"post"` | opcional | default "pre" |
| paragraph / answer / items / prompt / audioName / question / options / correctIndex | — | opcional | según `type` |

**`MatchItem`**: `{ text: string; key: string }`.
**`ActivityScore`**: `{ best: number; attempts: number; lastAt: string }`, clave = `` `${studentId}::${activityId}` `` — ✅ scoped por alumno desde 2026-07-11 (fix bug de progreso compartido).
Mapas relacionados sin interfaz formal, todos con clave compuesta `` `${studentId}::${unitId}` ``: `Completion` (→ `boolean`), `Attempts` (→ `number`), `MilestoneUnlocks` (→ `boolean`).

### `StoredMaterial` (`src/lib/materials-store.ts`)

| campo | tipo | requerido/opcional | notas |
|---|---|---|---|
| id | string | requerido | |
| title | string | requerido | |
| material_type | `MaterialType` | requerido | |
| category | string | requerido | libre, catálogo dinámico |
| upload_url | string | requerido | |
| cover_image | string | opcional | |
| restrict_product | `"go"\|"enterprise"\|"international"` | opcional | filtro de visibilidad |
| restrict_level | string | opcional | debe coincidir con un nombre en `RESTRICT_PRODUCTS`, sin validación tipada |

⚠️ Coexiste con `Material`/`MATERIALS` de `mock-data.ts` (campos: `id, title, material_type, upload_url, category`, sin `restrict_product`/`restrict_level`) — dos catálogos de materiales paralelos, ver §13.

### `LearningPathEvent` (`src/lib/learning-path-events.ts`)
| campo | tipo | notas |
|---|---|---|
| ts | string (ISO) | |
| kind | `"unit_unlocked"\|"unit_completed"\|"level_completed"` | |
| ref | string | id de nivel o unidad |
| label | string | opcional |

Persistencia: `Record<studentId, LearningPathEvent[]>`, dedupe 60s, máx. 100 eventos/alumno.

---

## 4. Retos y Gamificación (Challenges / Verbo Flash)

### `Challenge` (`src/lib/challenges-store.ts`)

| campo | tipo | requerido/opcional | notas |
|---|---|---|---|
| id | string | requerido | patrón `PRODUCTO-DIFICULTAD-C<n>` |
| product | `"go"\|"enterprise"\|"international"\|"vip"` | requerido | |
| difficulty | `DifficultyId = "esencial"\|"intermedio"\|"avanzado"\|"experto"` | requerido | |
| premium | boolean | opcional | exclusivo de planes Advance/Elite |
| skill_tags | string[] | opcional | tags informativos: Speaking/Writing/Reading/Listening |
| category | string | requerido | libre |
| title / description | string | requerido | |
| video_url | string | requerido | vacío = sin adjunto |

✅ Verificado 2026-07-11 contra el código real: `DifficultyId` sí incluye `'experto'` y `Challenge` sí declara `premium`/`skill_tags`. No había ninguna inconsistencia real.

### `FlashChallenge`, `LightningState`, `FlashSeason`, `FlashConfig` (`src/lib/flash-challenges-store.ts`)

**`FlashChallenge`**: `id, format: FlashFormat, product: FlashProductId, category, title, description, video_url?, premium?, skill_tags?`.

**`LightningState`** (singleton global):
| campo | tipo | notas |
|---|---|---|
| status | `"inactive"\|"live"\|"expired"` | |
| challenge_id | string \| null | FK → `FlashChallenge.id` |
| product | FlashProductId \| null | |
| activated_at / expires_at | string \| null (ISO) | |
| duration_hours | number | |
| accepted_student_ids | string[] | N:M embebido como array |

**`FlashSeason`**: `id, display_name, theme_image_url?, accent_color?, font_preset, custom_font_name?, active, badge_name, created_at`. 13 temporadas semilla.

**`FlashConfig`**: `{ box_art_url?: string }`.

⚠️ `FlashProductId` (`"enterprise"|"go"|"international"`, **sin `"vip"`**) es inconsistente con `ChallengeProductId` de `challenges-store.ts` (sí incluye `"vip"`).

---

## 5. Clubs y Workshops

### `Club` / `ClubReleaseRequest` (`src/lib/clubs-store.ts`)

**`Club`**: `id, type: ClubType, title, description, link, material?, cover_image?, teacher_id? , date, duration_minutes, spots_taken, spots_total, status: TimeStatus, teacher_payment?, claimed_at?`.
**`ClubReleaseRequest`**: `id, club_id, teacher_id, reason, requested_at`.

`ClubType = "insight" | "book"` — ⚠️ **no incluye `"spotlight"`**, aunque `ClubReportEventType` sí lo tiene (ver abajo).

### `ClubBooking` (`src/lib/club-bookings-store.ts`)
`id, student_id, club_id, club_type, booked_at`. El cupo mensual efectivo se resuelve por `resolvedMonthlyCap(studentId, kind)` con la tabla **`PLAN_DEFAULTS`** (fuente única de verdad por `AccessPlanId`): Core `0/0/0` (freemium aparte), Advance `2/2/1`, Elite `4/4/4` (**acumulable**: `resolvedRemainingSeats` calcula `cap × meses_desde_cycle_start − total_reservas_historicas`), Signature `∞/∞/∞`. Los add-ons manuales `addon_insights_per_month`/`addon_bookclubs_per_month`/`addon_spotlight_per_month` en `User` o `Group` (incluyendo `0`) siempre ganan al default de plan — control absoluto del admin. Constante: `RESERVATION_CUTOFF_HOURS = 24`. UI muestra `∞` para Signature en "seats used" y "spotlight cap".


### `ClubReport` (`src/lib/club-reports-store.ts`)
`event_id` (PK lógica), `event_type: "insight"|"book"|"spotlight"`, `teacher_id`, `attendance: Record<student_id, "present"|"absent">`, `comments`, `submitted_at`.

⚠️ `event_id` puede apuntar a un `Club.id` o, si `event_type === "spotlight"`, a un evento que **no existe como `Club`** (`ClubType` no tiene `"spotlight"`) — relación ambigua, no verificable con el código leído.

### `WorkshopTemplate` / `WorkshopUnit` / `WorkshopCohort` / `WorkshopParticipant` (`src/lib/workshops-store.ts`)

**`WorkshopTemplate`**: `id, name, description, cover_url, units: WorkshopUnit[], cohorts: WorkshopCohort[]`.
**`WorkshopUnit`**: `id, title, video_url, pdf_url`.
**`WorkshopCohort`**: `id, name, participants: WorkshopParticipant[]` (máx. 4, forzado en código), `teacher_id, video_call_link, cohort_open: Record<unitId,boolean>, per_participant_open: Record<participantId, Record<unitId,boolean>>, sessions?` (⚠️ **@deprecated**, ver nota).
**`WorkshopParticipant`**: `id, name, kind: "student"|"standalone"`.
**`WorkshopSessionEntry`** — marcado **@deprecated** en el propio código: "Live sessions now live in the shared sessions store... kept so older persisted cohorts don't crash on load."

---

## 6. Grupos, Asistencia y Disciplina

### `Group` / `GroupMember` (`src/lib/groups-store.ts`)

**`GroupMember`** (tabla de unión): `student_id, group_id, status: GroupMemberStatus, joined_at, removal_started_at?, archived_at?, prior_group_id?`.
`GroupMemberStatus = "active" | "pending_removal" | "archived"` (ventana de gracia de 30 días antes de archivar).

**`Group`**: `id, name, company_client, max_capacity, product_type: "performance", product?, focus?, access_plan?, contracted_levels?, current_roadmap_level?, hired_sessions, remaining_sessions, sessions_per_week?, session_duration?, reschedule_policy?, reschedule_custom_hours?, reschedule_custom_pct?, payment_day?, cycle_start?, next_payment?, video_call_link?, teacher_id?, addon_insights_per_month?, addon_bookclubs_per_month?, addon_spotlight_per_month?, addon_workshops_enabled?, created_at`.

⚠️⚠️ **Duplicación masiva `Group` ↔ `User`**: `Group` replica ~15 campos que también existen en `User` individual (product, focus, access_plan, contracted_levels, video_call_link, addons, política de reagendamiento). `propagateGroupToMembers()` **copia explícitamente** estos valores hacia cada `User` miembro cada vez que se edita el grupo — dos fuentes de verdad sincronizadas a mano. Ver §13.

### `StudentAttendance` (`src/lib/attendance-store.ts`) — ⚠️ **100% sintético**
`{ present: number; late: number; absentOrNoShow: number }`. No hay persistencia real: se genera con un hash determinístico del `studentId`. El propio archivo dice que el motor real de "Session Report" que grabará asistencia real **aún no existe**.

### `Strike` (`src/lib/strikes-store.ts`)
`id, teacher_id, session_id, reason: CancelReason, note?, medical_note_name?, created_at, needs_substitute?, substitute_found?, justified?, justification_cause?: JustificationCause, justified_at?`.

Efecto lateral: al llegar a 3 strikes activos, muta `User.teacher_status = "frozen"` vía un mapa de overrides separado (`verbo:teacher-profile-overrides`).

### `TeacherAvailability` / `TimeBlock` / `AvailabilityChangeRequest` (`src/lib/availability-store.ts`)

**`TeacherAvailability`**: `teacherId, weekly: Record<DayKey, TimeBlock[]>, confirmedAt?`.
**`TimeBlock`**: `{ startMin: number; endMin: number }`.
**`AvailabilityChangeRequest`**: `id, teacherId, reason?, proposed: Weekly, status: "pending"|"approved"|"rejected", createdAt, resolvedAt?`.

`DayKey = "mon"|"tue"|"wed"|"thu"|"fri"|"sat"` — ⚠️ **excluye domingo por completo** (regla de negocio hardcodeada, no data-driven).

### Nota de cobertura (`src/lib/coverage-notes-store.ts`) — sin interfaz formal
Mapa `` `${teacherId}:${studentId}` → note: string ``. ⚠️ `teacherIsTitularOf()` es un **stub incompleto**: solo verifica que el usuario exista y sea teacher, no la titularidad real (que supuestamente vive en `ASSIGNMENTS`).

### `Holiday` (`src/lib/holidays-store.ts`)
`id, date, label, created_at`. Puramente informativo — nada en el sistema bloquea/cancela automáticamente con base en esta lista.

---

## 7. Comunicación

### `Announcement` (`src/lib/announcements-store.ts`)
`id, message` (máx. 280 chars), `audience: "all"|"students"|"teachers", published_at, expires_at?`.
⚠️ Los "dismissals" (cierre del banner) **no están asociados a `userId`** — array global por navegador. Contraste con `notifications-store.ts` (ver abajo), que sí scoped por usuario.

### `Notification` (`src/lib/notifications-store.ts`) — **derivado, no persistido**
Solo se persiste el estado de lectura (`ReadMap: Record<userId, Record<notificationId, true>>`). La lista de notificaciones se recalcula on-demand a partir de Sessions, Clubs, AvailabilityChangeRequests, Strikes, KPIs, Announcements, FinancialIssues, StudentReports.
`NotificationKind` (15 valores) — ver §12.

### `ActivityEntry` (`src/lib/activity-logs-store.ts`) — **derivado, no persistido**
Log de actividad administrativa (Super Admin), recomputado on-demand. `id, kind: ActivityKind, action, detail, timestamp, actorId, actorName, actorRole, personId?`.
⚠️ `personId` es un único campo que apunta indistintamente a `student_id` o `teacher_id` sin discriminador explícito en el objeto (solo se infiere por `kind`).

### `StudentReport` (`src/lib/student-reports-store.ts`)
`id, student_id, teacher_id, created_at, text`. ⚠️ TODO explícito en el código: no hay canal de entrega implementado (chat interno o WhatsApp, decisión pendiente) — el reporte se persiste pero no se notifica a nadie todavía.

### `StudentRequest` (`src/lib/student-requests-store.ts`)
`id, kind: "reschedule"|"spotlight", student_id, assigned_teacher_id?, origin_session_id?, proposed_datetime, duration_minutes, spotlight_context?, last_report_summary?, requested_at, status: "open"|"claimed"|"escalated"|"assigned"|"cancelled", claimed_by?, claimed_at?`.

Al reclamarse, crea una **nueva sesión** en `sessions-store` (`rs-${req.id}`/`sp-${req.id}`), copiando datos — vínculo solo por convención de ID, no FK explícita.

---

## 8. Financiero (solo tracking — nunca transacciones reales)

### `FinancialIssue` (`src/lib/financial-issues-store.ts`)
`id, teacher_id, text, created_at`. Reporte de texto libre del maestro, sin montos — correctamente modelado como no-transaccional.

### `PaymentLogEntry` (`src/lib/payments-log.ts`)
`id, entity_type: "individual"|"group", entity_id` (**FK polimórfica** → `User.id` o `Group.id`), `name, company?, amount, paid_at, month` (`YYYY-MM`).

El propio comentario del archivo aclara: **no es una tabla de pagos paralela**, es un log de eventos "se cobró"; la fuente de verdad de "próximo pago" sigue viviendo en `User.next_payment`/`Group.next_payment`.

⚠️ **Hallazgo más relevante de esta sección:** `amount` no se guarda por cliente — se deriva de una tabla de tarifas hardcodeada (`PLAN_RATE`: Core=4000, Advance=6000, Elite=9000, Signature=15000 MXN, ×1.6 si es grupo). No existe ningún campo `monthly_amount`/`price` explícito en `User` ni `Group` — un cliente con precio negociado no tiene dónde guardarse.

---

## 9. Performance / KPIs

### `PerformanceRating` / `PerformanceMap` (`src/lib/performance-store.ts`)
`{ fluency, vocabulary, confidence, grammar }` (escala 1–5, legacy) + `subskills?: Record<"Macro:Sub", number>` (escala 0–100). Clave del mapa = `sessionId` (sin campo `session_id` propio dentro del objeto).

`saveSubskillEvaluation()` recalcula las 4 claves legacy como promedio de los subskills, escalado 0-100→1-5, para mantener compatibilidad retro.

### `TeacherKpis` / `RatingBand` / `RatingPoint` (`src/lib/teacher-kpis.ts`)
`TeacherKpis`: `rating, ratingNormalized, connectionPunctuality, planningPunctuality, reportPunctuality, completionRate, teacherAbsenceRate, cancellationScore, activeStrikes, composite, bonusEligible`.
Fórmula del composite: promedio de 6 métricas. `BONUS_THRESHOLD_DEFAULT = 85`.

---

## 10. Configuración y Taxonomías

### `MacroSkill` / `SubSkill` (`src/lib/skills-taxonomy.ts`)
`MacroKey = "Speaking"|"Writing"|"Listening"|"Reading"`, cada una con 4-6 sub-habilidades ligadas a un `BaseKey` (`fluency`|`vocabulary`|`confidence`|`grammar`). `skillKey(macro,sub)` genera la clave canónica usada en `PerformanceRating.subskills`.

### `Candidate` (`src/lib/substitute-engine.ts`) — no persistido
`{ teacher: User; score: number }`. `findCandidates(sessionId)` filtra maestros activos, excluye al original, ordena por `TeacherKpis.composite`. ⚠️ No verifica en código que quien invoca sea admin — el comentario "Admin always picks manually" es una nota de flujo UX, no un control de acceso real.

---

## 11. Matriz de permisos por rol

### Capa 1 — `RoleGuard.tsx` (gate grueso, en los 3 layouts de ruta)
Compara `user.role` (3 valores) contra un `allow` fijo por layout. No conoce `admin_type`. Sin sesión → `/login`; rol incorrecto → home del rol propio.

### Capa 2 — `admin-roles.ts` → `canAccessAdminPath()` (gate fino dentro de `/admin`)

| Ruta / sección | super_admin | coordinator_ops | coordinator_fin |
|---|---|---|---|
| `/admin` (Dashboard) | ✅ | ✅ | ❌ |
| Students, Groups, Sessions | ✅ | ✅ | ❌ |
| Teachers | ✅ | ✅ | ❌ |
| KPIs | ✅ | ✅ | ✅ |
| Courses, Workshops, Challenges, Flash, Materials | ✅ | ✅ | ❌ |
| Clubs | ✅ | ✅ | ❌ |
| Holidays | ✅ | ✅ | ❌ |
| Financial / Money Lab | ✅ | ❌ | ✅ |
| Users | ✅ | ❌ | ❌ |
| Activity Logs | ✅ | ❌ | ❌ |

⚠️ **Modelo de seguridad inconsistente**: `coordinator_ops` es *permitir por defecto, denegar 3 excepciones*; `coordinator_fin` es *denegar por defecto, permitir 2 excepciones*. Una ruta nueva bajo `/admin` sin agregarse a ninguna lista queda **abierta automáticamente** para `coordinator_ops` y **cerrada automáticamente** para `coordinator_fin`.

⚠️ `admin.tsx` además duplica esta decisión con una regla hardcodeada por nombre de label (`if (g.label === "Users" || g.label === "Activity") return adminType === "super_admin"`), redundante con `canAccessAdminPath` — riesgo de que ambas reglas diverjan.

### Capa 3 — Teacher (`teacher.tsx`)
Sin sub-tipos de teacher, layout único. El nav filtra un ítem ("Course Builder VIP") por asignación propia vía `ASSIGNMENTS` — **filtro por propios registros a nivel de navegación**, no de datos. La separación real "un teacher solo ve sus alumnos/sesiones" vive en helpers de store (`assignedStudents()`, `activeStudents()`, `teacherCalendarEvents()`) — ⚠️ **no se verificó en esta lectura** que todas las páginas hijas (`/teacher/students`, `/teacher/calendar`, etc.) efectivamente usen esos helpers en vez de leer el store crudo.

### Capa 4 — Student (`student.tsx`)
Sin sub-tipos. Nav varía por `product_type` y por `product === "vip"`. No requiere filtro de "propios registros" porque el alumno solo ve su propio contexto (`useAuth().user`). Confirmado en `studentCalendarEvents()`: filtra por `student_id === studentId` o pertenencia a grupo.

### Resumen global

| Rol / sub-tipo | `/admin/*` | `/teacher/*` | `/student/*` |
|---|---|---|---|
| admin + super_admin | Total | ❌ | ❌ |
| admin + coordinator_ops | Todo excepto Financial/Users/Activity Logs | ❌ | ❌ |
| admin + coordinator_fin | Solo Financial + KPIs | ❌ | ❌ |
| teacher | ❌ | Total en su layout; datos limitados a `teacher_id` propio (parcialmente verificado) | ❌ |
| student | ❌ | ❌ | Total en su layout; datos limitados a `student_id` propio |

---

## 12. Enums y estados (consolidado)

| Enum | Valores exactos | Archivo |
|---|---|---|
| `Role` | `student \| teacher \| admin` | mock-data.ts |
| `AdminType` | `super_admin \| coordinator_ops \| coordinator_fin` | admin-roles.ts |
| `SessionStatus` (base) | `scheduled \| completed \| absent \| delayed` | mock-data.ts — ⚠️ ver contradicción abajo |
| `ExtSessionStatus` (real) | `scheduled \| rescheduled \| ready \| rearranged \| completed \| absent \| delayed \| cancelled \| pending_reschedule \| no_show \| converted_to_spotlight` | sessions-store.ts |
| `AttendanceSubStatus` | `absent_work \| absent_illness \| absent_vacation \| cancelled_illness \| cancelled_holiday \| cancelled_work` | sessions-store.ts |
| `cancellation_reason` | `illness \| personal \| major_issue \| other` | sessions-store.ts |
| `CancelReason` (Strike) | `illness \| personal \| major_issue \| other` | strikes-store.ts |
| `JustificationCause` | `evidence_provided \| force_majeure \| illness` | strikes-store.ts |
| `product` | `enterprise \| go \| international \| vip` | mock-data.ts |
| `access_plan` | `Core \| Advance \| Elite \| Signature` | mock-data.ts |
| `status` (student) | `active \| suspended \| frozen` | mock-data.ts |
| `teacher_status` | `active \| frozen \| removed` | mock-data.ts |
| `product_type` (User) | `performance \| workshops \| insights` | mock-data.ts |
| `payment_frequency` | `weekly \| biweekly \| monthly` | mock-data.ts |
| `GroupMemberStatus` | `active \| pending_removal \| archived` | groups-store.ts |
| `DayKey` | `mon \| tue \| wed \| thu \| fri \| sat` (⚠️ sin domingo) | availability-store.ts |
| `ClubType` | `insight \| book` (⚠️ sin "spotlight") | clubs-store.ts |
| `ClubReportEventType` | `insight \| book \| spotlight` | club-reports-store.ts |
| `TimeStatus` (Club) | `upcoming \| live \| completed \| cancelled` | clubs-store.ts |
| `ChallengeProductId` | `go \| enterprise \| international \| vip` | challenges-store.ts |
| `DifficultyId` (declarado) | `esencial \| intermedio \| avanzado \| experto` | challenges-store.ts |
| `FlashFormat` | `mystery_box \| lightning \| season` | flash-challenges-store.ts |
| `FlashProductId` | `enterprise \| go \| international` (⚠️ sin "vip") | flash-challenges-store.ts |
| `MaterialType` | `book \| pdf \| verb-list \| video \| image` | mock-data.ts |
| `ExerciseType` | `fill_gaps \| drag_drop \| listen_select \| read_select \| record \| read_complete \| match` | activities-store.ts |
| `ActivityKind` (log) | 20 valores (ver activity-logs-store.ts) | activity-logs-store.ts |
| `NotificationKind` | 15 valores (ver notifications-store.ts) | notifications-store.ts |
| `LessonSessionType` | `Syllabus content \| Additional Content \| Review Session \| Casual Topic \| Evaluation` | lesson-plans-store.ts |
| `StudentRequestKind` | `reschedule \| spotlight` | student-requests-store.ts |
| `StudentRequest.status` | `open \| claimed \| escalated \| assigned \| cancelled` | student-requests-store.ts |
| `PaidEntityType` | `individual \| group` | payments-log.ts |
| `Audience` (Announcement) | `all \| students \| teachers` | announcements-store.ts |

⚠️ **Contradicción documentada en el propio código**: `SessionStatus` declara `"delayed"` como valor válido, pero el comentario en `Session.attendance_delayed` dice explícitamente que "delayed" no es un status canónico (la sesión debe quedar en `"completed"` con `attendance_delayed: true`). Ninguna sesión del seed usa `status: "delayed"`, consistente con el comentario, no con el tipo.

---

## 13. Deuda de datos (consolidado, no corregido — solo documentado)

### Duplicación de entidades / conceptos

1. **"Unidad de curso" modelada 3 veces**: `Unit` (mock-data.ts, catálogo CEFR genérico), `CourseUnit` (product-courses-store.ts, catálogo por producto), `VipUnit` (vip-courses-store.ts, a medida por alumno) — mismos campos base (`id`, `title`, `video_url`/`file_url`, `pdf_url`) sin relación estructural entre sí.
2. **"Catálogo de materiales" duplicado**: `Material`/`MATERIALS` (mock-data.ts, simple) vs. `StoredMaterial` (materials-store.ts, con `restrict_product`/`restrict_level`) — dos fuentes para el mismo concepto.
3. **"Producto comercial" como dos tipos distintos con los mismos 3 valores**: `ProductId` (product-courses-store.ts) y `RestrictProduct` (materials-store.ts).
4. **`Challenge` vs `FlashChallenge`**: misma forma (id/product/category/title/description/video_url) con discriminador distinto — candidatos a unificarse con columna `kind`.
5. **Duplicación masiva `Group` ↔ `User`**: ~15 campos replicados y sincronizados a mano vía `propagateGroupToMembers()` (ver §6).
6. **Relación maestro-alumno en dos lugares**: `ASSIGNMENTS` (array plano) vs. `Group.teacher_id` + membresía de grupo — sincronizados manualmente en `groups-store.ts`.
7. **`hired_plan` vs `access_plan`** en `User` — alias legacy documentado como tal en el propio código, nunca limpiado.
8. **Cálculo de "% de progreso" (`done = hired - remaining; pct = done/hired*100`) duplicado en al menos 3 componentes** (`admin.students.tsx`, `admin.sessions.tsx`, `teacher.students.tsx`) en vez de vivir en un store.
9. **Promedio de ratings de sesión calculado 3 veces** en 3 componentes distintos (`PerformanceAnalytics.tsx`, `RatingTrendModal.tsx`, `admin.students.tsx`), ninguna en un store.
10. **"Profesores calificados para un producto" implementado de 3 formas distintas**: helper correcto (`teachersForProduct()`), sin filtrar en absoluto, y un filtro manual reinventado — todo dentro de `admin.sessions.tsx` y `admin.students.tsx`.

### Naming inconsistente

11. **camelCase vs snake_case para el mismo concepto de ID**, mezclado dentro del mismo repo: `teacherId`/`studentId` (availability-store, coverage-notes-store, funciones de club-bookings-store) vs. `teacher_id`/`student_id` (la mayoría de los demás stores y los campos persistidos reales). Postgres/Supabase normalmente usa snake_case — habrá que homogeneizar antes de migrar.
12. **FK a "profesor" con 3 nombres distintos**: `teacher_id` (mayoría), `assigned_teacher_id` + `claimed_by` (student-requests-store.ts).
13. **"Fecha de creación" con 6 nombres distintos** a través del código: `created_at`, `createdAt`, `published_at`, `confirmedAt`, `lastAt`, `timestamp`.
14. **Claves compuestas con separadores distintos**: `` `${studentId}::${unitId}` `` (activities-store, doble `::`) vs. `` `${teacherId}:${studentId}` `` (coverage-notes-store, `:` simple).
15. **"¿Usuario ya vio/descartó X?" implementado de 2 formas incompatibles**: con scoping por `userId` en `notifications-store.ts`, sin scoping (global al navegador) en `announcements-store.ts`.

### Datos sintéticos / no persistidos que parecen reales

16. **`attendance-store.ts` es 100% sintético** — no hay ningún registro real de asistencia, se genera con un hash del `studentId`. El motor real ("Session Report engine") aún no existe según el propio comentario del código.
17. **`activity-logs-store.ts` y `notifications-store.ts` no son fuentes de verdad** — son vistas computadas on-demand desde otros stores. Necesitarán tablas reales o vistas materializadas en Supabase, no una migración 1:1.
18. **IDs generados como `prefijo-${Date.now()}-${random}`** en casi todos los stores — no son UUIDs reales, riesgo de colisión a escala; deben migrar a `uuid`/identity columns.

### Relaciones ambiguas o incompletas

19. **`ClubReport.event_id`** puede apuntar a un `Club.id` o a un evento "Spotlight" que no existe como `Club` (`ClubType` no incluye `"spotlight"`, `ClubReportEventType` sí).
20. **`teacherIsTitularOf()` (coverage-notes-store.ts) es un stub** — no valida la titularidad real, que supuestamente vive en `ASSIGNMENTS` pero el código lo admite como pendiente ("keep this here as a hook for future refinement").
21. **`Session.student_id` es polimórfico**: a veces `User.id` real, a veces un `cohort_id` cuando `origin === "workshop"` — sin discriminador tipado.
22. **`PaymentLogEntry.entity_id` es una FK polimórfica** (`User.id` o `Group.id` según `entity_type`) — no se puede expresar como FK simple en Postgres.
23. ~~**`ActivityScore`, `Completion`, `Attempts` (activities-store.ts) no tienen `studentId`**~~ — ✅ **Resuelto 2026-07-11**: los tres mapas ahora se indexan por clave compuesta `` `${studentId}::${unitId}` `` (o `` `::${activityId}` `` para scores), replicando el patrón de `MilestoneUnlocks`. Todas las funciones (`loadCompletion`, `setUnitCompleted`, `loadAttempts`, `incrementAttempts`, `resetAttempts`, `loadActivityScores`, `recordActivityScore`, `bestScoreFor`, `unitPassed`, `unitCategoryProgress`, `isUnitUnlocked`) requieren `studentId` como primer parámetro. `renameUnitReferences` migra las claves preservando el prefijo `studentId`.
24. **Ningún campo de precio/monto explícito por cliente** — `payments-log.ts` deriva `amount` de una tabla de tarifas hardcodeada (`PLAN_RATE`); un cliente con precio negociado no tiene dónde guardarse.
25. **Dos sistemas de nombres de "nivel" sin relación explícita**: `Level.id` estilo CEFR (A1, B1…) vs. nombres comerciales de roadmap en `User.contracted_levels` (Core Foundations, Strategic Fluency…).
26. **`Material`/`MATERIALS` no tiene FK a `Level`/`Unit`** pese a la relación conceptual esperada.
27. **`vip-courses-store.ts` referencia `LessonPlan.vip_unit_id`** — este vínculo SÍ existe (confirmado en `lesson-plans-store.ts`, §2), pero solo se documentó explorando un archivo aparte; ningún comentario cruzado lo señala directamente en `vip-courses-store.ts`.

### Lógica de datos viviendo en componentes en vez de stores (candidatos a mover, según la regla que se quiere adoptar)

28. **`teacher.tsx` — `hasVipStudent`**: join manual entre `USERS` y `ASSIGNMENTS` directamente en el layout de ruta.
29. **`PerformanceAnalytics.tsx` — `computeMacros()`/`baseAverage()`/`subAverage()`**: motor completo de cálculo de skills del alumno, reutilizado como si fuera un store (`useComputedMacros()`) pero viviendo en `components/verbo/`.
30. **`admin.students.tsx` — el peor caso encontrado**: implementa su propia capa de persistencia en localStorage (duplicando `students-store.ts`), y **muta directamente los arrays de módulo compartidos `USERS`/`ASSIGNMENTS`** desde el componente.
31. **`admin.sessions.tsx` — `BulkScheduler`**: algoritmo completo de generación de horarios recurrentes y detección de doble-reserva de profesor, hecho en el componente en vez de en `sessions-store.ts`.
32. **`student.courses.tsx` — el segundo peor caso**: la máquina de estados completa de progreso académico (`computeLevelStates()`, `computeUnitStates()`) y el motor de calificación de respuestas (`evaluate()`) viven enteramente en la ruta, no en `activities-store.ts`.
33. **`CantAttendModal.tsx` — `requireCoverage = hoursUntil >= 24`**: regla de negocio de umbral horario calculada en el componente en vez de en `strikes-store`/`coverage-notes-store`.
34. **`ClubReportModal.tsx`**: orquesta directamente entre dos stores (marca el club como `completed` en `clubs-store` al enviar un reporte de `club-reports-store`) en vez de que una función de store encapsule esa transición.
35. **Umbral "skill bajo = <70%"** repetido inline dos veces en `teacher.students.tsx`, sin vivir como constante compartida.

**Nota de alcance:** los hallazgos 28-35 vienen de una muestra de 17 archivos (12 componentes + 5 rutas), no de una auditoría exhaustiva de las ~40 rutas ni de los ~50 componentes de `src/components/ui/`. Es muy probable que existan más casos no cubiertos aquí.

---

## Preguntas abiertas — estado al 2026-07-11 (discutidas con Jaret)

- **`courses-store.ts` (`Level`/`Unit`, catálogo CEFR genérico) — ¿sigue en uso?** → Probable remanente del modelo anterior al catálogo por producto (los placeholders A1/A2/B1/B2 ya se reemplazaron según el historial del proyecto). **No se toca todavía** — candidato a borrar en la limpieza futura. Falta verificación 100% de que ningún archivo lo importe.
- **`Challenge.difficulty` le falta `"experto"`, y `Challenge` no declara `premium`/`skill_tags` pese a que el seed los usa al 100%.** → **Resuelta — falsa alarma.** Verificado 2026-07-11 contra el código real: `DifficultyId` ya incluye `experto` y `Challenge` ya declara `premium`/`skill_tags`. No se necesitó ningún cambio.
- **`ClubReport` con `event_type: "spotlight"` — ¿tabla propia o sigue compartiendo `event_id` con `Club`?** → **Pospuesto** al diseño de tablas de Supabase. Hipótesis a verificar en ese momento: las sesiones Spotlight probablemente nacen como `Session` (vía `student-requests-store.ts`, `kind: "spotlight"`), no como `Club` — lo cual explicaría la ambigüedad. No es un problema de la app actual, es una decisión de esquema futuro.
- **¿Unificar `Challenge`/`FlashChallenge` en una tabla con columna `kind`?** → **Pospuesto** al diseño de tablas de Supabase, misma razón que arriba. Recomendación cuando llegue el momento: sí conviene unificar. No tocar el código actual (entraría en el refactor pausado).
- **Hallazgo #23 — progreso de actividades sin `studentId`, ¿bug real hoy?** → **Acción inmediata pendiente de confirmar por Jaret**: probar con dos alumnos desde el mismo navegador (completar una actividad como alumno A, revisar si ya aparece completada para alumno B) para confirmar si esto explica parte de la confusión vista en preview. Si se confirma, es una excepción — arreglo quirúrgico y acotado (agregar `studentId` al mapa), no el barrido completo — que se autorizaría aparte, no como parte del refactor grande pausado.
