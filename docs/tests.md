# Tests — Río Tempisque Planilla

Documentación de la suite automatizada: cómo correrla y qué cubre cada archivo.

## Stack

| Pieza | Uso |
|---|---|
| **Vitest** | Runner (`npm test` → `vitest run`) |
| **PGlite** | Postgres en memoria para migraciones + RPC/RLS |
| **React Testing Library** | UI del formulario de pago (jsdom) |
| Config | `vitest.config.mts`, setup `vitest.setup.ts` |

Los `.ts` corren en Node. Los `.tsx` usan entorno **jsdom** (`@vitest-environment jsdom`).

## Cómo correrlos

Desde la raíz del proyecto (`rio-tempisque/`):

```bash
# Toda la suite
npm test

# Un archivo
npm test -- tests/payroll.test.ts
npm test -- tests/employee-pay-fields.test.tsx

# Por nombre de caso (filtro -t)
npm test -- tests/database.test.ts -t "crea empleado por horas"
npm test -- tests/shift-cr.test.ts -t "Diurna"

# Modo watch (mientras desarrollás)
npx vitest
```

Requisitos: Node ≥ 24 e `npm install` (incluye Vitest, PGlite, Testing Library).

No hace falta Supabase cloud ni `.env`: las pruebas de base usan PGlite y aplican `supabase/migrations/*.sql` en orden.

## Mapa de archivos

| Archivo | Tipo | Qué cubre |
|---|---|---|
| `tests/payroll.test.ts` | Unit | Motor de planilla en `src/lib/payroll.ts` |
| `tests/shift-cr.test.ts` | Unit | Clasificación de jornada CR y extras (`src/lib/shift-cr.ts`) |
| `tests/pay-by-hours-payroll.test.ts` | Unit | Fórmulas de pago por horas (base, CCSS 0, OT 1.5×) |
| `tests/employee-schema.test.ts` | Unit | Validación Zod `employeeSchema` (mensual vs por horas) |
| `tests/employee-pay-fields.test.tsx` | Componente | UI `EmployeePayFields` (checkbox, campos ocultos, CCSS auto) |
| `tests/offline-punches.test.ts` | Unit | Reglas offline: no doble entrada/salida en cola de tablet |
| `tests/database.test.ts` | Integración DB | Migraciones, RLS, RPC (asistencia, planilla, ops, pago por horas) |

---

## Detalle por suite

### `payroll.test.ts` — Planilla (centavos)

- Conversión CRC ↔ centavos (`crcToCents`, signos, rechazo de formatos inválidos).
- Bruto/neto sin flotantes; deducciones no pueden superar el bruto.
- Quincena Excel GRT: adelanto = salario/2, valor hora ~₡1,725, CCSS 10.83%.
- Extras 1.5×, doble 2×, faltantes/facturas, exento CCSS.
- Aguinaldo (período legal dic–nov) y límites de quincena (1–15 / 16–fin).
- Escape CSV seguro.

### `shift-cr.test.ts` — Código de Trabajo CR

- `classifyShift`: Diurna (límite 8 h), Mixta (7 h), Nocturna (6 h) según minutos nocturnos.
- Cruce de medianoche y ventana 19:00–05:00.
- `overtimeHours`: umbral de gracia 30 min; a partir de ahí se registra el exceso completo.

### `pay-by-hours-payroll.test.ts` — Pago por horas (fórmulas)

- `base = ordinary_hours × hourly_rate_cents`.
- Con exención, CCSS = 0.
- Extras a 1.5× sobre la misma tarifa.
- Contraste: empleado mensual sigue usando adelanto + CCSS sobre adelanto.

### `employee-schema.test.ts` — Onboarding (Zod)

- Por horas: exige `hourly_rate` válido; no exige salario.
- Mensual: exige salario; rechaza vacío.
- Defaults de vacaciones (0) y horas/mes (243.36) cuando se omiten en onboarding por horas.

### `employee-pay-fields.test.tsx` — UI onboarding

- Modo mensual: muestra salario, horas/mes, vacaciones y checkbox CCSS.
- Al marcar **Pago por horas**: muestra precio/hora; oculta salario, horas/mes y vacaciones; CCSS automático (hidden `exempt_from_ccss=on`).
- Edición por horas: no muestra saldo de vacaciones.

### `database.test.ts` — Postgres (PGlite)

Aplica todas las migraciones y prueba RPC/RLS como admin / kiosk / sin rol.

**Seguridad y empleados**

- Kiosk no lee empleados, hashes ni planillas.
- Sin rol no crea empleados.
- Códigos simples (`1`, `2`…), cédula/correo/fecha de ingreso.
- No se puede elevar rol ni borrar eventos desde kiosk.
- Borrado de empleado solo con código correcto (cascade + audit).

**Asistencia**

- PIN null / incorrecto; bloqueo tras intentos fallidos.
- Flujo entry → break → exit e idempotencia (`replay`).
- Corrección de jornada nocturna; rechazo si la planilla del período está cerrada.
- Fotos solo en marcas válidas; kiosk no las lee.

**Planilla y vacaciones**

- Cierre exige revisión; planilla cerrada bloquea cambios.
- No cerrar período futuro.
- Vacaciones: descuento una sola vez; rechazo de sobregiro.

**Ops**

- Generar tareas del día, asignar, completar desde kiosk, incidentes, revisión admin.

**Pago por horas** (`crea empleado por horas…`)

- Rechaza crear sin tarifa.
- Guarda `pay_by_hours`, `hourly_rate_cents`, salario 0, exento CCSS, vacaciones 0.
- Con 4 h marcadas en la quincena: `ordinary_hours=4`, `base_cents=600000` (₡1,500×4), `ccss_cents=0`.

---

## Qué no cubre (aún)

- E2E en navegador real (Playwright): alta en `/admin/empleados`, marca en tablet, quincena en UI.
- Server Actions de Next (`createEmployee` / `updateEmployee`) con FormData real (sí se prueba el schema y el RPC).
- Sync offline IndexedDB de la tablet.

## Convenciones al agregar tests

1. Unitarios puros → `tests/<tema>.test.ts` junto a la lógica de `src/lib`.
2. Componentes client → `tests/<componente>.test.tsx` con `/** @vitest-environment jsdom */` al inicio.
3. RPC / migraciones → extender `database.test.ts` (o archivo nuevo con el mismo bootstrap PGlite).
4. Nombres de `it(...)` en español, describiendo el comportamiento.
5. Tras cambiar SQL en `supabase/migrations`, correr `npm test -- tests/database.test.ts`.

## Relacionado

- Fórmulas de negocio: [`planilla-codigo.md`](./planilla-codigo.md)
- Migración pago por horas: `supabase/migrations/202611170004_pay_by_hours.sql`
