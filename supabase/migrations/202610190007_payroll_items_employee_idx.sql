-- Índice para historial de pagos por empleado (rango multi-quincena).
create index if not exists payroll_items_employee_id_idx
  on public.payroll_items (employee_id);
