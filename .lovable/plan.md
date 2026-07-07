## Objetivo
Cuando una sesión termina en Absent con causa `teacher`, el contador de Remaining Sessions NO debe descontar — ni para alumnos individuales, ni para miembros de un grupo.

## Estado actual

**Individuales (`submitSessionReport`)** — no hay ninguna llamada que decremente `user.remaining_sessions` hoy. Ya cumple la regla por defecto (nada que cambiar).

**Grupos (`submitGroupSessionReport` en `src/lib/sessions-store.ts`)** — al final del handler se llama incondicionalmente:
```ts
decrementGroupRemaining(input.groupId);
```
Esto descuenta incluso cuando el motivo es que el profesor no dio la clase.

## Cambio

En `src/lib/sessions-store.ts`, dentro de `submitGroupSessionReport`, reemplazar el decremento incondicional por una guarda: la clase solo "ocurrió" (y por tanto descuenta) si al menos un miembro tuvo una atención imputable a él mismo — es decir, `attendance !== "absent"` (Present/Delayed) **o** `attendance === "absent"` con `absentCause === "student"`.

Si **todos** los miembros están Absent con causa `teacher` (el profe no pudo dar la clase), no se llama `decrementGroupRemaining`.

Pseudocódigo del cambio:
```ts
const classOccurred = input.perMember.some(
  (m) => m.attendance !== "absent" || (m.absentCause ?? "student") === "student",
);
if (classOccurred) decrementGroupRemaining(input.groupId);
```

## Fuera de alcance
- Individuales: no existe decremento en código, así que no hay nada que modificar. Cuando se implemente el decremento individual en el futuro, aplicar la misma guarda (`absent_cause !== "teacher"`).
- UI / etiquetas / KPIs de profesores: no se tocan.

## Archivo afectado
- `src/lib/sessions-store.ts` (una sola edición dentro de `submitGroupSessionReport`).