# Manual operativo — Gasolinera Río Tempisque

**Sistema de asistencia, operaciones y planilla quincenal**  
Pueblo Viejo, Nicoya · Costa Rica

| | |
|---|---|
| Versión del documento | 1.0 |
| Público | Administración, supervisión y operación diaria |
| Zona horaria | America/Costa_Rica |
| Moneda | CRC (colones) |

---

## 1. Para qué sirve el sistema

El sistema cubre tres frentes:

1. **Marcación de asistencia** en tablet (entrada / salida, con foto).
2. **Operaciones del turno** (tareas e incidentes en la misma tablet).
3. **Administración** (empleados, jornadas, vacaciones, planilla quincenal, recordatorios, auditoría).

Hay dos tipos de usuario:

| Rol | Quién | Dónde entra |
|---|---|---|
| **Admin** | Contabilidad / gerencia | Panel `/admin` (login por URL secreta) |
| **Kiosk** | Tablet de estación | Misma URL de login; luego `/marcacion` y `/operaciones` |

La home pública (`/`) solo ofrece acceso a **Marcación y tareas**. El login administrativo no se publica: se usa una ruta secreta configurable (por defecto `/acceso-grt-7k2m`). Al **cerrar sesión** desde el panel admin se vuelve a esa misma URL de login (no a la home de marcación).

---

## 2. Mapa de módulos

### Tablet (kiosk)

| Módulo | Ruta | Función |
|---|---|---|
| Marcación | `/marcacion` | Reloj + código + PIN + foto |
| Operaciones | `/operaciones` | Completar tareas e informar incidentes |

### Panel admin

| Módulo | Ruta | Función |
|---|---|---|
| Resumen | `/admin` | KPIs y acceso rápido |
| Empleados | `/admin/empleados` | Alta, edición, PIN, vacaciones, sociedades |
| Asistencia | `/admin/asistencia` | Jornadas, alertas, ajustes, horas extra |
| Vacaciones y ausencias | `/admin/ausencias` | Solicitudes y saldos |
| Planilla | `/admin/planilla` | Quincenas, extras, cierre, comprobantes |
| Historial de pagos | `/admin/planilla/historial` | Consulta histórica |
| Aguinaldo | `/admin/planilla/aguinaldo` | Corrida de aguinaldo |
| Operaciones | `/admin/operaciones` | Dashboard, plantillas, tareas |
| Incidentes | `/admin/incidentes` | Seguimiento de reportes |
| Recordatorios | `/admin/recordatorios` | Vencimientos y alarmas |
| Auditoría | `/admin/auditoria` | Historial de cambios sensibles |

Las tres **sociedades / planillas** son: **Gasolinera**, **Supermercado** y **Transporte**. Cada empleado pertenece a una; las quincenas se crean por sociedad.

---

## 3. Reloj y marcación (tablet)

### 3.1 Qué ve el empleado

1. Reloj en **hora de Costa Rica** (actualización cada segundo).
2. Campo **código** de empleado y **PIN** de 4 dígitos.
3. Botones **Entrada** / **Salida**.
4. Aviso de cámara: al confirmar se toma una foto como evidencia.
5. Si no hay internet: banner de cola offline; la marca se guarda en la tablet.

### 3.2 Cómo funciona el reloj

- La pantalla muestra la hora local CR solo como referencia visual.
- **Con red:** el servidor registra la marca con **hora del servidor** (autoritativa).
- **Sin red:** se guarda en la tablet con la hora del dispositivo (`occurredAt`) y, al sincronizar, el servidor acepta esa marca dentro de una ventana de seguridad (hasta ~72 h atrás; no acepta más de ~2 min en el futuro).

### 3.3 Flujo de una marcación

```
Código + PIN + Entrada/Salida → Foto (si hay cámara)
        ↓
   ¿Hay internet real?
   Sí → envía al servidor → OK / error (PIN, doble entrada, etc.)
   No → guarda en IndexedDB → se envía sola cuando vuelve la red
```

Reglas básicas:

- No se puede marcar **segunda entrada** si ya hay jornada abierta.
- No se puede marcar **salida** sin entrada abierta.
- PIN incorrecto o bloqueado → error (en offline puede quedar como fallido al sincronizar).

### 3.4 Offline y Wi‑Fi “congelado”

Las marcas pendientes viven en **IndexedDB** en la tablet (no se pierden al cerrar la pestaña).

Cada **15 segundos** la tablet hace un ping a `/api/health`. Si responde:

- marca la red como disponible, y
- **envía automáticamente** la cola pendiente.

No hace falta apagar/encender el Wi‑Fi en condiciones normales. Tras un deploy, conviene **recargar una vez** la PWA de marcación (no reinstalar el ícono).

Detalle técnico: `docs/marcacion-offline.md`.

---

## 4. Cómo se mide el tiempo trabajado

### 4.1 Jornada efectiva

Cada par entrada/salida forma una **sesión**. El sistema usa la vista `effective_sessions`:

- Horas de inicio/fin (incluyendo correcciones administrativas si las hay).
- Descanso en minutos (si se registró).
- **Horas trabajadas** = tiempo entre entrada y salida menos descanso.

Una jornada puede **cruzar medianoche** (ej. entra 15/11 22:00 y sale 16/11 05:00): aparece en el rango de fechas que solape esos días.

### 4.2 Tipo de jornada (Código de Trabajo CR)

Según la ventana de marcación (entrada → salida), el sistema clasifica:

| Tipo | Límite ordinario | Criterio simplificado |
|---|---|---|
| **Diurna** | 8 h | Predomina horario diurno |
| **Mixta** | 7 h | Combina diurno y nocturno |
| **Nocturna** | 6 h | ≥ 3 h 30 min en franja 19:00–05:00 CR |

- Franja nocturna: **19:00 a 05:00** (hora Costa Rica).
- Tolerancia: si marca entrada entre **04:40 y 04:59**, la clasificación diurno/nocturno puede tratar el inicio como 05:00; la **hora real de entrada** se conserva para el conteo de horas trabajadas.

### 4.3 Horas extra (sugeridas desde asistencia)

Por empleado y día de trabajo:

```
horas_extra_sugeridas = max(0, horas_trabajadas_del_día − límite_ordinario)
```

- Límite según tipo de jornada (8 / 7 / 6 h).
- **Gracia de 30 minutos:** si el exceso es menor a 30 min, se trata como 0 extra; a partir de 30 min se registra el exceso completo.
- En Asistencia aparecen alertas de personas con extras; en Planilla se **sincronizan** y deben **aprobarse o rechazarse** antes de cerrar.

---

## 5. Módulo Empleados

**Ruta:** `/admin/empleados`

### Pestañas

| Tab | Uso |
|---|---|
| Directorio | Lista filtrable por sociedad; editar datos |
| Registrar empleado | Alta nueva |
| Restablecer PIN | Nuevo PIN de 4 dígitos |
| Ajustar saldo de vacaciones | Acreditar / descontar días con motivo |

### Datos importantes al registrar

- Código, nombre, cédula, correo, **sociedad** (Gasolinera / Supermercado / Transporte), puesto, fecha de ingreso, PIN inicial.
- **Pago mensual:** salario mensual, horas/mes (default 243.36), vacaciones, exento CCSS (opcional).
- **Pago por horas:** marcar “pago por horas”, indicar tarifa/hora; no usa salario fijo ni saldo de vacaciones en el mismo esquema; CCSS queda exento automáticamente en ese modo.

El filtro de sociedades está a la izquierda del directorio.

---

## 6. Módulo Asistencia

**Ruta:** `/admin/asistencia`

### Pestañas

| Tab | Contenido |
|---|---|
| **Jornadas** | Filtros, alertas, tabla de jornadas |
| **Ajustes de jornada** | Registrar jornada faltante / corregir existente |

### Filtros de tiempo

Presets: Hoy, Ayer, Últimos 7 días, Este mes (+ fechas y empleado).  
Al cambiar filtro aparece animación de carga. El rango se limita a **31 días** para evitar caídas por consultas muy pesadas.

### Alertas (debajo de los filtros)

1. **Horas extra** — personas con exceso en el rango; se pueden aceptar avisos.
2. **Sin salida** — jornadas abiertas de días anteriores o > 12 h; clic filtra esa jornada; “Aceptar aviso” la oculta del panel de alertas.
3. **Sin foto** — marcas válidas sin cámara; aceptar si se validó con el empleado.

### Tabla de jornadas

Muestra empleado, fotos (clic para cargar si no son recientes), entrada, salida, tipo de jornada, horas, estado (completa / ajustada / falta salida / con extras).

Se pueden **borrar** entrada o salida con motivo (bloqueado si la planilla del período ya está cerrada).

### Ajustes

- **Registrar jornada faltante:** cuando no marcaron en tablet (queda como ajustada, sin fotos).
- **Corregir existente:** cambia entrada/salida/descanso con motivo; se conserva historial de marcaciones originales.

---

## 7. Vacaciones y ausencias

**Ruta:** `/admin/ausencias`

- Se registran vacaciones, incapacidades o permisos con fechas.
- En vacaciones se indican los **días laborables** a descontar del saldo.
- Quedan **pendientes** hasta que administración aprueba o rechaza.
- El saldo de vacaciones también se puede ajustar desde Empleados (movimientos con motivo).

No se puede cerrar una planilla si hay ausencias pendientes que bloqueen el cierre (regla de servidor).

---

## 8. Planilla quincenal

**Ruta:** `/admin/planilla` (elegir **sociedad** y quincena)

### 8.1 Crear una quincena

1. Elegir empresa (Gasolinera / Supermercado / Transporte).
2. Indicar mes (`YYYY-MM`) y quincena **1** (1–15) o **2** (16–fin de mes).
3. El sistema crea un borrador con **todos los empleados activos** de esa sociedad:

| Concepto | Cálculo automático |
|---|---|
| Adelanto (mensuales) | Salario mensual ÷ 2 |
| Valor hora | Salario ÷ horas/mes (redondeo a colón) |
| CCSS 10.83 % | Sobre el adelanto (0 si exento / por horas) |
| Pago por horas | Horas ordinarias del período × tarifa |

Los montos quedan en **snapshot**: si después cambiás el salario del empleado, **no** se recalculan quincenas ya creadas.

### 8.2 Sincronizar horas extra desde asistencia

En la quincena (borrador):

1. Usar **Actualizar extras desde asistencia** (`sync_payroll_ot_from_attendance`).
2. El sistema propone horas extra según jornadas del período (límites 8/7/6).
3. Quedan en estado **pendiente de aprobación**.

### 8.3 Aceptar / rechazar horas extra

Por empleado (o en lote, según la UI):

- **Aprobar** → las horas sugeridas entran al cálculo (monto ≈ horas × valor hora × **1.5**).
- **Rechazar** → no se pagan esas extras sugeridas.
- También se pueden **ajustar** horas extra / doble (2×) / otros pagos / faltantes / facturas al editar el ítem.

**No se puede cerrar la quincena** mientras existan extras en estado pendiente de aprobar.

### 8.4 Cómo entran las extras a la planilla (resumen)

```
Marcaciones (tablet / ajustes)
        ↓
Asistencia calcula sugerencia OT por día/jornada
        ↓
Planilla: “Actualizar extras desde asistencia”
        ↓
Admin aprueba / rechaza / ajusta montos
        ↓
RPC update_payroll_item recalcula neto
        ↓
Marcar empleado como revisado
        ↓
Cerrar quincena
```

Otros conceptos manuales frecuentes:

| Campo | Uso |
|---|---|
| Horas doble (2×) | Captura administrativa |
| Otros pagos | Comisiones / bonos |
| Faltantes pista | Deducción |
| Facturas / recibos | Deducción |
| Otras deducciones | Deducción libre |
| Nota | Texto en comprobante |

### 8.5 Cerrar y pagar

Condiciones típicas del servidor:

- Todos los ítems **revisados**.
- Sin extras OT pendientes de aprobar.
- Sin jornadas abiertas problemáticas / reglas de `guard_payroll_close`.
- El período de la quincena ya terminó.

Al cerrar:

- La quincena queda bloqueada.
- Se habilitan **comprobantes / PDF**, **CSV** y envío de colillas por correo (EmailJS).

### 8.6 Vista previa de comprobantes

**Ruta:** `/admin/planilla/[id]/reporte`

- Tabla resumen de empleados.
- **Clic en un empleado** → modal con su comprobante y botón **Cerrar**.
- **Imprimir / guardar PDF** imprime **todos** los comprobantes (no solo el del modal).

### 8.7 Ejemplo numérico (referencia)

Salario mensual ejemplo ₡419,755.93:

| Concepto | Aprox. |
|---|---|
| Adelanto | ₡209,878 |
| CCSS 10.83 % | ₡22,730 |
| Neto sin extras | ₡187,148 |
| 2 h extra (×1.5) | ₡5,175 adicionales |

Detalle de fórmulas: `docs/planilla-codigo.md`.

---

## 9. Operaciones y tareas

### 9.1 Para el administrador

**Rutas:**

- `/admin/operaciones` — dashboard del día / rango
- `/admin/operaciones/plantillas` — plantillas recurrentes
- `/admin/operaciones/tareas` — listado y seguimiento

**Cómo se crean tareas para empleados**

1. **Plantillas**  
   - Definís título, área, checklist, si requiere foto, hora de vencimiento (minutos desde medianoche CR), empleado asignado opcional.  
   - Cada día (o con el botón de generar) se crean las tareas del día **desde plantillas activas** (no duplica si ya existen; actualiza asignado en abiertas).

2. **Tarea ocasional (ad-hoc)**  
   - Se crea una tarea puntual con fecha, área y asignación.

3. **Asignar / reasignar**  
   - Desde el listado de tareas se puede cambiar el empleado responsable.

4. **Revisión**  
   - Cuando el empleado completa desde la tablet, queda para **aprobar o rechazar** en admin.

### 9.2 Para el empleado (tablet `/operaciones`)

1. Ingresa con código + PIN (mismo de marcación).
2. Ve las tareas de su turno.
3. Completa checklist, comentario y foto si la tarea lo exige.
4. Puede reportar un **incidente** (categoría, título, descripción, foto).

Los incidentes se gestionan en `/admin/incidentes` (asignar, resolver, cerrar).

---

## 10. Recordatorios

**Ruta:** `/admin/recordatorios`

- Altas de vencimientos (documentos, permisos, etc.) con fecha y días de alerta temprana.
- El panel muestra urgentes (últimos 7 días / vencidos) y el badge del menú suma pendientes.
- Sirve para no perder fechas administrativas fuera de la planilla.

---

## 11. Auditoría

**Ruta:** `/admin/auditoria`

- Historial de cambios sensibles (altas, bajas, correcciones, etc.).
- Los **PIN nunca** se guardan en claro en auditoría.
- Útil para investigar “quién cambió qué” en asistencia o empleados.

---

## 12. Rutina operativa sugerida

### Diaria (estación)

1. Tablet encendida en `/marcacion` (PWA).
2. Empleados marcan entrada/salida.
3. Completar tareas del turno en `/operaciones`.
4. Si hubo corte de red: verificar que el banner de cola se vacíe solo (o Reintentar si hay fallidos).

### Diaria / semanal (admin)

1. Revisar **Asistencia**: sin salida, sin foto, extras.
2. Corregir o registrar jornadas faltantes.
3. Revisar **Operaciones** e **Incidentes**.
4. Atender **Recordatorios** urgentes.

### Cada quincena (admin)

1. Cerrar pendientes de asistencia del período.
2. En **Planilla** de cada sociedad: crear quincena (si no existe).
3. **Actualizar extras desde asistencia**.
4. Aprobar / rechazar / ajustar extras y deducciones.
5. Marcar empleados revisados.
6. Vista previa de comprobantes → cerrar quincena.
7. Imprimir PDF / CSV / enviar colillas.

---

## 13. Preguntas frecuentes

**¿La hora del reloj de la tablet es la que se paga?**  
Con internet, manda el servidor. Sin internet, se usa la hora guardada en la tablet al marcar, validada al sincronizar.

**¿Qué pasa si alguien olvida marcar salida?**  
Aparece en alertas de Asistencia. Se puede filtrar esa jornada, corregirla en Ajustes, o aceptar el aviso tras revisión.

**¿Las extras se pagan solas al crear la planilla?**  
No. Se **sugieren** desde asistencia, hay que **sincronizar** y **aprobar** (o cargar a mano) antes del cierre.

**¿Puedo editar una quincena cerrada?**  
No. Hay que trabajar en borrador; el cierre bloquea cambios de negocio.

**¿Hay que reinstalar la PWA tras cada actualización?**  
No. Con red, abrir marcación y recargar una vez.

**¿Dónde está el login de admin?**  
URL secreta (no está en la home). Ver `docs/acceso-admin-oculto.md`.

---

## 14. Documentación técnica relacionada

| Documento | Contenido |
|---|---|
| `docs/ARQUITECTURA.md` | Capas, carpetas, flujos |
| `docs/planilla-codigo.md` | Fórmulas y RPCs de planilla |
| `docs/marcacion-offline.md` | Cola IndexedDB y heartbeat |
| `docs/pwa.md` | Instalación PWA / kiosco |
| `docs/acceso-admin-oculto.md` | Login secreto |
| `docs/tests.md` | Suite automatizada |

---

*Gasolinera Río Tempisque — Manual operativo del sistema de planilla y asistencia.*  
*Si cambia un flujo crítico (marcación, cierre de planilla, OT), actualizá este manual junto con la documentación técnica.*
