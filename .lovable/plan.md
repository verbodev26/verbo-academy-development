## Diagnóstico

En tu captura del chat el badge dice **"Super Admin"**; en la pestaña nueva dice **"Admin"**. Ese string ("Admin" así, sin más) **ya no existe en el código actual** — `roleLabel()` en `TopNav.tsx` solo devuelve `"Super Admin"`, `"Coordinator · Operations"`, `"Coordinator · Financial"`, `"Teacher"` o `"Student"`. Conclusión: la pestaña nueva está corriendo un **bundle JS viejo cacheado**, no el build actual.

Dos causas posibles y ambas se resuelven:

1. **Caché del navegador / service worker viejo** en esa pestaña.
2. **`localStorage` con un objeto `user` de forma antigua** (guardado antes de que existieran los nuevos roles). Aunque el bundle sea nuevo, si el user persistido tiene forma vieja, algunos labels/permisos pueden verse raros hasta el próximo login.

## Paso 1 — Acción inmediata (sin código)

En la pestaña nueva:
- **Hard refresh:** Cmd/Ctrl + Shift + R (fuerza recarga sin caché).
- Si sigue igual, abrir DevTools → Application → Storage → **Clear site data** y recargar. Volver a hacer login.

Con eso el bundle correcto se sirve y el `localStorage` se regenera con la forma nueva. Confirma si el badge ya dice "Super Admin".

## Paso 2 — Endurecer el código para que esto no vuelva a pasar

Aunque el caché lo cause el navegador/CDN, podemos hacer que un `localStorage` viejo no rompa la UI:

**Cambios en `src/lib/auth.tsx`:**

- Al hidratar (`useEffect` inicial), después de leer `raw` de `localStorage`, buscar el usuario por `id` en `USERS` y **re-hidratar** el objeto guardado con la versión canónica (mantiene `role`, `admin_type`, etc. al día). Si el `id` ya no existe en `USERS`, limpiar el `localStorage` y quedar como logged-out.
- Bumpear la clave de storage: `const KEY = "verbo.auth.user.v2"` y, al hidratar, migrar/borrar `"verbo.auth.user"` viejo. Esto invalida sesiones con forma anterior de una sola vez.

**Resultado:** cualquier navegador con la sesión vieja obtiene automáticamente la forma actualizada (o pasa por login) sin tener que limpiar storage manualmente.

## Fuera de alcance

- No toco `TopNav.tsx` — el label ya está correcto en el código.
- No republico nada (los cambios ya están en el preview; para que la URL **pública** `.lovable.app` los muestre haría falta un Publish aparte, pero tu pregunta fue sobre la pestaña de preview).
