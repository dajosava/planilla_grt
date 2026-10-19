# Lógica de planilla — Gasolinera Río Tempisque

Documentación derivada de los Excel actuales en esta carpeta:

| Archivo | Uso |
|---|---|
| `CALCULO PLANILLA.xlsx` | Tabla maestra: salario base, valor hora, quincena, CCSS, neto |
| `PLANILLA QUINCENAL 15-10-2026.xlsx` | Comprobante por empleado (día a día + extras + depósito) |
| `CALC. AGUINALDO 27.xlsx` | Acumulación anual de aguinaldo (ordinario + extras) |

Esta es la lógica con la que **actualmente se paga**. El sistema debe poder replicarla.

---

## 1. Constantes operativas (2026)

| Concepto | Valor | Notas |
|---|---|---|
| Salario base mensual (cajero) | `₡419,755.93` | Celda `ACTUAL` en cálculo; anterior `₡413,023.64` (~+1.63%) |
| Días promedio del mes (CR) | `30.42` | Estándar costarricense |
| Horas jornada diaria | `8` | Típico en comprobantes |
| Horas mes (jornada completa) | `30.42 × 8 = 243.36` | Usado para valor hora |
| CCSS trabajador | `10.83%` | Solo sobre adelanto quincenal en los Excel |
| Factor horas extra | `1.5` | Sobre precio hora |
| Factor doble ocasional | columnas propias | Horas × tarifa doble (cuando aplica) |

Otros salarios vistos:

- **Elmer:** `₡600,000` mensual, 274 h, quincena `₡300,000`, **sin CCSS** en el archivo de cálculo (excepción).

---

## 2. Cálculo maestro (`CALCULO PLANILLA.xlsx`)

### Columnas

| Col | Concepto |
|---|---|
| A | Cédula + nombre |
| B | Salario base mensual |
| C | Horas ordinarias del mes |
| D | Quincenal (`B/2`) |
| E | Valor por hora (`B/C`) |
| F | Total quincena (`C×E/2`) |
| G | CCSS (`F × 10.83%`) |
| H | Neto quincenal (`F − G`) |
| I | Jornada diaria (`B / 30.42`) |

### Fórmulas por empleado

```text
salario_mensual   = B                          # suele referenciar celda ACTUAL
quincena_base     = salario_mensual / 2
valor_hora        = salario_mensual / horas_mes
total_quincena    = horas_mes × valor_hora / 2 # algebraicamente = salario/2
ccss              = total_quincena × 0.1083
neto              = total_quincena − ccss
jornada_diaria    = salario_mensual / 30.42
```

### Comportamiento importante

Aunque `horas_mes` varíe (212.94, 243.36, 182.52…), **el adelanto quincenal sigue siendo `salario/2`**.  
Las horas sirven principalmente para obtener el **precio por hora** usado en extras.

Ejemplo (cajero 2026, 243.36 h):

```text
valor_hora ≈ 419755.93 / 243.36 ≈ 1724.84  → en quincena suelen redondear a 1725
quincena   = 209877.965
ccss       ≈ 22729.78
neto       ≈ 187148.18
```

---

## 3. Comprobante quincenal (`PLANILLA QUINCENAL …xlsx`)

Un bloque por empleado: grilla diaria + panel de pago a la derecha.

### 3.1 Por día

| Col | Concepto | Fórmula |
|---|---|---|
| C | Horas ordinarias | valor capturado (casi siempre 8) |
| D | Precio por hora | valor capturado (1725, 1971.43, 2300…) |
| E | Total ordinario | `C × D` |
| F | Horas extra | valor capturado |
| G | Tarifa extra | `D × 1.5` |
| H | Monto extra | `F × G` |
| I | Horas doble | valor capturado |
| J | Tarifa doble ocasional | valor capturado |
| K | Monto doble | `I × J` |
| L | Total día s/ deducciones | `E + H + K` |

```text
ordinario     = horas_ordinarias × precio_hora
tarifa_extra  = precio_hora × 1.5
monto_extra   = horas_extra × tarifa_extra
monto_doble   = horas_doble × tarifa_doble
total_dia     = ordinario + monto_extra + monto_doble
```

### 3.2 Panel de pago (depósito)

```text
adelanto_quincenal = base_mes / 2
+ horas_extra_periodo     # suma de montos extra del bloque
+ horas_doble_periodo     # suma de montos doble del bloque
+ otros_pagos             # manual
= SUBTOTAL

deducciones:
  ccss              = adelanto_quincenal × 10.83%   # solo sobre el adelanto
  faltantes_pista   = manual
  facturas_recibos  = manual
  otras_deducciones = manual
= TOTAL_DEDUCCIONES

TOTAL_A_DEPOSITAR = SUBTOTAL − TOTAL_DEDUCCIONES
```

### Precios hora observados (quincena 15/10/2026)

- `1725` (mayoría)
- `1971.43`
- `2300`

---

## 4. Aguinaldo (`CALC. AGUINALDO 27.xlsx`)

Una columna por empleado. Acumulan ordinario y extras por tramos/quincenas.

### Ordinario

```text
salario_ordinario_tramo = quincenas_del_tramo × salario_quincenal_del_tramo
salario_ordinario_acum  = Σ tramos
aguinaldo_ordinario     = salario_ordinario_acum / 12
```

### Extras

```text
extras_acumuladas  = Σ montos de extras por quincena del período
aguinaldo_extras   = extras_acumuladas / 12
```

### Totales

```text
TOTAL_AGUINALDO     = aguinaldo_ordinario + aguinaldo_extras
salario_total_rec   = ordinario_acum + extras_acum
# (+ vacaciones pagadas si se capturan)
```

Es el esquema de **doceavo** costarricense, separado entre ordinario y extras.

---

## 5. Pseudocódigo para el sistema

```ts
const CCSS_RATE = 0.1083;
const DAYS_PER_MONTH = 30.42;
const DEFAULT_HOURS_PER_DAY = 8;
const DEFAULT_HOURS_MONTH = DAYS_PER_MONTH * DEFAULT_HOURS_PER_DAY; // 243.36
const OT_FACTOR = 1.5;

function hourlyRate(monthlySalary: number, hoursMonth = DEFAULT_HOURS_MONTH) {
  return roundColon(monthlySalary / hoursMonth); // definir redondeo (entero o 2 decimales)
}

function fortnightAdvance(monthlySalary: number) {
  return monthlySalary / 2;
}

function dailyWage(monthlySalary: number) {
  return monthlySalary / DAYS_PER_MONTH;
}

function dayPay(ordinaryHours: number, rate: number, otHours: number, doubleHours: number, doubleRate: number) {
  const ordinary = ordinaryHours * rate;
  const overtime = otHours * rate * OT_FACTOR;
  const doublePay = doubleHours * doubleRate;
  return { ordinary, overtime, doublePay, total: ordinary + overtime + doublePay };
}

function deposit(params: {
  monthlySalary: number;
  overtimeAmount: number;
  doubleAmount: number;
  otherPay?: number;
  shortages?: number;
  receipts?: number;
  otherDeductions?: number;
  exemptFromCcss?: boolean; // ej. Elmer
}) {
  const advance = fortnightAdvance(params.monthlySalary);
  const subtotal = advance + params.overtimeAmount + params.doubleAmount + (params.otherPay ?? 0);
  const ccss = params.exemptFromCcss ? 0 : advance * CCSS_RATE; // igual que Excel actual
  const deductions = ccss + (params.shortages ?? 0) + (params.receipts ?? 0) + (params.otherDeductions ?? 0);
  return { advance, subtotal, ccss, deductions, net: subtotal - deductions };
}

function aguinaldo(ordinaryAccum: number, overtimeAccum: number) {
  return ordinaryAccum / 12 + overtimeAccum / 12;
}
```

---

## 6. Reglas de negocio a respetar (como pagan hoy)

1. Pago **quincenal**.
2. **Adelanto base** = `salario_mensual / 2` (no prorrateado por asistencia en el Excel).
3. **Extras** a `1.5 ×` precio hora; **doble ocasional** en columnas aparte.
4. **CCSS 10.83%** solo sobre el adelanto quincenal (no sobre extras en los archivos actuales).
5. Deducciones operativas manuales: faltantes de pista, facturas/recibos, otras.
6. Aguinaldo = doceavo de ordinarios + doceavo de extras.
7. Empleados con excepción (salario distinto / sin CCSS) deben poder configurarse.

---

## 7. Hallazgos / riesgos (mejoras recomendadas)

| # | Hallazgo | Riesgo / mejora |
|---|---|---|
| 1 | CCSS no se aplica a extras | Confirmar con contador; en CR suele gravar más remuneraciones. Dejar flag configurable. |
| 2 | Adelanto fijo sin amarrar a marcaciones | Si el sistema usa punches, decidir: adelanto fijo (como hoy) vs prorrateo por días/horas. |
| 3 | Elmer sin CCSS y otro salario | Modelar excepciones por empleado. |
| 4 | Etiqueta “EXTRAS Ó DOBLES” usa factor 1.5 | En UI/código: “Extra 1.5” y “Doble 2.0” por separado. |
| 5 | Domingo a tarifa ordinaria (+ extras) | Validar si el domingo completo debería ir a doble. |
| 6 | Aguinaldo con años/etiquetas inconsistentes | Limpiar períodos al migrar; no copiar etiquetas tal cual. |
| 7 | No hay renta ni embargos en los Excel | Fase 2 si aplica. |
| 8 | Redondeo hora `1724.84` → `1725` | Fijar regla de redondeo en el sistema. |
| 9 | Variar horas mes no cambia el neto base | Solo cambia valor hora; documentar como intencional o corregir. |

---

## 8. Mapeo en el sistema (implementado)

| Concepto Excel | Campo / módulo app |
|---|---|
| Salario mensual | `employees.monthly_salary_cents` |
| Horas mes | `employees.hours_per_month` (default 243.36) |
| Exento CCSS | `employees.exempt_from_ccss` |
| Valor hora | `payroll_items.hourly_rate_cents` (snapshot) |
| Adelanto quincenal | `payroll_items.base_cents` = salary/2 |
| Extras / dobles | `ot_*` / `double_*` en `payroll_items` |
| CCSS 10.83% | `payroll_items.ccss_cents` (auto sobre adelanto) |
| Faltantes / facturas | `shortage_cents` / `receipt_cents` / `other_deduction_cents` |
| Motor TS | `src/lib/payroll.ts` → `calculateFortnight` |
| Migración | `supabase/migrations/202610180001_payroll_fortnight.sql` |
| Aguinaldo | pendiente (fase 2: doceavo sobre quincenas cerradas) |

### Datos que ya se colectaban

- Salario mensual, cédula, correo, área, puesto, vacaciones, PIN
- Asistencia / horas operativas (aún **no** alimentan extras automáticamente)

### Datos nuevos a capturar

- Horas/mes y exención CCSS en Empleados
- Por quincena: horas extra, horas doble, otros pagos, faltantes, facturas, otras deducciones

### Aún no colectamos (manual o fase 2)

- Desglose día a día del comprobante Excel (opcional; la quincena usa totales)
- Aguinaldo acumulado automático
- OT sugerido desde marcaciones (`worked_hours`)

---

## 9. Fuente

Extraído el 2026-10-18 a partir de las fórmulas y valores calculados de los tres `.xlsx` de esta carpeta.  
Si cambian la política de pago (CCSS sobre extras, prorrateo por asistencia, etc.), actualizar este documento y el motor de planilla juntos.
