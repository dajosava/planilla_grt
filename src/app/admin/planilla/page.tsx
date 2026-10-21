import Link from "next/link";
import {Users,Wallet,Shield,Receipt,CheckCircle2,AlarmClock} from "lucide-react";
import {requireRole} from "@/lib/auth";
import {Heading,Panel,CollapsiblePanel,Table,Empty} from "@/components/admin-ui";
import {ActionForm} from "@/components/action-form";
import {KpiCard} from "@/components/ui/kpi-card";
import {Badge} from "@/components/ui/badge";
import {PayrollFlow,payrollActiveIndex} from "@/components/payroll-flow";
import {createPayroll,updatePayroll,closePayroll,deletePayroll,syncPayrollOt,approvePayrollOt,rejectPayrollOt} from "../actions";
import {DeletePayroll} from "@/components/delete-payroll";
import {COMPANIES,parseCompany} from "@/lib/companies";
import {money,labels,todayCR,dateOnly} from "@/lib/format";
import {labelFortnight} from "@/lib/payroll";

function periodLabel(run:{period_start:string;period_end:string;kind?:string|null;status:string}){
 if(run.kind==="fortnight")return `${labelFortnight(run.period_start,run.period_end)} · ${labels[run.status]}`;
 return `${run.period_start.slice(0,7)} · ${labels[run.status]}`;
}

type OtDay={work_date:string;worked_hours:number;ot_hours:number};

export default async function Page({searchParams}:{searchParams:Promise<{run?:string;empresa?:string}>}){
 const {client}=await requireRole("admin");
 const params=await searchParams;
 const company=parseCompany(params.empresa);
 const {data:runs,error}=await client.from("payroll_runs").select("*").eq("company",company).order("period_start",{ascending:false});
 if(error)throw new Error("No se pudo cargar la planilla");
 const selected=runs?.find(r=>r.id===params.run)??runs?.[0];
 const {data:items,error:itemError}=selected
  ?await client.from("payroll_items").select("*,payroll_ot_days(work_date,worked_hours,ot_hours)").eq("run_id",selected.id).order("employee_name")
  :{data:[],error:null};
 if(itemError)throw new Error("No se pudieron cargar los conceptos. Si acabás de migrar OT, recargá la página.");

 const list=items??[];
 const count=list.length;
 const reviewed=list.filter(i=>i.reviewed).length;
 const reviewPct=count?Math.round(reviewed*100/count):0;
 const totalNet=list.reduce((s,i)=>s+Number(i.net_cents),0);
 const totalAdvance=list.reduce((s,i)=>s+Number(i.base_cents),0);
 const totalExtras=list.reduce((s,i)=>s+Number(i.ot_amount_cents??0)+Number(i.double_amount_cents??0)+Number(i.other_pay_cents??0),0);
 const totalCcss=list.reduce((s,i)=>s+Number(i.ccss_cents??0),0);
 const totalOtherDed=list.reduce((s,i)=>s+Number(i.shortage_cents??0)+Number(i.receipt_cents??0)+Number(i.other_deduction_cents??0),0);
 const pendingOt=list.filter(i=>i.ot_status==="pending");
 const pendingOtHours=pendingOt.reduce((s,i)=>s+Number(i.suggested_ot_hours??0),0);
 const hasExtras=totalExtras>0||pendingOt.length>0;
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
   description="Tres planillas separadas: Gasolinera, Supermercado y Transporte. Horas >8/día se proponen como extras para tu aprobación."
   actions={<>
    <Link className="button secondary" href="/admin/planilla/aguinaldo">Aguinaldo</Link>
    <Link className="button secondary" href="/admin/planilla/historial">Historial de pagos</Link>
    <Link className="button secondary" href="/admin/empleados">Ver empleados</Link>
   </>}
  />

  <nav className="company-tabs" aria-label="Sociedades">
   {COMPANIES.map(c=>(
    <Link key={c} className={c===company?"active":""} href={`/admin/planilla?empresa=${encodeURIComponent(c)}`}>{c}</Link>
   ))}
  </nav>

  <PayrollFlow activeIndex={activeIndex}/>

  <CollapsiblePanel title={`1 · Crear quincena · ${company}`} open={!selected}>
   <p className="muted small">Solo incluye empleados activos de <strong>{company}</strong>. Adelanto = salario/2 y CCSS 10.83%. Las horas extra se calculan desde asistencia y quedan pendientes de aprobar.</p>
   <ActionForm action={createPayroll} submit={`Crear quincena · ${company}`}>
    <input type="hidden" name="company" value={company}/>
    <label>Mes<input name="month" type="month" defaultValue={todayCR().slice(0,7)} required/></label>
    <label>Quincena<select name="half" defaultValue={Number(todayCR().slice(8,10))<=15?"1":"2"} required>
     <option value="1">1ª quincena (1–15)</option>
     <option value="2">2ª quincena (16–fin de mes)</option>
    </select></label>
   </ActionForm>
  </CollapsiblePanel>

  {!selected?<Empty text={`Todavía no hay quincenas de ${company}. Creá la primera arriba.`}/>:<>
   <div className="period-tabs" role="tablist" aria-label={`Quincenas de ${company}`}>
    {runs?.map(r=><Link key={r.id} className={r.id===selected.id?"active":""} href={`/admin/planilla?empresa=${encodeURIComponent(company)}&run=${r.id}`}>{periodLabel(r)}</Link>)}
   </div>

   <p className="payroll-period-banner">
    <strong>{company} · {labelFortnight(selected.period_start,selected.period_end)}</strong>
    <Badge tone={isClosed?"approved":"pending"}>{labels[selected.status]}</Badge>
   </p>

   {isDraft&&pendingOt.length>0&&(
    <div className="alert error" role="alert">
     <strong>⚠ Horas extra pendientes de aprobar:</strong>{" "}
     {pendingOt.length} empleado(s) · {pendingOtHours.toFixed(2)} h sugeridas desde asistencia (&gt;8 h/día).
     No podés cerrar la quincena hasta aprobarlas o rechazarlas.
    </div>
   )}

   <div className="stats">
    <KpiCard
     label="Empleados en nómina" value={count} tone="navy" icon={<Users size={18}/>}
     sub={<>{reviewed} de {count} revisados · {reviewPct}%</>}
     progress={reviewPct}
    />
    <KpiCard
     label="Extras por aprobar" value={pendingOt.length} tone={pendingOt.length?"danger":"navy"} icon={<AlarmClock size={18}/>}
     sub={pendingOt.length?`${pendingOtHours.toFixed(2)} h sugeridas`:"Sin pendientes"}
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
       const otPending=i.ot_status==="pending";
       return <tr key={i.id}>
        <td><strong>{i.employee_name}</strong><small>{i.employee_code} · {money(i.hourly_rate_cents??0)}/h{otPending?` · ${Number(i.suggested_ot_hours).toFixed(2)} h extra por aprobar`:""}</small></td>
        <td>{money(i.base_cents)}</td>
        <td>{money(extras)}{otPending?<small className="text-danger"> pendiente</small>:null}</td>
        <td>{money(i.ccss_cents??0)}{i.exempt_from_ccss?<small> exento</small>:null}</td>
        <td>{money(otherDed)}</td>
        <td><strong className="tabular">{money(i.net_cents)}</strong></td>
        <td>
         {otPending?<Badge tone="danger">Extra por aprobar</Badge>:
          <Badge tone={i.reviewed?"approved":"pending"}>{i.reviewed?"Revisado":"Pendiente"}</Badge>}
        </td>
       </tr>;
      })}
     </Table>
    )}
   </Panel>

   {isDraft?<>
    <CollapsiblePanel title="3 · Capturar extras y deducciones" open>
     <div className="button-row button-row-hint" style={{marginBottom:14}}>
      <ActionForm action={syncPayrollOt} submit="Actualizar extras desde asistencia">
       <input type="hidden" name="id" value={selected.id}/>
      </ActionForm>
      <p className="muted small">Suma jornadas cerradas del período; lo que pase de 8 h/día se propone como hora extra (1.5×) para tu aprobación.</p>
     </div>

     {list.map(i=>{
      const days=((i.payroll_ot_days??[]) as OtDay[]).slice().sort((a,b)=>a.work_date.localeCompare(b.work_date));
      const otPending=i.ot_status==="pending";
      const otApproved=i.ot_status==="approved";
      const otRejected=i.ot_status==="rejected";
      return <details key={i.id} className={`payroll-emp-edit${otPending?" ot-pending":""}`} open={otPending||undefined}>
       <summary>
        <span className="payroll-emp-name">{i.employee_name}</span>
        <strong className="tabular">{money(i.net_cents)}</strong>
        {otPending?<Badge tone="danger">Extra {Number(i.suggested_ot_hours).toFixed(2)} h</Badge>:
         otApproved?<Badge tone="approved">OT aprobadas</Badge>:
         otRejected?<Badge tone="pending">OT rechazadas</Badge>:
         <Badge tone={i.reviewed?"approved":"pending"}>{i.reviewed?"✓":"…"}</Badge>}
       </summary>
       <div className="payroll-emp-body">
        <p className="muted small">Adelanto {money(i.base_cents)} · Valor hora {money(i.hourly_rate_cents??0)}{i.exempt_from_ccss?" · Exento CCSS":""}</p>

        {otPending&&(
         <div className="alert" role="status">
          <strong>Sugerido desde asistencia:</strong> {Number(i.suggested_ot_hours).toFixed(2)} h extra
          {days.length>0&&(
           <ul className="ot-day-list">
            {days.map(d=>(
             <li key={d.work_date}>{dateOnly(d.work_date)}: trabajó {Number(d.worked_hours).toFixed(2)} h → extra {Number(d.ot_hours).toFixed(2)} h</li>
            ))}
           </ul>
          )}
          <div className="row-actions" style={{marginTop:10}}>
           <ActionForm action={approvePayrollOt} submit={`Aprobar ${Number(i.suggested_ot_hours).toFixed(2)} h`}>
            <input type="hidden" name="id" value={i.id}/>
           </ActionForm>
           <ActionForm action={approvePayrollOt} submit="Aprobar con ajuste">
            <input type="hidden" name="id" value={i.id}/>
            <label>Horas a pagar<input name="hours" type="number" min="0" max="400" step="0.01" defaultValue={Number(i.suggested_ot_hours)} required/></label>
           </ActionForm>
           <ActionForm action={rejectPayrollOt} submit="Rechazar extras">
            <input type="hidden" name="id" value={i.id}/>
           </ActionForm>
          </div>
         </div>
        )}

        {(otApproved||otRejected)&&days.length>0&&(
         <p className="muted small">Detalle asistencia: {days.map(d=>`${dateOnly(d.work_date)} ${Number(d.ot_hours).toFixed(2)}h`).join(" · ")}</p>
        )}

        <ActionForm action={updatePayroll}>
         <input name="id" type="hidden" value={i.id}/>
         <label>Horas extra (1.5×)<input name="ot_hours" type="number" min="0" max="400" step="0.01" defaultValue={Number(i.ot_hours??0)}/><small className="muted">Si las editás manualmente se consideran aprobadas.</small></label>
         <label>Horas doble (2×)<input name="double_hours" type="number" min="0" max="400" step="0.01" defaultValue={Number(i.double_hours??0)}/></label>
         <label>Otros pagos (CRC)<input name="other_pay" type="number" min="0" step="0.01" defaultValue={(Number(i.other_pay_cents??0))/100}/></label>
         <label>Faltantes pista (CRC)<input name="shortage" type="number" min="0" step="0.01" defaultValue={(Number(i.shortage_cents??0))/100}/></label>
         <label>Facturas / recibos (CRC)<input name="receipt" type="number" min="0" step="0.01" defaultValue={(Number(i.receipt_cents??0))/100}/></label>
         <label>Otras deducciones (CRC)<input name="other_deduction" type="number" min="0" step="0.01" defaultValue={(Number(i.other_deduction_cents??0))/100}/></label>
         <label>Notas<textarea name="note" maxLength={2000} defaultValue={i.note??""}/></label>
         <label className="checkbox"><input name="reviewed" type="checkbox" defaultChecked={!!i.reviewed}/>Marcar como revisado</label>
        </ActionForm>
       </div>
      </details>;
     })}
    </CollapsiblePanel>

    <CollapsiblePanel title="4 · Cerrar y pagar" open={reviewed===count&&count>0&&pendingOt.length===0}>
     {pendingOt.length>0?(
      <p className="alert error">Hay {pendingOt.length} empleado(s) con horas extra pendientes de aprobar.</p>
     ):reviewed<count?(
      <p className="alert">Faltan {count-reviewed} empleado(s) por revisar antes de cerrar.</p>
     ):(
      <p className="muted">Todo revisado. Al cerrar se bloquea la quincena de {company} y podés descargar el reporte.</p>
     )}
     <p className="payroll-close-total">Neto a depositar ({company}): <strong className="amount">{money(totalNet)}</strong></p>
     <ActionForm action={closePayroll} submit="Cerrar quincena y habilitar pago">
      <input type="hidden" name="id" value={selected.id}/>
     </ActionForm>
     <div className="button-row" style={{marginTop:14}}>
      <DeletePayroll
       id={selected.id}
       company={company}
       periodLabel={labelFortnight(selected.period_start,selected.period_end)}
       status={selected.status}
       action={deletePayroll}
      />
     </div>
    </CollapsiblePanel>
   </>:
    <Panel title="5 · Pago y comprobantes">
     <p className="muted">Quincena de {company} cerrada. Descargá el reporte para el banco o impresión. Si el cierre fue un error, podés eliminarla y volver a crear la quincena.</p>
     <div className="button-row">
      <a className="button" href={"/admin/planilla/"+selected.id+"/reporte"}>Reporte imprimible / PDF</a>
      <a className="button secondary" href={"/api/reportes/"+selected.id}>CSV para Excel / banco</a>
      <DeletePayroll
       id={selected.id}
       company={company}
       periodLabel={labelFortnight(selected.period_start,selected.period_end)}
       status={selected.status}
       action={deletePayroll}
      />
     </div>
    </Panel>}
  </>}
 </>;
}
