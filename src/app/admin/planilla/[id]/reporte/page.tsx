import {notFound} from "next/navigation";
import {z} from "zod";
import {requireRole} from "@/lib/auth";
import {money} from "@/lib/format";
import {Table} from "@/components/admin-ui";
import {PrintButton} from "@/components/print-button";
import {labelFortnight} from "@/lib/payroll";

export default async function Report({params}:{params:Promise<{id:string}>}){
 const {client}=await requireRole("admin");
 const {id}=await params;
 if(!z.uuid().safeParse(id).success)notFound();
 const {data:run}=await client.from("payroll_runs").select("*").eq("id",id).eq("status","closed").single();
 if(!run)notFound();
 const {data,error}=await client.from("payroll_items").select("*").eq("run_id",id).order("employee_name");
 if(error)throw new Error("No se pudo generar el reporte");
 const periodo=run.kind==="fortnight"?labelFortnight(run.period_start,run.period_end):`${run.period_start} al ${run.period_end}`;
 return <article className="report">
  <p className="eyebrow">GASOLINERA RÍO TEMPISQUE · PUEBLO VIEJO, NICOYA</p>
  <h1>Reporte de pagos quincenal</h1>
  <p>Período: {periodo} · Moneda: CRC</p>
  <PrintButton/>
  <Table headers={["Código","Empleado","Adelanto","Extras","CCSS","Otras ded.","Neto"]}>
   {data?.map(i=>{
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
  <h2>Total neto: {money(data?.reduce((s,i)=>s+Number(i.net_cents),0)??0)}</h2>
  <p className="small">El reporte no ejecuta transferencias bancarias ni acredita que se hayan realizado los pagos.</p>
  {data?.map(i=>{
   const extras=Number(i.ot_amount_cents??0)+Number(i.double_amount_cents??0)+Number(i.other_pay_cents??0);
   return <section className="payslip" key={i.id}>
    <h2>Comprobante · {i.employee_name}</h2>
    <p>{i.employee_code} · {periodo}</p>
    <p>Adelanto: {money(i.base_cents)} · Extras/otros: {money(extras)} · CCSS: {money(i.ccss_cents??0)}</p>
    <p>Faltantes: {money(i.shortage_cents??0)} · Facturas: {money(i.receipt_cents??0)} · Otras: {money(i.other_deduction_cents??0)}</p>
    <h3>Neto a depositar: {money(i.net_cents)}</h3>
    <p className="pre-wrap">{i.note}</p>
   </section>;
  })}
 </article>;
}
