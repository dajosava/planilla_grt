# Planilla quincenal — lógica aplicada en el código

Documentación de **cómo el sistema calcula** la planilla hoy.  
Origen de negocio: `xls_actual/LOGICA-PLANILLA.md` (Excel de la gasolinera).  
Implementación de referencia: `src/lib/payroll.ts` + `supabase/migrations/202610180001_payroll_fortnight.sql`.

---

## 1. Archivos involucrados

| Pieza | Ruta | Rol |
|---|---|---|
| Motor TypeScript | `src/lib/payroll.ts` | Constantes, fórmulas, `calculateFortnight` |
| Clasificación jornada CR | `src/lib/shift-cr.ts` | Diurna / Mixta / Nocturna + límites 8/7/6 h |
| Tests del motor | `tests/payroll.test.ts` | Ejemplo cajero ₡419,755.93 |
| Tests jornada CR | `tests/shift-cr.test.ts` | Ejemplos art. 135 (entrada/salida) |
| Migración DB | `supabase/migrations/202610180001_payroll_fortnight.sql` | Columnas + RPCs quincena |
| Migración jornada CR | `supabase/migrations/202611150001_shift_classification_cr.sql` | `classify_shift_cr`, OT 8/7/6 |
| Sync OT asistencia | `sync_payroll_ot_from_attendance` (migración 202610190010 + 202611150001) | Sugiere extras por día |
| Actions admin | `src/app/admin/actions.ts` | `createPayroll`, `updatePayroll`, approve/reject OT |
| UI planilla | `src/app/admin/planilla/page.tsx` | Crear quincena / editar conceptos |
| UI asistencia | `src/app/admin/asistencia/page.tsx` | Jornada + extras por sesión |
| Alertas OT | `src/components/attendance-ot-alert.tsx` | Avisos y aceptación en lote |
| Empleados | `src/app/admin/empleados/page.tsx` | Horas/mes + exento CCSS |
| Reporte HTML | `src/app/admin/planilla/[id]/reporte/page.tsx` | Comprobante cerrado |
| CSV | `src/app/api/reportes/[id]/route.ts` | Export desglosado |
| Spec Excel | `xls_actual/LOGICA-PLANILLA.md` | Reglas de negocio originales |

---

## 2. Constantes (`src/lib/payroll.ts`)

```ts
CCSS_RATE            = 0.1083      // 10.83%
DAYS_PER_MONTH       = 30.42       // promedio CR
DEFAULT_HOURS_PER_DAY = 8
DEFAULT_HOURS_MONTH  = 243.36      // 30.42 × 8
OT_FACTOR            = 1.5         // horas extra
```

Montos internos: **centavos de CRC** (`bigint`), sin flotantes de moneda en DB.

Límites ordinarios por tipo de jornada (`src/lib/shift-cr.ts`):

```ts
DAY   → 480 min (8 h)
MIXED → 420 min (7 h)
NIGHT → 360 min (6 h)
NIGHT_THRESHOLD_MINUTES = 210  // 3 h 30 min nocturnas → pasa a Nocturna
```

---

## 3. Fórmulas del motor

### Valor hora

```text
hourly_rate_cents = round_a_colón( monthly_salary_cents / hours_month )
```

`roundColonCents`: redondea al colón entero (ej. 1724.84 → ₡1,725), igual que en la quincena Excel.

Función: `hourlyRateCents(salary, hoursMonth?)`

### Adelanto quincenal

```text
advance_cents = round( monthly_salary_cents / 2 )
```

Función: `fortnightAdvanceCents(salary)`

### Jornada diaria (referencia)

```text
daily_wage_cents = round( monthly_salary_cents / 30.42 )
```

Función: `dailyWageCents(salary)`

### Extras y doble (monto)

```text
ot_amount_cents     = round( ot_hours × hourly_rate_cents × 1.5 )
double_rate_cents   = hourly_rate_cents × 2   (por defecto)
double_amount_cents = round( double_hours × double_rate_cents )
```

Funciones: `overtimeAmountCents`, `doubleAmountCents`

Las **horas** extra sugeridas ya no son siempre `trabajadas − 8`: dependen del tipo de jornada (§3.1).

### 3.1 Clasificación Diurna / Mixta / Nocturna (art. 135 CT)

Referencia legal: franja **nocturna 19:00–05:00** (America/Costa_Rica).

| Clasificación | Condición | Límite ordinario |
|---|---|---|
| **Diurna** (`DAY`) | Todo el trabajo efectivo entre 05:00 y 19:00 (0 min nocturnos) | **8 h** |
| **Mixta** (`MIXED`) | Hay diurno y nocturno, y lo nocturno es **&lt; 3 h 30 min** | **7 h** |
| **Nocturna** (`NIGHT`) | Todo nocturno, **o** mixta con ≥ **3 h 30 min** nocturnas | **6 h** |

El motor cuenta minutos reales en la franja nocturna (incluido cruce de medianoche). No basta mirar solo la hora de entrada: un ingreso a las 16:00 puede cerrar diurna, mixta o nocturna según la salida.

#### Tolerancia diurna temprana (20 min antes de las 05:00)

Motivo: quienes empiezan jornada diurna a las 5:00 a. m. a veces marcan unos minutos antes. Sin tolerancia, esos minutos caen en franja nocturna (19:00–05:00) y la jornada se clasifica como **Mixta** (límite 7 h) en lugar de **Diurna** (límite 8 h).

| Concepto | Valor |
|---|---|
| Ventana de tolerancia | **04:40 – 04:59** (America/Costa_Rica) |
| Referencia de clasificación | **05:00** del mismo día |
| Constante TS | `EARLY_DAY_TOLERANCE_MINUTES = 20` en `src/lib/shift-cr.ts` |
| SQL | `classify_shift_cr` (migración `202611160003_early_day_tolerance.sql`) |

**Regla automática**

1. Si la **hora real de entrada** está entre 04:40 y 04:59 CR inclusive, el algoritmo usa **05:00** solo como inicio para contar minutos diurnos vs nocturnos y decidir Diurna / Mixta / Nocturna.
2. La **hora real de entrada se conserva** en asistencia, horas trabajadas (`worked_hours` / `workedMinutes`) y cálculo de extras.
3. Entradas a las **04:39 o antes** (o cualquier otra hora fuera de esa ventana) **no** reciben el snap: los minutos previos a las 05:00 cuentan como nocturnos normales.

```text
entrada real ∈ [04:40, 04:59] CR
  → classify_from = 05:00 CR   (solo para day/night)
  → workedMinutes = salida − entrada_real
  → nightMinutes  = countNight(classify_from → salida)
  → tipo / límite = según nightMinutes (0 → Diurna 8 h, …)

entrada real < 04:40  (ej. 04:39)
  → sin tolerancia; nightMinutes incluye 04:xx–05:00
```

**Qué cambia / qué no**

| Se ajusta | No se toca |
|---|---|
| Conteo diurno/nocturno para el **tipo** de jornada | Timestamp de marcación en DB |
| Límite ordinario OT (8 / 7 / 6) derivado del tipo | Horas netas trabajadas del día |
| UI “Jornada” en asistencia / alertas OT | Fotos, acks, planilla ya cerrada |

#### Ejemplos (`tests/shift-cr.test.ts`)

| Entrada | Salida | Min. nocturnos | Tipo |
|---|---|---|---|
| 06:00 | 14:00 | 0 | Diurna |
| 04:45 | 13:00 | 0 | Diurna (tolerancia → clasifica desde 05:00; worked = 8 h 15) |
| 04:40 | 12:40 | 0 | Diurna (límite inferior de tolerancia) |
| 04:59 | 13:00 | 0 | Diurna (límite superior de tolerancia) |
| 04:39 | 12:39 | 21 | Mixta (fuera de tolerancia) |
| 12:00 | 20:00 | 60 | Mixta |
| 14:00 | 22:00 | 180 | Mixta |
| 15:00 | 23:00 | 240 | Nocturna |
| 18:00 | 02:00 (+1) | 420 | Nocturna |
| 22:00 | 06:00 (+1) | 420 | Nocturna |
| 03:00 | 11:00 | 120 | Mixta |

#### Clasificación automática (solo marcación)

La jornada (Diurna / Mixta / Nocturna) y el límite OT (8/7/6) se calculan con la marcación de **entrada → salida**, aplicando la tolerancia diurna temprana cuando corresponde. No hay módulo de turnos planificados.

#### Horas extra sugeridas (asistencia → planilla)

```text
worked_hours     = suma de effective_sessions del día (ya restan descansos)
ordinary_limit   = 8 | 7 | 6   según classify(entrada, salida)
raw_ot           = max(0, worked_hours − ordinary_limit)
ot_grace         = 0.5 h (30 min)
ot_hours         = raw_ot < 0.5 ? 0 : raw_ot   (tope práctico 16 h)
```

**Menos de 30 min** de exceso → no se registra extra. **30 min o más** → se registra el **total** del exceso (incluidos esos 30 min).
Ej.: diurna 8 h + 25 min → OT 0; diurna 8 h + 30 min → OT 0.5 h; diurna 8 h + 50 min → OT 0.83 h.

Implementación:

| Capa | Función / archivo |
|---|---|
| TS | `classifyShift`, `classificationStartForDayNight`, `overtimeHours` → `src/lib/shift-cr.ts` |
| SQL | `classify_shift_cr(start, end)` (incluye tolerancia 04:40–04:59), `shift_ot_context(…)` |
| Sync | `sync_payroll_ot_from_attendance` usa `shift_ot_context` |
| Alertas | `list_attendance_ot_alerts` devuelve `shift_label`, `ordinary_limit_hours`, `ot_hours` |
| UI | Columna **Jornada** en `/admin/asistencia` |
| Tests | `tests/shift-cr.test.ts` (casos 04:40 / 04:45 / 04:59 / 04:39) |

**Notas / límites actuales**

- El clasificador trabaja sobre un intervalo continuo; los descansos ya están descontados en `worked_hours` de `effective_sessions` para el **monto de OT**, pero el conteo de minutos nocturnos del tipo usa la ventana entrada–salida (sin restar break minuto a minuto).
- Migraciones: `202611150001_shift_classification_cr.sql`, `202611160001_ot_grace_30min.sql`, `202611160002_ot_from_punch_only.sql`, `202611160003_early_day_tolerance.sql`.

### CCSS

```text
si exempt_from_ccss → ccss = 0
si no               → ccss = round( advance_cents × 0.1083 )
```

**Importante:** la CCSS se aplica **solo sobre el adelanto**, no sobre extras (como el Excel actual).

Función: `ccssCents(advance, exempt?)`

### Neto quincenal (`calculateFortnight`)

```text
addition_cents  = ot_amount + double_amount + other_pay
deduction_cents = ccss + shortage + receipt + other_deduction
gross_cents     = advance + addition
net_cents       = gross − deduction
```

Validación: `deduction ≤ gross` (`calculatePayroll`).

### Aguinaldo (helper listo, UI pendiente)

```text
aguinaldo_cents = round( (ordinario_acum + extras_acum) / 12 )
```

Función: `aguinaldoCents(ordinaryAccum, overtimeAccum)`

### Fechas de quincena

```ts
fortnightBounds("2026-10", 1) → { start: "2026-10-01", end: "2026-10-15" }
fortnightBounds("2026-10", 2) → { start: "2026-10-16", end: "2026-10-31" }
```

---

## 4. Modelo de datos

### `employees` (nuevos campos)

| Columna | Tipo | Default | Uso |
|---|---|---|---|
| `hours_per_month` | numeric(6,2) | 243.36 | Denominador del valor hora |
| `exempt_from_ccss` | boolean | false | Caso especial (ej. Elmer) |

Ya existían: `monthly_salary_cents`, cédula, email, etc.

### `payroll_runs`

| Columna | Uso |
|---|---|
| `period_start` / `period_end` | Rango de la quincena (o mes legacy) |
| `kind` | `'fortnight'` \| `'monthly'` |
| `status` | `'draft'` \| `'closed'` |

### `payroll_items` (desglose)

| Columna | Origen |
|---|---|
| `base_cents` | Adelanto = salary/2 (snapshot al crear) |
| `hours_month` | Snapshot de `employees.hours_per_month` |
| `hourly_rate_cents` | Snapshot calculado |
| `ot_hours` / `ot_amount_cents` | Captura admin → monto 1.5× |
| `double_hours` / `double_rate_cents` / `double_amount_cents` | Captura admin → monto 2× |
| `other_pay_cents` | Otros pagos manuales |
| `ccss_cents` | Auto sobre `base_cents` |
| `shortage_cents` | Faltantes pista |
| `receipt_cents` | Facturas / recibos |
| `other_deduction_cents` | Otras deducciones |
| `addition_cents` | Suma de extras + otros (generated vía update) |
| `deduction_cents` | CCSS + deducciones manuales |
| `gross_cents` / `net_cents` | Columnas generated: base+add / base+add−ded |
| `exempt_from_ccss` | Snapshot del empleado |
| `reviewed` | Flag de revisión administrativa |

---

## 5. Flujo en runtime

```mermaid
flowchart TD
  A[Admin: Nueva quincena mes + half 1|2] --> B[RPC create_payroll_fortnight]
  B --> C[Insert payroll_runs kind=fortnight]
  C --> D[Por cada empleado activo: base=salary/2 hourly CCSS]
  D --> E[UI: editar ot_hours double_hours faltantes facturas]
  E --> F[RPC update_payroll_item]
  F --> G[Recalcula ot/doble/CCSS/neto en servidor]
  G --> H{Todos reviewed?}
  H -->|Sí| I[RPC close_payroll]
  I --> J[Reporte HTML + CSV]
```

### Crear quincena

1. Formulario: mes (`YYYY-MM`) + quincena 1 o 2.  
2. Action `createPayroll` → RPC `create_payroll_fortnight(p_month, p_half)`.  
3. DB inserta ítems con adelanto, valor hora, CCSS inicial y `addition/deduction` coherentes.

### Actualizar ítem

1. Admin captura horas extra, doble, otros pagos, faltantes, facturas, otras.  
2. Action `updatePayroll` → RPC `update_payroll_item(...)`.  
3. El **servidor** recalcula montos y CCSS (no se confía en totales del cliente).

### Cerrar

Igual que antes: todos `reviewed`, sin jornadas abiertas ni ausencias pending, período ya terminado (`guard_payroll_close`).

---

## 6. RPCs relevantes

| Función | Firma esencial | Efecto |
|---|---|---|
| `create_payroll_fortnight` | `(p_month date, p_half int)` | Quincena 1–15 o 16–fin |
| `create_payroll` | `(p_month date)` | Mes completo (`kind=monthly`, legacy/tests) |
| `update_payroll_item` | `(id, ot_h, dbl_h, other_pay, shortage, receipt, other_ded, note, reviewed)` | Recalcula desglose + CCSS |
| `sync_payroll_ot_from_attendance` | `(p_run_id uuid)` | Llena `payroll_ot_days` con OT según 8/7/6 |
| `list_attendance_ot_alerts` | `(p_from, p_to)` | Alertas OT + tipo de jornada |
| `classify_shift_cr` | `(p_start, p_end)` | JSON tipo / minutos / límite |
| `shift_ot_context` | `(employee, date, window_start, window_end, worked_h)` | Preferencia turno pactado + OT |
| `create_employee` / `update_employee` | + `p_hours_month`, `p_exempt_ccss` | Datos para tarifa y CCSS |
| `_crc_hourly` / `_crc_round_colon` | helpers SQL | Mismo redondeo a colón |

---

## 7. Ejemplo numérico (tests)

Salario cajero 2026: **₡419,755.93** → `41_975_593` centavos.

| Concepto | Resultado |
|---|---|
| Horas mes | 243.36 |
| Valor hora | ₡1,725 |
| Adelanto | ≈ ₡209,877.97 |
| CCSS 10.83% | ≈ ₡22,729.78 |
| Neto sin extras | ≈ ₡187,148.19 |

Con 2 h extra: monto extra = `2 × 1725 × 1.5` = **₡5,175**.

---

## 8. Qué captura el usuario vs qué calcula el sistema

| Input humano | Calculado automático |
|---|---|
| Salario mensual | Adelanto (÷2) |
| Horas/mes | Valor hora |
| Exento CCSS (sí/no) | CCSS 10.83% sobre adelanto |
| Marcaciones entrada/salida | Horas netas + clasificación Diurna/Mixta/Nocturna + OT sugerido |
| Aprobar / rechazar / ajustar OT | Montos 1.5× (y doble 2× si se captura) |
| Otros pagos | Suma en adiciones |
| Faltantes, facturas, otras | Suma en deducciones |
| Revisado | — |
| — | Bruto y neto |

**Parcial / pendiente**

- Comprobante día a día (grilla del Excel)
- Corrida de aguinaldo en UI (solo helper en TS)
- Restar descansos **minuto a minuto** dentro del conteo nocturno del clasificador (hoy el OT usa horas netas de `effective_sessions`; el tipo usa la ventana continua)

---

## 9. Cómo verificar

```bash
npx vitest run tests/payroll.test.ts
npx vitest run tests/shift-cr.test.ts
```

Aplicar en Supabase (orden):

1. `202610180001_payroll_fortnight.sql` — planilla quincenal  
2. migraciones OT asistencia (`202610190006` … `202610190015`) si aún no están  
3. **`202611150001_shift_classification_cr.sql`** — clasificación CR y umbrales 8/7/6

---

## 10. Relación con el Excel

| Excel | Código |
|---|---|
| `CALCULO PLANILLA.xlsx` | `hourlyRateCents` + `fortnightAdvanceCents` + `ccssCents` |
| `PLANILLA QUINCENAL …xlsx` | `calculateFortnight` + UI de conceptos |
| `CALC. AGUINALDO 27.xlsx` | `aguinaldoCents` (sin corrida UI todavía) |

Si cambia la política (p. ej. CCSS también sobre extras), actualizar **este documento**, `LOGICA-PLANILLA.md` y las constantes/fórmulas en `payroll.ts` + el RPC `update_payroll_item` juntos.
