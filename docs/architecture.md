# Decisiones de arquitectura

## Componentes

Next.js sirve UI y Server Actions. Supabase Auth mantiene sesiones SSR en cookies, refrescadas mediante `src/proxy.ts`; cada acción valida usuario y rol. PostgreSQL es la autoridad sobre permisos, PIN, eventos, saldos y cierres. No existe un backend FastAPI adicional.

## Datos y reglas

Los eventos son evidencia original; las sesiones derivadas agrupan entrada, descansos y salida. Los ajustes son registros separados con motivo, autor y auditoría. Fechas operativas se interpretan en America/Costa_Rica (UTC−06:00). Timestamps se guardan con zona horaria. Los importes se guardan en centavos enteros y se mantienen dentro de límites seguros para JavaScript.

Las planillas guardan snapshots de datos del empleado y conceptos. No se recalculan cuando cambia el salario del directorio. Los procedimientos bloquean el período para serializar cierre y edición. La revisión es explícita. No se permite cierre anticipado.

## Límites conocidos y evolución

- Agregar historial de contratos/puestos/salarios con vigencias y selección de empleados del período.
- Motor de reglas legal validado, detalle por concepto y parámetros versionados; documentar cómo se determina cada jornada.
- Acreditación de vacaciones validada y separación de días calendario/laborables.
- Paginar listados: las pantallas de turnos/asistencia/ausencias/auditoría muestran 100 registros recientes.
- Los turnos y ausencias no tienen edición/cancelación en esta base; extender mediante operaciones auditadas.
- Agregar reasignación/corrección de conceptos posteriores al cierre con un período de ajuste, sin reabrir silenciosamente montos ya aprobados.
- Mejorar correcciones múltiples de asistencia con un ledger de versiones y referencia al ajuste sustituido.
- Adjuntos privados, políticas Storage y límites de retención cuando se requieran documentos.
- Evolucionar el kiosk hacia dispositivo enlazado y control de red; no usar huella/foto sin evaluar requisitos de tratamiento de datos.
- Cola offline requiere diseño distinto: hora capturada y recibida, firma/identidad de dispositivo, revisión de confiabilidad y conciliación de eventos fuera de orden. No aceptar sin validación horas históricas suministradas por cualquier navegador.
- Realizar pruebas concurrentes en Supabase/PostgreSQL completo, además de la integración PGlite incluida.
