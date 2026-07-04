# Rediseño de la sección de clases en `/teacher`

Reemplazo la sección actual **"Active & upcoming classes"** de `src/routes/teacher.index.tsx` por una sección de dos columnas al 50% (`grid md:grid-cols-2`), apilada en mobile. Todo el trabajo es de UI/presentación dentro de esa ruta más un pequeño componente compartido.

## Layout general

```text
┌───────────────────────────────┬───────────────────────────────┐
│ Plan your upcoming Sessions    │ Complete your sessions          │
│ (50% izquierda)                │ (50% derecha)                   │
│                                │                                 │
│ 3 sesiones "scheduled" más     │ Tarjetas actuales, más          │
│ próximas + botón [Plan]        │ compactas + [Join Live Session] │
│                                │ (verde) + [Fill session report] │
└───────────────────────────────┴───────────────────────────────┘
```

Cada columna lleva un título en la parte superior:
- Izquierda: **"Plan your upcoming Sessions"**
- Derecha: **"Complete your sessions"**

## Columna derecha — "Complete your sessions"

- Conserva las tarjetas existentes (estudiante, nivel, fecha, duración, pill "Live now", contador "Time left to submit", botón "Fill session report" / estado "Overdue").
- Las hago **más compactas**: padding e íconos reducidos, tipografía algo menor, para que quepan bien en la mitad del ancho. Botones apilados verticalmente cuando el espacio sea justo.
- **Nuevo botón "Join Live Session"** (verde) a la **izquierda** del botón "Fill session report":
  - Solo aparece cuando la sesión está **ocurriendo ahora** (`now >= start && now <= end`), es decir la misma condición que hoy muestra la pill "Live now".
  - Cuando la sesión ya terminó, el botón **desaparece** (y queda "Fill session report").
  - Enlaza al link de la sesión: `s.teams_link` (abre en pestaña nueva, `target="_blank" rel="noopener noreferrer"`).

## Columna izquierda — "Plan your upcoming Sessions"

- Muestra las **3 sesiones `scheduled` más próximas** a la fecha actual (orden ascendente por `date_time`, tomando las 3 primeras).
- Cada tarjeta compacta muestra estudiante, nivel, fecha/hora y un botón **"Plan"**.
- El botón "Plan" abre el modal de planificación (mismo formulario que hoy existe en el calendario) para que el profesor titule, elija tipo/nivel/unidad y guarde el plan.

## Reutilizar el modal de planificación

Para no duplicar código, extraigo el `PlanModal` (hoy dentro de `teacher.calendar.tsx`) a un componente compartido:
- Nuevo archivo `src/components/verbo/PlanModal.tsx` con el mismo `PlanModal` y su interfaz.
- `teacher.calendar.tsx` importa desde ahí (sin cambios de comportamiento).
- `teacher.index.tsx` lo usa para el botón "Plan".
- El guardado sigue usando `saveLessonPlan` de `lesson-plans-store.ts` y los niveles desde `courses-store.ts`, de modo que un plan hecho desde el dashboard también se refleja en el calendario (estado "ready").

## Detalles técnicos

- Solo se toca `src/routes/teacher.index.tsx`, se crea `src/components/verbo/PlanModal.tsx` y se ajusta el import en `src/routes/teacher.calendar.tsx`.
- La columna izquierda cargará `levels` (`loadLevels`) y planes (`loadLessonPlans`) para alimentar el modal, con `useEffect` client-side para evitar mismatch SSR (igual que el calendario).
- Se mantiene intacta la sección "Recent activity" y las métricas superiores.
- Sin cambios de backend ni de datos; todo sobre los stores locales existentes.
