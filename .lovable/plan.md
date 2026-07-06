
# Normalize UI copy to English

All user-facing strings across the app will be in English. Spanish prompts from you remain internal — output UI stays English-only.

## Scope

1. Sweep every route, component, and shared UI string in `src/routes/**` and `src/components/**` for Spanish text (labels, buttons, headings, empty states, tooltips, placeholders, toasts, modal titles, tab names, nav items, form errors, badges).
2. Priority areas known to contain Spanish (from recent work):
   - Teacher Panel: "Mis Alumnos" → "My Students", nav labels, "Reportar" → "Report", coverage notes copy, calendar filters/day-month toggles, session report modal (attendance, causes, subskill labels shown to teacher), lesson plan modal ("Selecciona…", "Contenido del sílabo", etc.).
   - Admin Panel: Students/Sessions/Workshops/Manage Clubs/Challenges/Financial — any remaining Spanish labels, toasts, modal copy, strike badges, payment glow tooltip, VIP form remnants.
   - Student dashboard: Linguistic Asset Performance, Advanced Performance Analytics subskill names, calendar, booking/cancel flows, Book Clubs unlock button, Spotlight, Insights strike messages.
   - Shared: navigation shells, auth screens, empty/error/not-found boundaries, confirmation dialogs.
3. Translate consistently using a single glossary (e.g. Alumno → Student, Profesor → Teacher, Reservar → Book, Cancelar → Cancel, Reagendar → Reschedule, Cupos → Monthly quota, Cobertura → Coverage, Bitácora → Log, Sesión → Session, Cohorte → Cohort, Enfoque → Focus, Plan de Acceso → Access Plan, Sílabo → Syllabus, Evaluación → Evaluation, Reportar → Report, Pagado → Paid, Pago próximo → Payment due, Día de pago → Payment day).

## Approach

- Grep the codebase for Spanish markers (accented chars `[áéíóúñ¿¡]`, and a token list: `Alumno|Profesor|Reservar|Cancelar|Reagendar|Cupos|Sesión|Semana|Mes|Pagado|Reportar|Cobertura|Bitácora|Cohorte|Enfoque|Sílabo|Evaluación|Selecciona|Guardar|Aceptar|Cerrar|Buscar|Filtrar|Agrupar`).
- Edit each hit in place — pure string replacement, no logic, routing, data-model, or component-structure changes.
- Keep keys, variable names, comments, and mock data identifiers as-is; only visible strings change. Spanish comments left untouched.
- Do not touch `mem://`, docs, or seed data unless a Spanish string is actually rendered.

## Out of scope

- No i18n framework (no `react-i18next`), no language switcher — single-language English.
- No behavior, styling, or data model changes.
- Data field values that happen to be Spanish (e.g. company names) stay as they are.

## Verification

- Re-run the Spanish-token grep after edits; zero hits in rendered strings.
- Spot-check Teacher Calendar, Mis Alumnos → My Students modal, Admin Students card, Student dashboard booking flow in the preview.
