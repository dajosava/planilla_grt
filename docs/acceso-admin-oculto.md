# Acceso admin oculto

La home pública solo muestra **Marcación y tareas**.

## URL de login

Ruta secreta (configurable):

```text
https://<tu-dominio>/<ADMIN_LOGIN_PATH>
```

Default: `/acceso-grt-7k2m`

Variable en Netlify / `.env.local`:

```bash
ADMIN_LOGIN_PATH=acceso-grt-7k2m
```

Ahí entran cuentas **admin** (panel) y **kiosk** (tablet). Guardá la URL en favoritos del admin y de la tablet; no la publiques.

## Comportamiento

| Ruta | Sin sesión |
|---|---|
| `/` | Home (solo marcación) |
| `/login` | Redirige a `/` |
| `/admin`… | Redirige a `/` (`requireRole`) |
| `/<ADMIN_LOGIN_PATH>` | Formulario de login (rewrite en `src/proxy.ts`) |

Tras **Cerrar sesión** (admin o “Cambiar de cuenta”) → `/<ADMIN_LOGIN_PATH>` (formulario de login), no a la home de marcación.
