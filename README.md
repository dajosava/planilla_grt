# Gasolinera Río Tempisque — asistencia y preplanilla

Base funcional para Gasolinera Río Tempisque, Pueblo Viejo de Nicoya, Costa Rica. Personal de pista, supermercado, tienda, transporte y administración. Next.js App Router + TypeScript + Supabase PostgreSQL/Auth. Una tablet fija registra al personal; el administrador gestiona el resto.

## Qué incluye

- Terminal `/marcacion`: código de empleado y PIN de 6–8 dígitos; entrada, salida, inicio y fin de descanso.
- `/admin`: resumen, empleados (alta, edición, activación, PIN), asistencia y correcciones, turnos, vacaciones, incapacidades, permisos, preplanilla mensual y auditoría.
- Cierre con validaciones y bloqueo de conceptos, CSV protegido contra fórmulas e informe imprimible con comprobantes individuales. Se puede guardar el informe como PDF desde el navegador.
- Supabase Auth con cuentas `admin` y `kiosk`, RLS, PIN con bcrypt en tabla sin acceso API, RPC transaccionales, hora de servidor, eventos inmutables para usuarios de la aplicación, auditoría y control de intentos fallidos.
- Pruebas de montos y de migraciones/seguridad sobre PostgreSQL embebido PGlite. CI para lint, tipos, pruebas y compilación.

## Alcance de esta versión

Es una **base de asistencia y preplanilla**, no un motor legal de planilla costarricense certificado. Precarga el salario mensual del empleado; el administrador ingresa montos de adiciones y deducciones, documenta su desglose y confirma la revisión. Se calcula bruto = base + adiciones y neto = bruto − deducciones con centavos enteros. No deduce automáticamente ausencias ni atrasos.

Pendientes antes de usar para pagos: validar e implementar con el contador las reglas vigentes de CCSS, renta, feriados, jornadas ordinarias/extraordinarias, incapacidades CCSS/INS, descansos remunerados, ingreso/retiro durante el período y aguinaldo. Las tasas no se inventaron ni se codificaron como constantes. La jornada no se determina solo por el departamento. Guardar reglas con fecha de vigencia cuando se implemente ese motor.

Los turnos son planificación; no generan automáticamente horas extras. Las horas operativas de asistencia excluyen todos los descansos marcados; **no equivalen necesariamente a horas pagables**. El administrador revisa su tratamiento. Vacaciones tienen saldo inicial, ajustes auditados y descuento al aprobar; no hay acreditación automática. Los días de vacaciones se ingresan como días laborables validados, sin asumir que todos los días naturales son laborables.

No incluye pagos bancarios, presentación de reportes a CCSS/Hacienda, almacenamiento de documentos médicos, app móvil para choferes, ni sincronización sin conexión. No hay datos ficticios visibles. La tablet necesita internet; si pierde conexión, se debe documentar la incidencia y posteriormente ajustar la asistencia. El reintento conserva el identificador de evento mientras no cambien los datos y la pantalla permanezca abierta.

## Requisitos

Node.js 24 LTS, npm y un proyecto Supabase. Para Supabase local: CLI oficial de Supabase y Docker. No se necesita una clave service-role en la aplicación.

## Ejecutar

```bash
npm ci
cp .env.example .env.local
# Editar .env.local con URL y publishable key de tu proyecto.
npm run dev
```

Abrir http://localhost:3000. Sin variables, la portada y la página de configuración de inicio de sesión están disponibles; los módulos privados requieren Supabase.

### Configurar Supabase alojado

1. Crear un proyecto propio en Supabase.
2. Aplicar **en orden** los cuatro archivos de `supabase/migrations/` con el SQL Editor, o usar el CLI enlazado con `supabase db push`. No ejecutar en una base ajena sin revisar el esquema.
3. En Authentication, deshabilitar registro público y crear dos usuarios con contraseña: administrador y tablet. Confirmar su correo según el procedimiento de Supabase. No usar cuentas compartidas entre administradores.
4. Editar los correos en `supabase/bootstrap.example.sql` y ejecutarlo una sola vez en SQL Editor. Asigna roles y autoriza el dispositivo. La aplicación no permite autoasignarse roles.
5. Configurar `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` en `.env.local`. Nunca colocar service-role ni secretos en variables `NEXT_PUBLIC_*`.
6. En `/login`, usar la cuenta admin. Crear un empleado y entregar su código/PIN por un canal privado.
7. En la tablet, abrir `/login` con la cuenta kiosk. Esa cuenta solo puede marcar, no consultar nómina ni empleados.

Los datos viven en Supabase; las Server Actions de Next.js son el intermediario de sesión y validación. La función PostgreSQL vuelve a autorizar cada operación. Las RPC se pueden llamar directamente con una sesión: sus comprobaciones son la barrera de seguridad, no solo la UI.

### Desarrollo con Supabase local

Desde la raíz del proyecto, después de instalar el CLI oficial:

```bash
supabase start
supabase db reset
supabase status
```

Copiar URL y clave pública locales a `.env.local`. Crear las dos cuentas usando las herramientas de administración de Auth de tu instalación local o la API de administración desde un script seguro, y ejecutar el bootstrap con esos correos. No mezclar usuarios ni claves de proyectos locales y alojados. `db reset` destruye y recrea **la base local**.

## Flujo administrativo

1. Crear empleados, cargar salarios y saldos iniciales verificados.
2. Planificar turnos con inicio y fin completos; para turno nocturno, el fin lleva la fecha siguiente. Los turnos superpuestos de un empleado se rechazan.
3. Empleados marcan con su código y PIN. No se acepta otra entrada con una jornada abierta; para salir se debe cerrar primero el descanso.
4. Revisar asistencia. Si falta una salida, crear un ajuste con hora real y motivo. El evento original no cambia; el ajuste cierra la sesión derivada para permitir próximas entradas. Esta base admite un ajuste por jornada. Cambios adicionales requieren extender el flujo de ajustes con versiones, no editar eventos originales.
5. Registrar ausencias; aprobar/rechazar. Las vacaciones descuentan saldo una sola vez y rechazan sobregiros y ausencias aprobadas superpuestas.
6. Crear preplanilla del mes. Incluye empleados activos al crearla, con snapshot de nombre/código/salario. Si un empleado ingresó o salió durante el mes, revisar su inclusión y base; antes de producción debe implementarse historial de contratos y prorrateo.
7. Revisar y guardar cada empleado con detalle de conceptos. Resolver ausencias pendientes y jornadas abiertas anteriores al fin del período.
8. Cerrar después de terminar el mes. Descargar CSV o imprimir/guardar PDF. Los montos ya cerrados no se modifican. El reporte no confirma ni ejecuta pagos.

## Controles del kiosco

Cuenta exclusiva de tablet, fila `devices.active=true`, hora `clock_timestamp()` de PostgreSQL y UUID idempotente por evento. Se serializan operaciones por dispositivo/empleado. Diez PIN inválidos bloquean esa terminal hasta completar la ventana de 15 minutos; el contador se conserva incluso cuando la operación devuelve un error. No se registran PIN en auditoría. Los empleados no tienen cuentas Supabase en esta versión.

Un PIN puede compartirse y la sesión kiosk identifica una cuenta autorizada, no certifica físicamente una tablet: si sus credenciales se usan en otro equipo, podrá marcar. Para producción, configurar modo kiosco/MDM, limitar físicamente el acceso, usar una contraseña de terminal protegida y evaluar controles de dispositivo o red si el riesgo de suplantación lo requiere.

Cada administrador accede a todos los departamentos; no hay multitenencia. Un usuario sin rol no puede leer datos de personal. El propietario de la base y las credenciales service-role tienen privilegios superiores: protegerlos y limitar su uso operacional.

## Verificación

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm start
```

`tests/database.test.ts` crea roles/Auth mínimos en PGlite, aplica las migraciones reales y verifica RLS, PIN null, eventos, idempotencia, estado de descansos, vacaciones, cierre y bloqueo de intentos. No sustituye una prueba final en el proyecto Supabase con las cuentas reales ni una prueba de carga/concurrencia.

## Estructura

```text
src/app/                    Rutas, panel y Server Actions
src/app/marcacion/           Terminal de tablet
src/app/admin/              Administración y reporte imprimible
src/app/api/reportes/       Exportación CSV autenticada
src/lib/                    Auth, Supabase, schemas, importes y formatos
src/components/             Formularios y elementos compartidos
supabase/migrations/        Esquema, RLS, funciones, auditoría y controles
supabase/bootstrap.example.sql  Asignación inicial de roles y dispositivo
supabase/config.toml        Configuración de desarrollo local
 tests/                     Pruebas unitarias y PostgreSQL
.github/workflows/ci.yml     Verificación automática
```

## Antes de producción

Probar un período completo en paralelo con la planilla actual y el contador. Configurar HTTPS, acceso administrativo individual, respaldo y recuperación probados en Supabase, actualización de dependencias y política de retención/acceso para información laboral. No usar datos médicos detallados en observaciones. Validar comportamiento real en la tablet y manejo de cortes de internet. Configurar protección de inicio de sesión de Supabase y considerar MFA para administradores.

Esta entrega no crea un proyecto remoto, no aplica migraciones a una cuenta ni publica la aplicación: se requiere configurar el proyecto Supabase del propietario y el entorno de ejecución de Next.js.
