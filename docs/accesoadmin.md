# Acceso admin

La home pública **no** enlaza al panel. El login está en una ruta secreta (default `/acceso-grt-7k2m`). Detalle: [`acceso-admin-oculto.md`](./acceso-admin-oculto.md).

El panel `/admin` solo admite usuarios Auth cuyo perfil en `public.profiles` tenga `role = 'admin'`. Crear la cuenta en Supabase Auth **no alcanza**: hay que insertar o actualizar la fila en `profiles`.

Roles posibles (`public.app_role`):

| Role | Acceso |
|---|---|
| `admin` | Panel `/admin/*` |
| `kiosk` | Tablet `/marcacion` (+ operaciones con código/PIN de empleado) |

Gatekeeper: `src/lib/auth.ts` → `requireRole("admin" | "kiosk")`.

---

## Dar acceso admin a una cuenta

### 1. Crear el usuario en Auth (si aún no existe)

En **Supabase → Authentication → Users → Add user**:

- Email (ej. `support@manakinlabs.com`)
- Password
- Confirmar el correo si el proyecto lo exige

### 2. Asignar rol admin en `profiles`

En **Supabase → SQL Editor**, ejecutá (ajustá email y nombre):

```sql
insert into public.profiles (id, display_name, role)
select id, 'Soporte Manakin Labs', 'admin'::public.app_role
from auth.users
where email = 'support@manakinlabs.com'
on conflict (id) do update
  set display_name = excluded.display_name,
      role = excluded.role;
```

Si el email no está en `auth.users`, el `insert` no inserta filas. Verificá el correo exacto.

### 3. Comprobar

```sql
select u.email, p.display_name, p.role
from auth.users u
join public.profiles p on p.id = u.id
where u.email = 'support@manakinlabs.com';
```

Debe devolver `role = admin`. Luego cerrá sesión y entrá de nuevo en la app.

---

## Quitar acceso admin

```sql
update public.profiles p
set role = 'kiosk'::public.app_role  -- o borrá el perfil si ya no debe entrar
from auth.users u
where p.id = u.id
  and u.email = 'support@manakinlabs.com';
```

Sin fila en `profiles` (o con rol distinto de `admin`), el usuario cae en `/acceso-denegado` al intentar `/admin`.

---

## Bootstrap inicial (admin + kiosk)

Plantilla del proyecto: `supabase/bootstrap.example.sql` (cuentas de ejemplo de la gasolinera). El mismo patrón aplica a cualquier correo nuevo de soporte o administración.
