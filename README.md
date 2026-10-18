# Gasolinera Río Tempisque — operaciones, asistencia y preplanilla

Plataforma operativa para Gasolinera Río Tempisque (Pueblo Viejo de Nicoya, Costa Rica). Incluye **operaciones de estación** (tareas, checklists, evidencias, incidentes), **asistencia** y **preplanilla**. Next.js App Router + TypeScript + Supabase PostgreSQL/Auth. Una tablet fija (cuenta kiosk) marca asistencia y permite a cada empleado entrar con código+PIN a sus tareas del día; el administrador gestiona el resto.

## Qué incluye

- **Operaciones** `/admin/operaciones`: dashboard con métricas, gráficas (estados, áreas, tendencia, empleados), filtros por fechas, plantillas, generación y aprobación de tareas.
- **Incidentes** `/admin/incidentes`: inbox de reportes desde la tablet (categoría, severidad, foto).
- **Tablet** `/operaciones`: sesión corta con código+PIN; checklist, foto de evidencia y reporte de incidentes. Enlace desde `/marcacion`.
- Terminal `/marcacion`: código de empleado y PIN de 4 dígitos; entrada, salida, inicio y fin de descanso; foto de evidencia.
- `/admin`: empleados (PIN, cédula, correo, fecha de ingreso), asistencia, turnos, vacaciones, preplanilla y auditoría.
- Supabase Auth con cuentas `admin` y `kiosk`, RLS, PIN con bcrypt, RPC transaccionales, auditoría.
- Pruebas PGlite + CI (lint, tipos, tests, build).

## Operaciones (MVP)

Plantillas semilla: Apertura, Cierre, Limpieza de baños, Inspección de seguridad. Un ítem con `!` al inicio en la plantilla exige foto.

**Generación de tareas:** el admin usa **Generar tareas de hoy** en Operaciones. No hay cron obligatorio en el plan Free; cuando tengas `pg_cron` o una Edge Function programada, puedes llamar `ops_generate_tasks_for_date(null)` a diario (ej. 05:30 America/Costa_Rica). El botón manual queda como respaldo.

**Asignación:** cada tarea se asigna a un empleado (en **Tareas** o como responsable por defecto en la **plantilla**). Al generar el día, se copia el asignado de la plantilla. En `/operaciones` el empleado solo ve **sus** tareas.

**Flujo de tarea:** pendiente → en progreso → completada (empleado asignado) → aprobada/rechazada (admin).

**Acceso empleado fase 1:** kiosk + código/PIN (cookie httpOnly `grt_ops_session`). **Fase 2 (pendiente):** PWA con cuenta Auth por empleado.

## Fotos de marcación y retención

Cada marca válida puede guardar JPEG en `punch_photos` (~25–50 KB, tope 200 KB, retención 30 días). La limpieza corre al marcar (`register_punch_with_photo`), no con un cron dedicado. Decisión pendiente: cron vs dejarlo así.

Evidencias de **tareas/incidentes** se guardan en `task_evidence` / `incident_evidence` (bytea), no en Storage.

## Correo del empleado y payslips (pendiente de envío)

El correo se guarda en el empleado y se copia a `payroll_items.employee_email` al crear la preplanilla. El envío automático del payslip al cerrar **aún no está implementado**.

## Alcance de planilla

Es una **base de asistencia y preplanilla**, no un motor legal certificado de planilla costarricense. Ver pendientes de CCSS/renta/feriados con el contador antes de usarlo para pagos reales.

Los turnos son planificación; no generan horas extras automáticamente. Las horas operativas excluyen descansos marcados.

## Requisitos

Node.js 24 LTS, npm y un proyecto Supabase. Para local: CLI de Supabase y Docker.

## Ejecutar

```bash
npm ci
cp .env.example .env.local
# Editar .env.local con URL y publishable key
npm run dev
```

### Configurar Supabase

1. Aplicar **en orden** todos los archivos de `supabase/migrations/` (SQL Editor o `supabase db push`).
2. Crear usuarios Auth admin y kiosk; ejecutar `supabase/bootstrap.example.sql` con sus correos.
3. Configurar `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
4. Admin: generar tareas del día, revisar operaciones.
5. Tablet: `/login` con kiosk → `/marcacion` o `/operaciones`.

## Flujo operativo diario (recomendado)

1. (Opcional cron / botón) Generar tareas del día.
2. Empleados marcan en `/marcacion` y completan tareas en `/operaciones`.
3. Admin aprueba tareas y gestiona incidentes.
4. Al fin de mes: preplanilla, revisión y cierre.

## Controles del kiosco

Cuenta exclusiva de tablet, `devices.active`, hora de servidor, UUID idempotente en marcas, bloqueo tras 10 PIN fallidos. La sesión de operaciones es independiente (cookie) y expira en 8 horas.

## Verificación

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Estructura

```text
src/app/marcacion/           Terminal de asistencia
src/app/operaciones/         Tareas e incidentes (kiosk + PIN)
src/app/admin/operaciones/   Dashboard, plantillas, tareas
src/app/admin/incidentes/    Inbox de incidentes
src/app/admin/               Planilla, empleados, asistencia…
supabase/migrations/         Esquema y RPCs (incl. operations MVP)
tests/                       PGlite + unitarias
```

## Antes de producción

HTTPS, permisos de cámara en tablet, MFA admin, respaldos Supabase, política de retención de fotos/evidencias, decidir cron de tareas y de limpieza de fotos, implementar payslip por correo y (fase 2) PWA de empleado.
