"use client";
import {useActionState,useEffect,useMemo,useState} from "react";
import {Search,X} from "lucide-react";
import type {ActionState} from "@/components/action-form";
import {ActionForm} from "@/components/action-form";
import {Badge} from "@/components/ui/badge";
import {money,dateOnly} from "@/lib/format";
import {
 updatePayroll,syncPayrollOt,approvePayrollOt,rejectPayrollOt,
} from "@/app/admin/actions";

export type PayrollOtDay={work_date:string;worked_hours:number;ot_hours:number};

export type PayrollListItem={
 id:string;
 employee_name:string;
 employee_code:string;
 base_cents:number;
 hourly_rate_cents:number|null;
 ot_hours:number|null;
 ot_amount_cents:number|null;
 double_hours:number|null;
 double_amount_cents:number|null;
 other_pay_cents:number|null;
 ccss_cents:number|null;
 shortage_cents:number|null;
 receipt_cents:number|null;
 other_deduction_cents:number|null;
 net_cents:number;
 note:string|null;
 reviewed:boolean;
 exempt_from_ccss:boolean;
 ot_status:string|null;
 suggested_ot_hours:number|null;
 payroll_ot_days:PayrollOtDay[]|null;
};

function normalizeQuery(value:string){
 return value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
}

function extrasCents(i:PayrollListItem){
 return Number(i.ot_amount_cents??0)+Number(i.double_amount_cents??0)+Number(i.other_pay_cents??0);
}

function otherDedCents(i:PayrollListItem){
 return Number(i.shortage_cents??0)+Number(i.receipt_cents??0)+Number(i.other_deduction_cents??0);
}

function StatusBadge({item}:{item:PayrollListItem}){
 if(item.ot_status==="pending"){
  return <Badge tone="danger">Extra {Number(item.suggested_ot_hours??0).toFixed(2)} h</Badge>;
 }
 if(item.ot_status==="approved")return <Badge tone="approved">OT aprobadas</Badge>;
 if(item.ot_status==="rejected")return <Badge tone="pending">OT rechazadas</Badge>;
 return <Badge tone={item.reviewed?"approved":"pending"}>{item.reviewed?"Revisado":"Pendiente"}</Badge>;
}

function EditPayrollItemModal({
 item,isDraft,onClose,
}:{
 item:PayrollListItem;
 isDraft:boolean;
 onClose:()=>void;
}){
 const [state,formAction,pending]=useActionState(updatePayroll,{} as ActionState);
 const days=(item.payroll_ot_days??[]).slice().sort((a,b)=>a.work_date.localeCompare(b.work_date));
 const otPending=item.ot_status==="pending";
 const otApproved=item.ot_status==="approved";
 const otRejected=item.ot_status==="rejected";
 const extras=extrasCents(item);
 const otherDed=otherDedCents(item);

 useEffect(()=>{
  if(state.success){
   const t=window.setTimeout(onClose,700);
   return ()=>window.clearTimeout(t);
  }
 },[state.success,onClose]);

 useEffect(()=>{
  const onKey=(e:KeyboardEvent)=>{if(e.key==="Escape"&&!pending)onClose()};
  window.addEventListener("keydown",onKey);
  return ()=>window.removeEventListener("keydown",onKey);
 },[onClose,pending]);

 return (
  <div className="modal-backdrop" onClick={()=>{if(!pending)onClose()}}>
   <div
    className="modal modal-lg"
    role="dialog"
    aria-modal="true"
    aria-labelledby={`pay-edit-${item.id}`}
    onClick={e=>e.stopPropagation()}
   >
    <div className="modal-head">
     <div className="modal-head-copy">
      <p className="eyebrow">{isDraft?"Extras y deducciones":"Detalle de nómina"}</p>
      <h2 id={`pay-edit-${item.id}`}>{item.employee_name}</h2>
      <p className="muted small" style={{margin:"4px 0 0"}}>
       {item.employee_code} · Adelanto {money(item.base_cents)} · Valor hora {money(item.hourly_rate_cents??0)}
       {item.exempt_from_ccss?" · Exento CCSS":""}
      </p>
     </div>
     <div className="modal-head-actions">
      <StatusBadge item={item}/>
      <button
       type="button"
       className="btn-icon secondary"
       onClick={onClose}
       disabled={pending}
       aria-label="Cerrar"
      >
       <X size={18}/>
      </button>
     </div>
    </div>

    <div className="payroll-modal-summary">
     <div><span className="muted small">Extras</span><strong className="tabular">{money(extras)}</strong></div>
     <div><span className="muted small">CCSS</span><strong className="tabular">{money(item.ccss_cents??0)}</strong></div>
     <div><span className="muted small">Otras ded.</span><strong className="tabular">{money(otherDed)}</strong></div>
     <div><span className="muted small">Neto</span><strong className="tabular">{money(item.net_cents)}</strong></div>
    </div>

    {otPending&&isDraft&&(
     <div className="alert" role="status" style={{marginTop:14,textAlign:"left"}}>
      <strong>Sugerido desde asistencia:</strong> {Number(item.suggested_ot_hours??0).toFixed(2)} h extra
      {days.length>0&&(
       <ul className="ot-day-list">
        {days.map(d=>(
         <li key={d.work_date}>
          {dateOnly(d.work_date)}: trabajó {Number(d.worked_hours).toFixed(2)} h → extra {Number(d.ot_hours).toFixed(2)} h
         </li>
        ))}
       </ul>
      )}
      <div className="row-actions payroll-modal-ot-actions">
       <ActionForm action={approvePayrollOt} submit={`Aprobar ${Number(item.suggested_ot_hours??0).toFixed(2)} h`}>
        <input type="hidden" name="id" value={item.id}/>
       </ActionForm>
       <ActionForm action={approvePayrollOt} submit="Aprobar con ajuste">
        <input type="hidden" name="id" value={item.id}/>
        <label>Horas a pagar
         <input name="hours" type="number" min="0" max="400" step="0.01" defaultValue={Number(item.suggested_ot_hours??0)} required/>
        </label>
       </ActionForm>
       <ActionForm action={rejectPayrollOt} submit="Rechazar extras">
        <input type="hidden" name="id" value={item.id}/>
       </ActionForm>
      </div>
     </div>
    )}

    {(otApproved||otRejected)&&days.length>0&&(
     <p className="muted small" style={{marginTop:12,textAlign:"left"}}>
      Detalle asistencia: {days.map(d=>`${dateOnly(d.work_date)} ${Number(d.ot_hours).toFixed(2)}h`).join(" · ")}
     </p>
    )}

    {isDraft?(
     <form
      id={`pay-edit-form-${item.id}`}
      action={formAction}
      className="template-modal-form"
      key={`${item.id}-${item.ot_status}-${item.net_cents}`}
     >
      <input type="hidden" name="id" value={item.id}/>
      <div className="form-grid modal-form-grid template-edit-form" style={{marginTop:14}}>
       <label>Horas extra (1.5×)
        <input name="ot_hours" type="number" min="0" max="400" step="0.01" defaultValue={Number(item.ot_hours??0)}/>
        <small className="muted">Si las editás manualmente se consideran aprobadas.</small>
       </label>
       <label>Horas doble (2×)
        <input name="double_hours" type="number" min="0" max="400" step="0.01" defaultValue={Number(item.double_hours??0)}/>
       </label>
       <label>Otros pagos (CRC)
        <input name="other_pay" type="number" min="0" step="0.01" defaultValue={(Number(item.other_pay_cents??0))/100}/>
       </label>
       <label>Faltantes pista (CRC)
        <input name="shortage" type="number" min="0" step="0.01" defaultValue={(Number(item.shortage_cents??0))/100}/>
       </label>
       <label>Facturas / recibos (CRC)
        <input name="receipt" type="number" min="0" step="0.01" defaultValue={(Number(item.receipt_cents??0))/100}/>
       </label>
       <label>Otras deducciones (CRC)
        <input name="other_deduction" type="number" min="0" step="0.01" defaultValue={(Number(item.other_deduction_cents??0))/100}/>
       </label>
       <label className="payroll-modal-note">Notas
        <textarea name="note" maxLength={2000} defaultValue={item.note??""}/>
       </label>
       <label className="template-active-check" style={{alignSelf:"center"}}>
        <input name="reviewed" type="checkbox" defaultChecked={!!item.reviewed}/>
        <span>Marcar como revisado</span>
       </label>
       {(state.error||state.success)&&(
        <div className="form-footer" style={{justifyContent:"flex-start"}}>
         {state.error&&<p role="alert" className="alert error">{state.error}</p>}
         {state.success&&<p role="status" className="alert success">{state.success}</p>}
        </div>
       )}
      </div>
     </form>
    ):item.note?(
     <p className="muted small" style={{marginTop:12,textAlign:"left"}}>Nota: {item.note}</p>
    ):null}

    <div className="employee-modal-footer">
     <div className="employee-modal-footer-right" style={{marginLeft:"auto"}}>
      <button type="button" className="secondary" onClick={onClose} disabled={pending}>
       {isDraft?"Cancelar":"Cerrar"}
      </button>
      {isDraft&&(
       <button type="submit" form={`pay-edit-form-${item.id}`} disabled={pending}>
        {pending?"Guardando…":"Guardar cambios"}
       </button>
      )}
     </div>
    </div>
   </div>
  </div>
 );
}

export function PayrollItemsDirectory({
 items,isDraft,runId,
}:{
 items:PayrollListItem[];
 isDraft:boolean;
 runId:string;
}){
 const [openId,setOpenId]=useState<string|null>(null);
 const [query,setQuery]=useState("");
 const q=normalizeQuery(query);

 const filtered=useMemo(()=>{
  if(!q)return items;
  return items.filter(i=>{
   const name=normalizeQuery(i.employee_name);
   const code=normalizeQuery(i.employee_code);
   return name.includes(q)||code.includes(q);
  });
 },[items,q]);

 const selected=items.find(i=>i.id===openId)??null;

 return (
  <>
   {isDraft&&(
    <div className="button-row button-row-hint" style={{marginBottom:14}}>
     <ActionForm action={syncPayrollOt} submit="Actualizar extras desde asistencia">
      <input type="hidden" name="id" value={runId}/>
     </ActionForm>
     <p className="muted small">
      Tocá un empleado para capturar extras y deducciones. Las horas &gt;8/día se proponen desde asistencia.
     </p>
    </div>
   )}

   <div className="directory-box">
    <div className="directory-box-head">
     <label className="directory-search">
      <Search size={16} aria-hidden="true"/>
      <input
       type="search"
       value={query}
       onChange={e=>setQuery(e.target.value)}
       placeholder="Buscar por nombre o N.º…"
       aria-label="Buscar empleado en la quincena"
       autoComplete="off"
      />
      {query?(
       <button
        type="button"
        className="directory-search-clear"
        onClick={()=>setQuery("")}
        aria-label="Limpiar búsqueda"
       >
        <X size={14}/>
       </button>
      ):null}
     </label>
     {q?(
      <span className="muted small directory-search-meta">
       {filtered.length}/{items.length}
      </span>
     ):null}
    </div>

    <div className="directory-scroll directory-scroll-in-box">
     {!items.length?(
      <p className="muted small" style={{margin:0,padding:"12px 4px"}}>Sin empleados en esta quincena.</p>
     ):!filtered.length?(
      <p className="muted small" style={{margin:0,padding:"12px 4px"}}>Ningún empleado coincide con “{query.trim()}”.</p>
     ):filtered.map(i=>{
      const extras=extrasCents(i);
      const otherDed=otherDedCents(i);
      const otPending=i.ot_status==="pending";
      return (
       <button
        key={i.id}
        type="button"
        className={`employee-dir-row template-dir-row employee-dir-row-compact payroll-dir-row${otPending?" ot-pending":""}`}
        onClick={()=>setOpenId(i.id)}
       >
        <span className="employee-dir-main">
         <strong>{i.employee_name}</strong>
         <small>· N.º {i.employee_code}</small>
        </span>
        <span className="employee-dir-meta muted small payroll-dir-meta">
         Extras {money(extras)} · Ded {money(otherDed)} · Neto {money(i.net_cents)}
        </span>
        <StatusBadge item={i}/>
       </button>
      );
     })}
    </div>
   </div>

   {selected&&(
    <EditPayrollItemModal
     key={selected.id}
     item={selected}
     isDraft={isDraft}
     onClose={()=>setOpenId(null)}
    />
   )}
  </>
 );
}
