import Link from "next/link";
import {Users,Wallet,Shield,Receipt,CheckCircle2} from "lucide-react";
import {requireRole} from "@/lib/auth";
import {Heading,Panel,CollapsiblePanel,Table,Empty} from "@/components/admin-ui";
import {ActionForm} from "@/components/action-form";
import {KpiCard} from "@/components/ui/kpi-card";
import {Badge} from "@/components/ui/badge";
import {PayrollFlow,payrollActiveIndex} from "@/components/payroll-flow";
import {createPayroll,updatePayroll,closePayroll} from "../actions";
import {money,labels,todayCR} from "@/lib/format";
import {labelFortnight} from "@/lib/payroll";

function periodLabel(run:{period_start:string;period_end:string;kind?:string|null;status:string}){
 if(run.kind==="fortnight")return `${labelFortnight(run.period_start,run.period_end)} · ${labels[run.status]}`;
 return `${run.period_start.slice(0,7)} · ${labels[run.status]}`;
}

export default async function Page({searchParams}:{searchParams:Promise<{run?:string}>}){
 const {client}=await requireRole("admin");
 const params=await searchParams;
 const {data:runs,error}=await client.from("payroll_runs").select("*").order("period_start",{ascending:false});
 if(error)throw new Error("No se pudo cargar la planilla");
 const selected=runs?.find(r=>r.id===params.run)??runs?.[0];
 const {data:items,error:itemError}=selected?await client.from("payroll_items").select("*").eq("run_id",selected.id).order("employee_name"):{data:[],error:null};
 if(itemError)throw new Error("No se pudieron cargar los conceptos");

 const list=items??[];
 const count=list.length;
 const reviewed=list.filter(i=>i.reviewed).length;
 const reviewPct=count?Math.round(reviewed*100/count):0;
 const totalNet=list.reduce((s,i)=>s+Number(i.net_cents),0);
 const totalAdvance=list.reduce((s,i)=>s+Number(i.base_cents),0);
 const totalExtras=list.reduce((s,i)=>s+Number(i.ot_amount_cents??0)+Number(i.double_amount_cents??0)+Number(i.other_pay_cents??0),0);
 const totalCcss=list.reduce((s,i)=>s+Number(i.ccss_cents??0),0);
 const totalOtherDed=list.reduce((s,i)=>s+Number(i.shortage_cents??0)+Number(i.receipt_cents??0)+Number(i.other_deduction_cents??0),0);
 const hasExtras=totalExtras>0;
 const hasManualDeductions=totalOtherDed>0;
 const isDraft=selected?.status==="draft";
 const isClosed=selected?.status==="closed";

 const activeIndex=payrollActiveIndex({
  hasRun:!!selected,
  isDraft:!!isDraft,
  reviewed,
  total:count,
  hasExtras,
  hasManualDeductions,
 });

 return <>
  <Heading
   title="Planilla quincenal"
   actions={selected?undefined:<Link className="button secondary" href="/admin/empleados">Ver empleados</Link>}
  />

  <PayrollFlow activeIndex={activeIndex}/>

  <CollapsiblePanel title="1 · Crear quincena" open={!selected}>
   <p className="muted small">Elegí el mes y si es la 1ª (días 1–15) o la 2ª (16–fin). Se precarga adelanto = salario/2 y CCSS 10.83%.</p>
   <ActionForm action={createPayroll} submit="Crear quincena">
    <label>Mes<input name="month" type="month" defaultValue={todayCR().slice(0,7)} required/></label>
    <label>Quincena<select name="half" defaultValue={Number(todayCR().slice(8,10))<=15?"1":"2"} required>
     <option value="1">1ª quincena (1–15)</option>
     <option value="2">2ª quincena (16–fin de mes)</option>
    </select></label>
   </ActionForm>
  </CollapsiblePanel>

  {!selected?<Empty text="Todavía no hay quincenas. Creá la primera arriba."/>:<>
   <div className="period-tabs" role="tablist" aria-label="Quincenas">
    {runs?.map(r=><Link key={r.id} className={r.id===selected.id?"active":""} href={"/admin/planilla?run="+r.id}>{periodLabel(r)}</Link>)}
   </div>

   <p className="payroll-period-banner">
    <strong>{labelFortnight(selected.period_start,selected.period_end)}</strong>
    <Badge tone={isClosed?"approved":"pending"}>{labels[selected.status]}</Badge>
   </p>

   <div className="stats">
    <KpiCard
     label="Empleados en nómina" value={count} tone="navy" icon={<Users size={18}/>}
     sub={<>{reviewed} de {count} revisados · {reviewPct}%</>}
     progress={reviewPct}
    />
    <KpiCard
     label="Neto a pagar" value={money(totalNet)} tone="green" icon={<Wallet size={18}/>}
     sub={<>Adelantos {money(totalAdvance)}{totalExtras>0?<> · extras {money(totalExtras)}</>:null}</>}
     title="Total a depositar en esta quincena"
    />
    <KpiCard
     label="CCSS (10.83%)" value={money(totalCcss)} tone="amber" icon={<Shield size={18}/>}
     sub="Solo sobre el adelanto quincenal"
    />
    <KpiCard
     label="Otras deducciones" value={money(totalOtherDed)} tone={totalOtherDed>0?"danger":"navy"} icon={<Receipt size={18}/>}
     sub="Faltantes, facturas y otras"
    />
   </div>

   <Panel title="2 · Resumen por empleado" action={isClosed?<Badge tone="approved"><CheckCircle2 size={12}/> Cerrada</Badge>:undefined}>
    {!list.length?<Empty text="Sin empleados en esta quincena."/>:(
     <Table headers={["Empleado","Adelanto","Extras","CCSS","Otras ded.","Neto","Estado"]}>
      {list.map(i=>{
       const extras=Number(i.ot_amount_cents??0)+Number(i.double_amount_cents??0)+Number(i.other_pay_cents??0);
       const otherDed=Number(i.shortage_cents??0)+Number(i.receipt_cents??0)+Number(i.other_deduction_cents??0);
       return <tr key={i.id}>
        <td><strong>{i.employee_name}</strong><small>{i.employee_code} · {money(i.hourly_rate_cents??0)}/h</small></td>
        <td>{money(i.base_cents)}</td>
        <td>{money(extras)}</td>
        <td>{money(i.ccss_cents??0)}{i.exempt_from_ccss?<small> exento</small>:null}</td>
        <td>{money(otherDed)}</td>
        <td><strong className="tabular">{money(i.net_cents)}</strong></td>
        <td><Badge tone={i.reviewed?"approved":"pending"}>{i.reviewed?"Revisado":"Pendiente"}</Badge></td>
       </tr>;
      })}
     </Table>
    )}
   </Panel>

   {isDraft?<>
    <CollapsiblePanel title="3 · Capturar extras y deducciones" open>
     <p className="muted small">Abrí cada empleado, cargá horas extra/doble y faltantes o facturas. La CCSS se recalcula sola sobre el adelanto.</p>
     {list.map(i=><details key={i.id} className="payroll-emp-edit">
      <summary>
       <span>{i.employee_name}</span>
       <strong className="tabular">{money(i.net_cents)}</strong>
       <Badge tone={i.reviewed?"approved":"pending"}>{i.reviewed?"✓":"…"}</Badge>
      </summary>
      <p className="muted small">Adelanto {money(i.base_cents)} · Valor hora {money(i.hourly_rate_cents??0)}{i.exempt_from_ccss?" · Exento CCSS":""}</p>
      <ActionForm action={updatePayroll}>
       <input name="id" type="hidden" value={i.id}/>
       <label>Horas extra (1.5×)<input name="ot_hours" type="number" min="0" max="400" step="0.01" defaultValue={Number(i.ot_hours??0)}/></label>
       <label>Horas doble (2×)<input name="double_hours" type="number" min="0" max="400" step="0.01" defaultValue={Number(i.double_hours??0)}/></label>
       <label>Otros pagos (CRC)<input name="other_pay" type="number" min="0" step="0.01" defaultValue={(Number(i.other_pay_cents??0))/100}/></label>
       <label>Faltantes pista (CRC)<input name="shortage" type="number" min="0" step="0.01" defaultValue={(Number(i.shortage_cents??0))/100}/></label>
       <label>Facturas / recibos (CRC)<input name="receipt" type="number" min="0" step="0.01" defaultValue={(Number(i.receipt_cents??0))/100}/></label>
       <label>Otras deducciones (CRC)<input name="other_deduction" type="number" min="0" step="0.01" defaultValue={(Number(i.other_deduction_cents??0))/100}/></label>
       <label>Notas<textarea name="note" maxLength={2000} defaultValue={i.note??""}/></label>
       <label className="checkbox"><input name="reviewed" type="checkbox" defaultChecked={!!i.reviewed}/>Marcar como revisado</label>
      </ActionForm>
     </details>)}
    </CollapsiblePanel>

    <CollapsiblePanel title="4 · Cerrar y pagar" open={reviewed===count&&count>0}>
     {reviewed<count?(
      <p className="alert">Faltan {count-reviewed} empleado(s) por revisar antes de cerrar.</p>
     ):(
      <p className="muted">Todo revisado. Al cerrar se bloquea la quincena y podés descargar el reporte para depositar.</p>
     )}
     <p className="payroll-close-total">Neto a depositar: <strong className="amount">{money(totalNet)}</strong></p>
     <ActionForm action={closePayroll} submit="Cerrar quincena y habilitar pago">
      <input type="hidden" name="id" value={selected.id}/>
     </ActionForm>
    </CollapsiblePanel>
   </>:
    <Panel title="5 · Pago y comprobantes">
     <p className="muted">Quincena cerrada. Descargá el reporte para el banco o impresión.</p>
     <div className="button-row">
      <a className="button" href={"/admin/planilla/"+selected.id+"/reporte"}>Reporte imprimible / PDF</a>
      <a className="button secondary" href={"/api/reportes/"+selected.id}>CSV para Excel / banco</a>
     </div>
    </Panel>}
  </>}
 </>;
}
