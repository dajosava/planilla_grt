import {notFound} from "next/navigation";
import {z} from "zod";
import {requireRole} from "@/lib/auth";
import {PrintButton} from "@/components/print-button";
import {
 formatSlipPeriod,
 linesFromPayrollItem,
} from "@/components/comprobante-pago";
import {
 ComprobantesPreview,
 type ComprobantePreviewItem,
} from "@/components/comprobantes-preview";

export default async function Report({params}:{params:Promise<{id:string}>}){
 const {client}=await requireRole("admin");
 const {id}=await params;
 if(!z.uuid().safeParse(id).success)notFound();
 const {data:run}=await client.from("payroll_runs").select("*").eq("id",id).in("status",["draft","closed"]).single();
 if(!run)notFound();
 const isDraft=run.status==="draft";

 const {data,error}=await client
  .from("payroll_items")
  .select("*,employees:employee_id(position,department)")
  .eq("run_id",id)
  .order("employee_name");
 if(error)throw new Error("No se pudo generar el reporte");

 const company=String(run.company??"Gasolinera");
 const companyTitle=`GASOLINERA RÍO TEMPISQUE · ${company.toUpperCase()}`;
 const periodo=formatSlipPeriod(run.period_start,run.period_end);
 const raw=data??[];

 const items:ComprobantePreviewItem[]=raw.map(i=>{
  const emp=Array.isArray(i.employees)?i.employees[0]:i.employees;
  const position=String((emp as {position?:string}|null)?.position??"");
  const department=String((emp as {department?:string}|null)?.department??company);
  const {income,deductions}=linesFromPayrollItem(i);
  const extras=Number(i.ot_amount_cents??0)+Number(i.double_amount_cents??0)+Number(i.other_pay_cents??0);
  const otherDed=Number(i.shortage_cents??0)+Number(i.receipt_cents??0)+Number(i.other_deduction_cents??0);
  return {
   id:i.id,
   employee_code:i.employee_code,
   employee_name:i.employee_name,
   base_cents:Number(i.base_cents),
   extras_cents:extras,
   ccss_cents:Number(i.ccss_cents??0),
   other_ded_cents:otherDed,
   net_cents:Number(i.net_cents),
   slip:{
    companyName:companyTitle,
    employeeName:i.employee_name,
    employeeCode:i.employee_code,
    department,
    position,
    section:company,
    periodLabel:periodo,
    income,
    deductions,
    note:i.note,
   },
  };
 });

 const totalNet=items.reduce((s,i)=>s+i.net_cents,0);

 return <article className="report">
  <div className="report-toolbar no-print">
   <div>
    <p className="eyebrow">GASOLINERA RÍO TEMPISQUE · PUEBLO VIEJO, NICOYA</p>
    <h1>{isDraft?"Vista previa de comprobantes":"Reporte de pagos"} · {company}</h1>
    <p>Período: {periodo} · Moneda: CRC{isDraft?" · Borrador (aún no cerrado)":""}</p>
   </div>
   <PrintButton/>
  </div>
  {isDraft&&(
   <p className="alert no-print" role="status">
    Esta quincena sigue en borrador. Los montos pueden cambiar si editás extras o deducciones antes de cerrar.
   </p>
  )}

  <ComprobantesPreview items={items} totalNet={totalNet}/>
 </article>;
}
