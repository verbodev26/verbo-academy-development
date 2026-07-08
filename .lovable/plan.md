## Group Session Unanimity — Can't Attend flow

Regla confirmada: **Unanimidad estricta** + cuota individual siempre cuenta.

### Comportamiento objetivo

| Escenario | Sesión top-level | Miembros que cancelaron | Miembros restantes | Group remaining | Cuota mensual |
|---|---|---|---|---|---|
| 1 de 3 cancela | `scheduled` (sigue en pie) | `member_statuses[id] = cancelled` (o `pending_reschedule`) | Clase ocurre normal | Se decrementa al reportar (clase ocurrió) | +1 al que canceló |
| 2 de 3 cancelan | `scheduled` (sigue en pie con 1) | `cancelled` cada uno | Clase ocurre con 1 alumno | Se decrementa al reportar | +1 a cada uno |
| 3 de 3 cancelan | **`cancelled` top-level** (auto) | Los 3 en `cancelled` | — | **NO se decrementa** (clase no ocurrió) | +1 a cada uno |

Nota: para `pending_reschedule`, la unanimidad se evalúa por "miembro ya no asistirá en la fecha original" (cancelled OR pending_reschedule cuentan como "salió"). Si los 3 salen → top-level `cancelled` (los reschedule requests individuales quedan vivos en `student-requests-store`).

### Cambios de código

**1. `src/lib/sessions-store.ts`** — nueva helper `evaluateGroupUnanimity(sessionId)`:
- Lee `member_statuses` de la sesión.
- Cuenta miembros del group (via `groups-store`) vs miembros marcados como `cancelled` o `pending_reschedule`.
- Si todos coinciden → set top-level `status = 'cancelled'`, disparar `activity-logs-store` con evento "Group session auto-cancelled (unanimous)".
- No decrementa `groupRemaining` (la sesión no ocurrió) — coherente con la lógica ya existente en `submitGroupSessionReport`.

**2. `src/lib/student-requests-store.ts`** — en las funciones que aplican cancel/reschedule a un miembro de group:
- Tras mutar `member_statuses[studentId]`, llamar `evaluateGroupUnanimity(sessionId)`.
- La cuota mensual del miembro ya se contabiliza (política actual); confirmar que se dispara igual para group members.

**3. `src/routes/student.sessions.tsx`** — Can't Attend modal, cuando la sesión tiene `group_id`:
- Actualizar el texto del confirm modal para dejar claro que **la clase seguirá para los demás miembros** salvo que los 3 cancelen.
- Añadir línea informativa: *"This will count against your monthly cancellation quota. The session continues for the remaining members."*
- El branch de 4 opciones (late window / quota exhausted / valid reschedule / valid cancel) permanece idéntico — solo cambia el texto contextual.
- Actualizar el comentario de línea 16-17 para reflejar la regla nueva.

**4. `src/routes/teacher.clubs.tsx`** — cuando una group session se auto-cancela por unanimidad:
- El teacher la ve desaparecer de su agenda con badge "Auto-cancelled (all members)" en la lista de cancelled.

**5. `src/routes/admin.sessions.tsx`** — Activity Logs debe reflejar el auto-cancel unánime como evento separado (event type "Group session auto-cancelled"). Añadir al filtro Event Type.

### Fuera de scope

- No cambia la lógica de `submitGroupSessionReport` (ya es correcta: si algún miembro asistió, la clase se marca completed y decrementa remaining).
- No toca 1:1 ni Spotlight flows.
- No cambia colores/estatus del calendario.
