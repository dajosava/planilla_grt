# Planilla quincenal — lógica aplicada en el código

Documentación de **cómo el sistema calcula** la planilla hoy.  
Origen de negocio: `xls_actual/LOGICA-PLANILLA.md` (Excel de la gasolinera).  
Implementación de referencia: `src/lib/payroll.ts` + `supabase/migrations/202610180001_payroll_fortnight.sql`.

---

## 1. Archivos involucrados

| Pieza | Ruta | Rol |
|---|---|---|
| Motor TypeScript | `src/lib/payroll.ts` | Constantes, fórmulas, `calculateFortnight` |
| Tests del motor | `tests/payroll.test.ts` | Ejemplo cajero ₡419,755.93 |
| Migración DB | `supabase/migrations/202610180001_payroll_fortnight.sql` | Columnas + RPCs |
| Actions admin | `src/app/admin/actions.ts` | `createPayroll`, `updatePayroll` |
| UI planilla | `src/app/admin/planilla/page.tsx` | Crear quincena / editar conceptos |
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

### Extras y doble

```text
ot_amount_cents     = round( ot_hours × hourly_rate_cents × 1.5 )
double_rate_cents   = hourly_rate_cents × 2   (por defecto)
double_amount_cents = round( double_hours × double_rate_cents )
```

Funciones: `overtimeAmountCents`, `doubleAmountCents`

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
| Horas extra / doble | Montos 1.5× y 2× |
| Otros pagos | Suma en adiciones |
| Faltantes, facturas, otras | Suma en deducciones |
| Revisado | — |
| — | Bruto y neto |

**No automatizado aún**

- Horas extra desde marcaciones (`effective_sessions`)
- Comprobante día a día (grilla del Excel)
- Corrida de aguinaldo en UI (solo helper en TS)

---

## 9. Cómo verificar

```bash
npx vitest run tests/payroll.test.ts
```

Aplicar migración `202610180001_payroll_fortnight.sql` en Supabase antes de usar la UI de planilla quincenal.

---

## 10. Relación con el Excel

| Excel | Código |
|---|---|
| `CALCULO PLANILLA.xlsx` | `hourlyRateCents` + `fortnightAdvanceCents` + `ccssCents` |
| `PLANILLA QUINCENAL …xlsx` | `calculateFortnight` + UI de conceptos |
| `CALC. AGUINALDO 27.xlsx` | `aguinaldoCents` (sin corrida UI todavía) |

Si cambia la política (p. ej. CCSS también sobre extras), actualizar **este documento**, `LOGICA-PLANILLA.md` y las constantes/fórmulas en `payroll.ts` + el RPC `update_payroll_item` juntos.
