import {notFound} from "next/navigation";
import {z} from "zod";
import {requireRole} from "@/lib/auth";
import {money} from "@/lib/format";
import {Table} from "@/components/admin-ui";
import {PrintButton} from "@/components/print-button";
import {
 ComprobantePago,
 formatSlipPeriod,
 linesFromPayrollItem,
} from "@/components/comprobante-pago";

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
 const items=data??[];

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

  <div className="no-print report-summary">
   <Table headers={["Código","Empleado","Adelanto","Extras","CCSS","Otras ded.","Neto"]}>
    {items.map(i=>{
     const extras=Number(i.ot_amount_cents??0)+Number(i.double_amount_cents??0)+Number(i.other_pay_cents??0);
     const otherDed=Number(i.shortage_cents??0)+Number(i.receipt_cents??0)+Number(i.other_deduction_cents??0);
     return <tr key={i.id}>
      <td>{i.employee_code}</td><td>{i.employee_name}</td>
      <td>{money(i.base_cents)}</td><td>{money(extras)}</td>
      <td>{money(i.ccss_cents??0)}</td><td>{money(otherDed)}</td>
      <td>{money(i.net_cents)}</td>
     </tr>;
    })}
   </Table>
   <h2>Total neto: {money(items.reduce((s,i)=>s+Number(i.net_cents),0))}</h2>
   <p className="small muted">Resumen interno. Abajo van los comprobantes individuales (impresión / futuro envío por correo).</p>
  </div>

  <div className="comprobante-stack">
   {items.map(i=>{
    const emp=Array.isArray(i.employees)?i.employees[0]:i.employees;
    const position=String((emp as {position?:string}|null)?.position??"");
    const department=String((emp as {department?:string}|null)?.department??company);
    const {income,deductions}=linesFromPayrollItem(i);
    return (
     <ComprobantePago
      key={i.id}
      companyName={companyTitle}
      employeeName={i.employee_name}
      employeeCode={i.employee_code}
      department={department}
      position={position}
      section={company}
      periodLabel={periodo}
      income={income}
      deductions={deductions}
      note={i.note}
     />
    );
   })}
  </div>
 </article>;
}
