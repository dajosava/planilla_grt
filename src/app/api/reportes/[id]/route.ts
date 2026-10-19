import {requireRole} from "@/lib/auth";
import {csvCell} from "@/lib/payroll";
import {z} from "zod";

export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){
 const {client}=await requireRole("admin");
 const {id}=await params;
 if(!z.uuid().safeParse(id).success)return new Response("No encontrado",{status:404});
 const {data:run}=await client.from("payroll_runs").select("period_start,period_end,kind").eq("id",id).eq("status","closed").single();
 if(!run)return new Response("No encontrado",{status:404});
 const {data,error}=await client.from("payroll_items").select("*").eq("run_id",id).order("employee_name");
 if(error)return new Response("No se pudo generar el reporte",{status:500});
 const rows=[
  ["Código","Empleado","Adelanto CRC","Valor hora","Horas extra","Monto extra","Horas doble","Monto doble","Otros pagos","CCSS","Faltantes","Facturas","Otras deducciones","Neto CRC","Detalle"],
  ...(data??[]).map(i=>[
   i.employee_code,i.employee_name,
   (i.base_cents/100).toFixed(2),
   ((i.hourly_rate_cents??0)/100).toFixed(2),
   String(i.ot_hours??0),
   ((i.ot_amount_cents??0)/100).toFixed(2),
   String(i.double_hours??0),
   ((i.double_amount_cents??0)/100).toFixed(2),
   ((i.other_pay_cents??0)/100).toFixed(2),
   ((i.ccss_cents??0)/100).toFixed(2),
   ((i.shortage_cents??0)/100).toFixed(2),
   ((i.receipt_cents??0)/100).toFixed(2),
   ((i.other_deduction_cents??0)/100).toFixed(2),
   (i.net_cents/100).toFixed(2),
   i.note,
  ]),
 ];
 const name=`planilla-${run.period_start}_${run.period_end}.csv`;
 return new Response("\uFEFF"+rows.map(r=>r.map(csvCell).join(",")).join("\r\n"),{
  headers:{
   "Content-Type":"text/csv; charset=utf-8",
   "Content-Disposition":`attachment; filename="${name}"`,
   "Cache-Control":"private, no-store",
  },
 });
}
