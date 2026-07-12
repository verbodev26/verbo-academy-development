# Fix: "Maximum update depth exceeded" en /admin/kpis y /admin/holidays

## Diagnóstico

El error `Maximum update depth exceeded` en las páginas de Admin > KPIs y Admin > Holidays proviene de dos stores que usan `useSyncExternalStore` de forma incorrecta:

1. **`src/lib/teacher-kpi-overrides-store.ts`** (`useKpiOverrides`) — el `getSnapshot` llama a `loadKpiOverrides()`, que hace `JSON.parse(...)` y devuelve **una referencia de array nueva en cada llamada**. React compara por identidad → detecta cambio → re-render → nuevo snapshot → loop infinito.

2. **`src/lib/holidays-store.ts`** (`useHolidays`) — mismo patrón: `loadHolidays()` hace `.slice().sort()` y devuelve un array nuevo cada vez.

Ambos hooks se usan en la ruta afectada (`admin.holidays` usa `useHolidays`, y `admin.kpis` fue actualizado en el cambio anterior de KPI overrides para consumir `useKpiOverrides`), lo que explica que ambas rutas caigan al mismo `ErrorComponent`.

Otros stores del proyecto (p. ej. `activities-store`, `sessions-store`, etc.) ya usan el patrón correcto de snapshot cacheado — sirven de referencia.

## Solución

Aplicar el patrón de "cached snapshot" a los dos stores rotos: mantener una referencia estable en memoria que solo se reemplaza cuando cambia el contenido persistido (por evento `verbo:*-updated` o `storage`). `getSnapshot` devuelve siempre esa referencia cacheada, así React ve la misma identidad hasta que realmente cambian los datos.

### Cambios puntuales

**`src/lib/teacher-kpi-overrides-store.ts`**
- Agregar cache module-level: `let cachedSnapshot: KpiOverride[] | null = null`.
- Función `getSnapshot()` que:
  - Si `cachedSnapshot` es `null`, la llena con `loadKpiOverrides()`.
  - Devuelve `cachedSnapshot`.
- Invalidar el cache (`cachedSnapshot = null`) en:
  - `persist()` después de escribir localStorage.
  - Un listener de `KPI_OVERRIDES_EVENT` y `storage` (registrado una sola vez a nivel de módulo, o dentro de `subscribeKpiOverrides` reutilizando el mismo mecanismo).
- Cambiar `useKpiOverrides` para que `getSnapshot` (client) devuelva `getSnapshot()` cacheado; `getServerSnapshot` sigue devolviendo `[]` (constante).

**`src/lib/holidays-store.ts`**
- Mismo patrón: `cachedHolidays: Holiday[] | null`, invalidado en `write()` y en los listeners `HOLIDAYS_EVENT` / `storage`.
- `useHolidays` usa el snapshot cacheado; `getServerSnapshot` devuelve `SEED` (constante).

### Verificación

- Typecheck limpio.
- Navegar a `/admin/holidays` y `/admin/kpis` sin que aparezca el fallback "Something went wrong".
- Confirmar que agregar/editar (holiday nuevo, override de KPI) sigue actualizando la UI en vivo (invalidación del cache funciona).

## Alcance

- Solo se tocan los dos stores mencionados. No cambia lógica de negocio ni UI.
- No se toca `DATA_MODEL.md` (no hay cambios de modelo).
