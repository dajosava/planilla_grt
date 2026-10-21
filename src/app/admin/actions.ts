"use server";
import {revalidatePath} from "next/cache";import {z} from "zod";import {requireRole} from "@/lib/auth";import {employeeSchema,dateSchema,cedulaSchema,emailSchema,companySchema} from "@/lib/schemas";import {crcToCents,crcToCentsSigned} from "@/lib/payroll";import type {ActionState} from "@/components/action-form";
function fields(form:FormData){return Object.fromEntries(form.entries())}
function failure(error:unknown):ActionState{if(error instanceof z.ZodError)return {error:"Revisa los campos del formulario."};return {error:error instanceof Error?error.message:"No se pudo guardar el registro."};}
function dbError(error:{message:string;code?:string;details?:string}|null){
 if(!error)return;
 const text=`${error.message??""} ${error.details??""}`;
 if(error.code==="23505")throw new Error("Ya existe un registro con esos datos (código, cédula o quincena duplicada).");
 if(error.code==="23514"){
  if(/payroll_ot_days|worked_hours|ot_hours/i.test(text))
   throw new Error("Hay jornadas de asistencia con más de 24 h en un día. Corregí esas marcaciones en Asistencia e intentá de nuevo.");
  if(/date_trunc|1 mon|payroll_runs_check/i.test(text))
   throw new Error("La base todavía tiene un check de planilla mensual. Ejecutá la migración 202610190011 y volvé a intentar.");
  throw new Error(error.message||"Los valores no cumplen las condiciones o el saldo disponible.");
 }
 if(error.code==="P0001"||error.code==="42883")throw new Error(error.message);
 throw new Error(error.message||"No se pudo guardar. Revisa los datos y los permisos.");
}
export async function createEmployee(_:ActionState,form:FormData):Promise<ActionState>{const {client}=await requireRole("admin");try{const v=employeeSchema.parse({...fields(form),exempt_from_ccss:form.get("exempt_from_ccss")==="on"});const {error}=await client.rpc("create_employee",{p_code:v.code,p_name:v.full_name,p_department:v.department,p_position:v.position,p_salary:crcToCents(v.salary),p_pin:v.pin,p_vacation:v.vacation_balance,p_hired_on:v.hired_on,p_cedula:v.cedula,p_email:v.email,p_hours_month:v.hours_month,p_exempt_ccss:v.exempt_from_ccss});dbError(error);revalidatePath("/admin");revalidatePath("/admin/empleados");return {success:"Empleado registrado. Entrega el código y PIN de forma privada."};}catch(e){return failure(e)}}
export async function resetPin(_:ActionState,form:FormData):Promise<ActionState>{const {client}=await requireRole("admin");try{const v=z.object({employee_id:z.uuid(),pin:z.string().regex(/^\d{4}$/)}).parse(fields(form));const {error}=await client.rpc("set_employee_pin",{p_employee:v.employee_id,p_pin:v.pin});dbError(error);return {success:"PIN actualizado."}}catch(e){return failure(e)}}
export async function deleteEmployee(_:ActionState,form:FormData):Promise<ActionState>{const {client}=await requireRole("admin");try{const v=z.object({id:z.uuid(),confirm_code:z.string().trim().min(1)}).parse(fields(form));const {error}=await client.rpc("delete_employee",{p_id:v.id,p_confirm_code:v.confirm_code});dbError(error);revalidatePath("/admin",'layout');return {success:"Empleado eliminado."}}catch(e){return failure(e)}}
export async function toggleEmployee(form:FormData){const {client}=await requireRole("admin");const id=z.uuid().parse(form.get("id"));const {error}=await client.rpc("set_employee_active",{p_employee:id,p_active:form.get("active")==="true"});dbError(error);revalidatePath("/admin/empleados")}
export async function vacationBalance(_:ActionState,form:FormData):Promise<ActionState>{const {client}=await requireRole("admin");try{const v=z.object({employee_id:z.uuid(),days:z.coerce.number().min(-365).max(365).refine(n=>n!==0),reason:z.string().trim().min(5).max(500)}).parse(fields(form));const {error}=await client.rpc("add_vacation_balance",{p_employee:v.employee_id,p_days:v.days,p_reason:v.reason});dbError(error);revalidatePath("/admin/empleados");return {success:"Saldo ajustado y movimiento registrado."}}catch(e){return failure(e)}}
export async function createShift(_:ActionState,form:FormData):Promise<ActionState>{const {client}=await requireRole("admin");try{const v=z.object({employee_id:z.uuid(),starts_at:z.string().min(16),ends_at:z.string().min(16),note:z.string().max(500)}).parse(fields(form));const starts=new Date(v.starts_at+":00-06:00");const ends=new Date(v.ends_at+":00-06:00");if(!Number.isFinite(starts.getTime())||!Number.isFinite(ends.getTime())||ends<=starts||ends.getTime()-starts.getTime()>86400000)throw new Error("El fin debe ser posterior al inicio y la duración no debe superar 24 horas.");const {error}=await client.from("shifts").insert({...v,starts_at:starts.toISOString(),ends_at:ends.toISOString()});dbError(error);revalidatePath("/admin/turnos");return {success:"Turno registrado."}}catch(e){return failure(e)}}
export async function createAbsence(_:ActionState,form:FormData):Promise<ActionState>{const {client}=await requireRole("admin");try{const v=z.object({employee_id:z.uuid(),kind:z.enum(["vacation","sick","permission"]),starts_on:dateSchema,ends_on:dateSchema,vacation_days:z.coerce.number().min(0).max(365),note:z.string().max(1000)}).parse(fields(form));if(v.ends_on<v.starts_on)throw new Error("Revisa las fechas.");if(v.kind==="vacation"&&v.vacation_days<=0)throw new Error("Indica los días laborables de vacaciones que corresponden.");const {error}=await client.from("absences").insert({...v,vacation_days:v.kind==="vacation"?v.vacation_days:0});dbError(error);revalidatePath("/admin/ausencias");return {success:"Ausencia registrada, pendiente de revisión."}}catch(e){return failure(e)}}
export async function reviewAbsence(_:ActionState,form:FormData):Promise<ActionState>{const {client}=await requireRole("admin");try{const id=z.uuid().parse(form.get("id"));const status=z.enum(["approved","rejected"]).parse(form.get("status"));const {error}=await client.rpc("review_absence",{p_id:id,p_status:status});dbError(error);revalidatePath("/admin/ausencias");revalidatePath("/admin/empleados");return {success:"Revisión guardada."}}catch(e){return failure(e)}}
export async function correctSession(_:ActionState,form:FormData):Promise<ActionState>{const {client}=await requireRole("admin");try{const v=z.object({session_id:z.uuid(),started_at:z.string().min(16),ended_at:z.string().min(16),break_minutes:z.coerce.number().int().min(0).max(1440),reason:z.string().trim().min(5).max(500)}).parse(fields(form));const start=new Date(v.started_at+":00-06:00");const end=new Date(v.ended_at+":00-06:00");if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||end<=start||end.getTime()-start.getTime()<v.break_minutes*60000)throw new Error("Revisa las fechas y el descanso.");const {error}=await client.rpc("correct_session",{p_session:v.session_id,p_start:start.toISOString(),p_end:end.toISOString(),p_break:v.break_minutes,p_reason:v.reason});dbError(error);revalidatePath("/admin/asistencia");return {success:"Ajuste registrado. Las marcaciones originales se conservan."}}catch(e){return failure(e)}}
export async function ackAttendanceAlert(_:ActionState,form:FormData):Promise<ActionState>{
 const {client}=await requireRole("admin");
 try{
  const kind=z.enum(["missing_photo","missing_exit","ot_day"]).parse(form.get("kind"));
  const refId=z.string().trim().min(1).max(120).parse(form.get("ref_id"));
  const {error}=await client.rpc("ack_attendance_alert",{p_kind:kind,p_ref_id:refId,p_note:""});
  dbError(error);
  revalidatePath("/admin/asistencia");
  revalidatePath("/admin","layout");
  return {success:"Aviso marcado como revisado."};
 }catch(e){return failure(e)}
}
export async function createPayroll(_:ActionState,form:FormData):Promise<ActionState>{const {client}=await requireRole("admin");try{const month=z.string().regex(/^\d{4}-\d{2}$/).parse(form.get("month"));const half=z.coerce.number().int().refine((n):n is 1|2=>n===1||n===2).parse(form.get("half"));const company=companySchema.parse(form.get("company"));dateSchema.parse(month+"-01");const {error}=await client.rpc("create_payroll_fortnight",{p_month:month+"-01",p_half:half,p_company:company});dbError(error);revalidatePath("/admin/planilla");return {success:`Quincena ${half} de ${company} creada. Se calcularon sugerencias de horas extra desde asistencia (>8 h/día).`}}catch(e){return failure(e)}}
export async function updatePayroll(_:ActionState,form:FormData):Promise<ActionState>{const {client}=await requireRole("admin");try{
 const id=z.uuid().parse(form.get("id"));
 const otHours=z.coerce.number().min(0).max(400).parse(form.get("ot_hours")||"0");
 const doubleHours=z.coerce.number().min(0).max(400).parse(form.get("double_hours")||"0");
 const otherPay=crcToCents(String(form.get("other_pay")||"0"));
 const shortage=crcToCents(String(form.get("shortage")||"0"));
 const receipt=crcToCents(String(form.get("receipt")||"0"));
 const otherDeduction=crcToCents(String(form.get("other_deduction")||"0"));
 const note=z.string().max(2000).parse(form.get("note")??"");
 const {error}=await client.rpc("update_payroll_item",{
  p_id:id,p_ot_hours:otHours,p_double_hours:doubleHours,p_other_pay:otherPay,
  p_shortage:shortage,p_receipt:receipt,p_other_deduction:otherDeduction,
  p_note:note,p_reviewed:form.get("reviewed")==="on",
 });
 dbError(error);revalidatePath("/admin/planilla");return {success:"Conceptos guardados (CCSS recalculada sobre el adelanto)."}
}catch(e){return failure(e)}}
export async function closePayroll(_:ActionState,form:FormData):Promise<ActionState>{const {client}=await requireRole("admin");try{const id=z.uuid().parse(form.get("id"));const {error}=await client.rpc("close_payroll",{p_id:id});dbError(error);revalidatePath("/admin/planilla");return {success:"Planilla cerrada. Ya puedes descargar el reporte."}}catch(e){return failure(e)}}
export async function deletePayroll(_:ActionState,form:FormData):Promise<ActionState>{
 const {client}=await requireRole("admin");
 try{
  const id=z.uuid().parse(form.get("id"));
  const confirm=z.string().trim().min(1).parse(form.get("confirm"));
  const {error}=await client.rpc("delete_payroll_run",{p_id:id,p_confirm:confirm});
  dbError(error);
  revalidatePath("/admin/planilla");
  revalidatePath("/admin/planilla/historial");
  return {success:"Quincena eliminada. Podés crear otra cuando quieras."};
 }catch(e){return failure(e)}
}

export async function syncPayrollOt(_:ActionState,form:FormData):Promise<ActionState>{
 const {client}=await requireRole("admin");
 try{
  const id=z.uuid().parse(form.get("id"));
  const {data,error}=await client.rpc("sync_payroll_ot_from_attendance",{p_run_id:id});
  dbError(error);
  revalidatePath("/admin/planilla");
  revalidatePath("/admin/asistencia");
  const pending=typeof data==="object"&&data&&"pending" in data?Number((data as {pending:number}).pending):0;
  return {success:pending>0
   ?`Asistencia sincronizada. ${pending} empleado(s) con horas extra pendientes de aprobar.`
   :"Asistencia sincronizada. No hay horas extra nuevas por aprobar."};
 }catch(e){return failure(e)}
}

export async function approvePayrollOt(_:ActionState,form:FormData):Promise<ActionState>{
 const {client}=await requireRole("admin");
 try{
  const id=z.uuid().parse(form.get("id"));
  const hoursRaw=String(form.get("hours")||"");
  const hours=hoursRaw===""?null:z.coerce.number().min(0).max(400).parse(hoursRaw);
  const {error}=await client.rpc("approve_payroll_ot",{p_item_id:id,p_hours:hours});
  dbError(error);
  revalidatePath("/admin/planilla");
  revalidatePath("/admin/asistencia");
  return {success:"Horas extra aprobadas e incluidas en el neto."};
 }catch(e){return failure(e)}
}

export async function rejectPayrollOt(_:ActionState,form:FormData):Promise<ActionState>{
 const {client}=await requireRole("admin");
 try{
  const id=z.uuid().parse(form.get("id"));
  const {error}=await client.rpc("reject_payroll_ot",{p_item_id:id});
  dbError(error);
  revalidatePath("/admin/asistencia");
  revalidatePath("/admin/planilla");
  return {success:"Horas extra rechazadas (no se pagan)."};
 }catch(e){return failure(e)}
}

export async function createAguinaldo(_:ActionState,form:FormData):Promise<ActionState>{
 const {client}=await requireRole("admin");
 try{
  const year=z.coerce.number().int().min(2000).max(2100).parse(form.get("year"));
  const company=companySchema.parse(form.get("company"));
  const {error}=await client.rpc("create_aguinaldo_run",{p_year:year,p_company:company});
  dbError(error);
  revalidatePath("/admin/planilla/aguinaldo");
  return {success:`Aguinaldo ${year} de ${company} creado. Revisá la acumulación desde quincenas cerradas.`};
 }catch(e){return failure(e)}
}

export async function syncAguinaldo(_:ActionState,form:FormData):Promise<ActionState>{
 const {client}=await requireRole("admin");
 try{
  const id=z.uuid().parse(form.get("id"));
  const {data,error}=await client.rpc("sync_aguinaldo_run",{p_run_id:id});
  dbError(error);
  revalidatePath("/admin/planilla/aguinaldo");
  const n=typeof data==="object"&&data&&"employees" in data?Number((data as {employees:number}).employees):0;
  return {success:n>0
   ?`Acumulación actualizada: ${n} empleado(s) con quincenas cerradas en el período.`
   :"No hay quincenas cerradas en el período para esta sociedad."};
 }catch(e){return failure(e)}
}

export async function updateAguinaldoItem(_:ActionState,form:FormData):Promise<ActionState>{
 const {client}=await requireRole("admin");
 try{
  const id=z.uuid().parse(form.get("id"));
  const adjustment=crcToCentsSigned(String(form.get("adjustment")||"0"));
  const note=z.string().max(2000).parse(form.get("note")??"");
  const {error}=await client.rpc("update_aguinaldo_item",{
   p_id:id,
   p_adjustment_cents:adjustment,
   p_note:note,
   p_reviewed:form.get("reviewed")==="on",
  });
  dbError(error);
  revalidatePath("/admin/planilla/aguinaldo");
  return {success:"Ítem de aguinaldo guardado."};
 }catch(e){return failure(e)}
}

export async function closeAguinaldo(_:ActionState,form:FormData):Promise<ActionState>{
 const {client}=await requireRole("admin");
 try{
  const id=z.uuid().parse(form.get("id"));
  const {error}=await client.rpc("close_aguinaldo_run",{p_id:id});
  dbError(error);
  revalidatePath("/admin/planilla/aguinaldo");
  return {success:"Aguinaldo cerrado. Ya podés proceder con el pago."};
 }catch(e){return failure(e)}
}

export async function deleteAguinaldo(_:ActionState,form:FormData):Promise<ActionState>{
 const {client}=await requireRole("admin");
 try{
  const id=z.uuid().parse(form.get("id"));
  const confirm=z.string().trim().min(1).parse(form.get("confirm"));
  const {error}=await client.rpc("delete_aguinaldo_run",{p_id:id,p_confirm:confirm});
  dbError(error);
  revalidatePath("/admin/planilla/aguinaldo");
  return {success:"Corrida de aguinaldo eliminada."};
 }catch(e){return failure(e)}
}

export async function updateEmployee(_:ActionState,form:FormData):Promise<ActionState>{const {client}=await requireRole("admin");try{const v=z.object({id:z.uuid(),full_name:z.string().trim().min(3).max(120),department:companySchema,position:z.string().trim().min(2).max(80),salary:z.string(),hired_on:dateSchema,cedula:cedulaSchema,email:emailSchema,hours_month:z.coerce.number().min(1).max(400).default(243.36),exempt_from_ccss:z.coerce.boolean().default(false)}).parse({...fields(form),exempt_from_ccss:form.get("exempt_from_ccss")==="on"});const {error}=await client.rpc("update_employee",{p_id:v.id,p_name:v.full_name,p_department:v.department,p_position:v.position,p_salary:crcToCents(v.salary),p_hired_on:v.hired_on,p_cedula:v.cedula,p_email:v.email,p_hours_month:v.hours_month,p_exempt_ccss:v.exempt_from_ccss});dbError(error);revalidatePath("/admin/empleados");return {success:"Datos actualizados. Las planillas existentes conservan su información histórica."}}catch(e){return failure(e)}}
