import Link from "next/link";
import {Gift,Users,Wallet,CheckCircle2} from "lucide-react";
import {requireRole} from "@/lib/auth";
import {Heading,Panel,CollapsiblePanel,Empty} from "@/components/admin-ui";
import {ActionForm} from "@/components/action-form";
import {KpiCard} from "@/components/ui/kpi-card";
import {Badge} from "@/components/ui/badge";
import {DeleteAguinaldo} from "@/components/delete-aguinaldo";
import {
 createAguinaldo,syncAguinaldo,updateAguinaldoItem,closeAguinaldo,deleteAguinaldo,
} from "../../actions";
import {COMPANIES,parseCompany} from "@/lib/companies";
import {money,labels,dateOnly} from "@/lib/format";
import {aguinaldoPeriod,defaultAguinaldoYear,labelAguinaldo} from "@/lib/payroll";

export default async function Page({
 searchParams,
}:{
 searchParams:Promise<{run?:string;empresa?:string}>;
}){
 const {client}=await requireRole("admin");
 const params=await searchParams;
 const company=parseCompany(params.empresa);
 const yearDefault=defaultAguinaldoYear();

 const {data:runs,error}=await client
  .from("aguinaldo_runs")
  .select("*")
  .eq("company",company)
  .order("year",{ascending:false});
 if(error)throw new Error("No se pudo cargar el aguinaldo. Aplicá la migración 202610200001_aguinaldo.sql.");

 const selected=runs?.find(r=>r.id===params.run)??runs?.[0]??null;
 const {data:items,error:itemError}=selected
  ?await client.from("aguinaldo_items").select("*").eq("run_id",selected.id).order("employee_name")
  :{data:[],error:null};
 if(itemError)throw new Error("No se pudieron cargar los ítems de aguinaldo.");

 const list=items??[];
 const count=list.length;
 const reviewed=list.filter(i=>i.reviewed).length;
 const totalGross=list.reduce((s,i)=>s+Number(i.gross_accum_cents),0);
 const totalPay=list.reduce((s,i)=>s+Number(i.payable_cents),0);
 const isDraft=selected?.status==="draft";
 const period=selected
  ?{start:selected.period_start as string,end:selected.period_end as string,year:selected.year as number}
  :aguinaldoPeriod(yearDefault);

 return <>
  <Heading
   title="Aguinaldo"
   description="Acumulación legal (1 dic → 30 nov): bruto salarial ÷ 12. Incluye base, horas extra y otros pagos (comisiones/bonos) de quincenas cerradas."
   actions={<>
    <Link className="button secondary" href="/admin/planilla">Volver a planilla</Link>
    <Link className="button secondary" href="/admin/planilla/historial">Historial de pagos</Link>
   </>}
  />

  <nav className="company-tabs" aria-label="Sociedades">
   {COMPANIES.map(c=>(
    <Link
     key={c}
     className={c===company?"active":""}
     href={`/admin/planilla/aguinaldo?empresa=${encodeURIComponent(c)}`}
    >{c}</Link>
   ))}
  </nav>

  <CollapsiblePanel title={`1 · Crear aguinaldo · ${company}`} open={!selected}>
   <p className="muted small">
    Período de <strong>{labelAguinaldo(yearDefault)}</strong>: {dateOnly(aguinaldoPeriod(yearDefault).start)} → {dateOnly(aguinaldoPeriod(yearDefault).end)}.
    Solo suma quincenas <strong>cerradas</strong> de {company}.
   </p>
   <ActionForm action={createAguinaldo} submit={`Crear aguinaldo · ${company}`}>
    <input type="hidden" name="company" value={company}/>
    <label>Año de pago (N)
     <input name="year" type="number" min={2000} max={2100} defaultValue={yearDefault} required/>
    </label>
   </ActionForm>
  </CollapsiblePanel>

  {!selected?<Empty text={`Todavía no hay corridas de aguinaldo de ${company}. Creá la primera arriba.`}/>:<>
   <div className="period-tabs" role="tablist" aria-label={`Aguinaldos de ${company}`}>
    {(runs??[]).map(r=>(
     <Link
      key={r.id}
      href={`/admin/planilla/aguinaldo?empresa=${encodeURIComponent(company)}&run=${r.id}`}
      className={r.id===selected.id?"active":""}
     >
      {labelAguinaldo(r.year)} · {labels[r.status]??r.status}
     </Link>
    ))}
   </div>

   <div className="payroll-period-banner">
    <div>
     <strong>{labelAguinaldo(selected.year)}</strong>
     <p className="muted small" style={{margin:0}}>
      {dateOnly(period.start)} → {dateOnly(period.end)} · {company} · {labels[selected.status]}
     </p>
    </div>
    {isDraft&&(
     <div className="button-row">
      <ActionForm action={syncAguinaldo} submit="Actualizar desde quincenas">
       <input type="hidden" name="id" value={selected.id}/>
      </ActionForm>
     </div>
    )}
   </div>

   <div className="stats">
    <KpiCard label="Empleados" value={String(count)} icon={<Users size={18}/>} tone="navy"/>
    <KpiCard label="Bruto acumulado" value={money(totalGross)} icon={<Wallet size={18}/>} tone="green"/>
    <KpiCard label="Total a pagar" value={money(totalPay)} icon={<Gift size={18}/>} tone="green"/>
    <KpiCard
     label="Revisados"
     value={`${reviewed}/${count}`}
     icon={<CheckCircle2 size={18}/>}
     tone={reviewed===count&&count>0?"green":"orange"}
    />
   </div>

   <Panel title="2 · Acumulación y revisión">
    <p className="muted small">
     Bruto = adelanto + extras (1.5× y doble) + otros pagos. Aguinaldo = bruto ÷ 12.
     El ajuste manual suma o resta al monto a pagar (ej. corrección puntual).
    </p>
    {count===0?(
     <Empty text="No hay empleados con quincenas cerradas en este período. Cerrá quincenas o actualizá la acumulación."/>
    ):(
     <div className="aguinaldo-list">
      {list.map(i=>{
       const adj=Number(i.adjustment_cents||0)/100;
       return (
        <details key={i.id} className="payroll-emp-edit" open={!i.reviewed&&isDraft?true:undefined}>
         <summary>
          <span className="payroll-emp-name">{i.employee_name} <small>{i.employee_code}</small></span>
          <strong className="tabular">{money(i.payable_cents)}</strong>
          <Badge tone={i.reviewed?"approved":"pending"}>{i.reviewed?"Revisado":"Pendiente"}</Badge>
         </summary>
         <div className="payroll-emp-body">
          <div className="aguinaldo-breakdown">
           <span>Ordinario <strong className="tabular">{money(i.ordinary_cents)}</strong></span>
           <span>Extras <strong className="tabular">{money(i.extras_cents)}</strong></span>
           <span>Otros pagos <strong className="tabular">{money(i.other_pay_cents)}</strong></span>
           <span>Bruto acum. <strong className="tabular">{money(i.gross_accum_cents)}</strong></span>
           <span>Aguinaldo (÷12) <strong className="tabular">{money(i.aguinaldo_cents)}</strong></span>
          </div>
          {isDraft?(
           <ActionForm action={updateAguinaldoItem} submit="Guardar">
            <input type="hidden" name="id" value={i.id}/>
            <label>Ajuste (CRC, puede ser negativo)
             <input name="adjustment" type="text" inputMode="decimal" defaultValue={adj===0?"0":String(adj)}/>
            </label>
            <label>Notas
             <textarea name="note" maxLength={2000} defaultValue={i.note??""}/>
            </label>
            <label className="checkbox">
             <input name="reviewed" type="checkbox" defaultChecked={!!i.reviewed}/>
             Marcar como revisado
            </label>
           </ActionForm>
          ):(
           <p className="muted small">
            Ajuste {money(i.adjustment_cents)}{i.note?` · ${i.note}`:""}
           </p>
          )}
         </div>
        </details>
       );
      })}
     </div>
    )}
   </Panel>

   {isDraft?(
    <CollapsiblePanel title="3 · Cerrar y pagar" open={reviewed===count&&count>0}>
     {count===0?(
      <p className="alert">No hay empleados. Actualizá desde quincenas cerradas.</p>
     ):reviewed<count?(
      <p className="alert">Faltan {count-reviewed} empleado(s) por revisar antes de cerrar.</p>
     ):(
      <p className="muted">Todo revisado. Al cerrar se bloquea el aguinaldo de {company}.</p>
     )}
     <p className="payroll-close-total">
      Total a pagar ({company}): <strong className="amount">{money(totalPay)}</strong>
     </p>
     <ActionForm action={closeAguinaldo} submit="Cerrar aguinaldo">
      <input type="hidden" name="id" value={selected.id}/>
     </ActionForm>
     <div className="button-row" style={{marginTop:14}}>
      <DeleteAguinaldo
       id={selected.id}
       company={company}
       yearLabel={labelAguinaldo(selected.year)}
       status={selected.status}
       action={deleteAguinaldo}
      />
     </div>
    </CollapsiblePanel>
   ):(
    <Panel title="3 · Pago">
     <p className="muted">
      Aguinaldo de {company} cerrado el {selected.closed_at?dateOnly(String(selected.closed_at).slice(0,10)):""}.
      Total depositado / a depositar: <strong>{money(totalPay)}</strong>.
     </p>
     <div className="button-row">
      <DeleteAguinaldo
       id={selected.id}
       company={company}
       yearLabel={labelAguinaldo(selected.year)}
       status={selected.status}
       action={deleteAguinaldo}
      />
     </div>
    </Panel>
   )}
  </>}
 </>;
}
