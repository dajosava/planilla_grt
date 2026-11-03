"use client";
import {useActionState,useEffect,useMemo,useState} from "react";
import {Search,X} from "lucide-react";
import type {ActionState} from "@/components/action-form";
import {ActionForm} from "@/components/action-form";
import {Badge} from "@/components/ui/badge";
import {ReminderDocs,type ReminderDocMeta} from "@/components/reminder-docs";
import {COMPANIES} from "@/lib/companies";
import {dateOnly} from "@/lib/format";
import {
 REMINDER_CATEGORIES,
 categoryLabel,
 daysUntilDue,
 reminderUrgency,
 urgencyLabel,
 urgencyTone,
} from "@/lib/reminders";
import {saveReminder,completeReminder,cancelReminder} from "@/app/admin/recordatorios/actions";

export type ReminderListItem={
 id:string;
 title:string;
 description:string;
 category:string;
 company:string|null;
 due_on:string;
 alert_days:number;
 reference_code:string;
 status:string;
 completed_at:string|null;
 completed_note:string;
 business_reminder_documents:ReminderDocMeta[];
};

function normalizeQuery(value:string){
 return value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
}

function daysTextFor(r:ReminderListItem){
 if(r.status!=="open")return null;
 const days=daysUntilDue(r.due_on);
 if(days<0)return `Venció hace ${Math.abs(days)} día(s)`;
 if(days===0)return "Vence hoy";
 return `Faltan ${days} día(s)`;
}

function EditReminderModal({
 reminder,onClose,
}:{
 reminder:ReminderListItem;
 onClose:()=>void;
}){
 const [state,formAction,pending]=useActionState(saveReminder,{} as ActionState);
 const isOpen=reminder.status==="open";
 const urgency=reminderUrgency(reminder);
 const daysText=daysTextFor(reminder);
 const docs=reminder.business_reminder_documents??[];

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
    aria-labelledby={`rem-edit-${reminder.id}`}
    onClick={e=>e.stopPropagation()}
   >
    <div className="modal-head">
     <div className="modal-head-copy">
      <p className="eyebrow">{isOpen?"Editar recordatorio":"Detalle del recordatorio"}</p>
      <h2 id={`rem-edit-${reminder.id}`}>{reminder.title}</h2>
      <p className="muted small" style={{margin:"4px 0 0"}}>
       {categoryLabel(reminder.category)}
       {reminder.company?` · ${reminder.company}`:""}
       {reminder.reference_code?` · ${reminder.reference_code}`:""}
       {" · "}{dateOnly(reminder.due_on)}
       {daysText?` · ${daysText}`:""}
      </p>
     </div>
     <div className="modal-head-actions">
      <Badge tone={urgencyTone(urgency)}>{urgencyLabel(urgency)}</Badge>
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

    <ReminderDocs
     reminderId={reminder.id}
     docs={docs}
     canUpload={isOpen}
    />

    {isOpen?(
     <>
      <form id={`rem-edit-form-${reminder.id}`} action={formAction} className="template-modal-form">
       <input type="hidden" name="id" value={reminder.id}/>
       <div className="form-grid modal-form-grid template-edit-form" style={{marginTop:14}}>
        <label>Título
         <input name="title" defaultValue={reminder.title} required minLength={3} maxLength={160}/>
        </label>
        <label>Categoría
         <select name="category" defaultValue={reminder.category}>
          {REMINDER_CATEGORIES.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}
         </select>
        </label>
        <label>Sociedad
         <select name="company" defaultValue={reminder.company??""}>
          <option value="">Todas / general</option>
          {COMPANIES.map(c=><option key={c}>{c}</option>)}
         </select>
        </label>
        <label>Fecha límite
         <input name="due_on" type="date" defaultValue={reminder.due_on} required/>
        </label>
        <label>Alarma temprana (días)
         <input name="alert_days" type="number" min={1} max={365} defaultValue={reminder.alert_days} required/>
        </label>
        <label>Referencia
         <input name="reference_code" defaultValue={reminder.reference_code} maxLength={80}/>
        </label>
        <label className="payroll-modal-note">Notas
         <textarea name="description" rows={3} maxLength={2000} defaultValue={reminder.description}/>
        </label>
        {(state.error||state.success)&&(
         <div className="form-footer" style={{justifyContent:"flex-start"}}>
          {state.error&&<p role="alert" className="alert error">{state.error}</p>}
          {state.success&&<p role="status" className="alert success">{state.success}</p>}
         </div>
        )}
       </div>
      </form>

      <div className="employee-modal-footer">
       <div className="employee-modal-footer-left reminder-modal-actions">
        <ActionForm action={completeReminder} submit="Marcar atendido">
         <input type="hidden" name="id" value={reminder.id}/>
         <label>Nota de cierre<input name="note" maxLength={1000} placeholder="Opcional"/></label>
        </ActionForm>
        <ActionForm action={cancelReminder} submit="Cancelar">
         <input type="hidden" name="id" value={reminder.id}/>
         <label>Motivo<input name="note" maxLength={1000} placeholder="Opcional"/></label>
        </ActionForm>
       </div>
       <div className="employee-modal-footer-right">
        <button type="button" className="secondary" onClick={onClose} disabled={pending}>Cerrar</button>
        <button type="submit" form={`rem-edit-form-${reminder.id}`} disabled={pending}>
         {pending?"Guardando…":"Guardar cambios"}
        </button>
       </div>
      </div>
     </>
    ):(
     <>
      {reminder.description?(
       <p className="muted small pre-wrap" style={{marginTop:12,textAlign:"left"}}>{reminder.description}</p>
      ):null}
      <p className="muted small" style={{marginTop:12,textAlign:"left"}}>
       {reminder.status==="done"?"Atendido":"Cancelado"}
       {reminder.completed_at?` · ${dateOnly(reminder.completed_at.slice(0,10))}`:""}
       {reminder.completed_note?` · ${reminder.completed_note}`:""}
      </p>
      <div className="employee-modal-footer">
       <div className="employee-modal-footer-right" style={{marginLeft:"auto"}}>
        <button type="button" className="secondary" onClick={onClose}>Cerrar</button>
       </div>
      </div>
     </>
    )}
   </div>
  </div>
 );
}

export function RemindersDirectory({reminders}:{reminders:ReminderListItem[]}){
 const [openId,setOpenId]=useState<string|null>(null);
 const [query,setQuery]=useState("");
 const q=normalizeQuery(query);

 const filtered=useMemo(()=>{
  if(!q)return reminders;
  return reminders.filter(r=>{
   const hay=[
    r.title,
    r.description,
    r.reference_code,
    r.company??"",
    categoryLabel(r.category),
   ].map(normalizeQuery).join(" ");
   return hay.includes(q);
  });
 },[reminders,q]);

 const selected=reminders.find(r=>r.id===openId)??null;

 return (
  <>
   <div className="directory-box">
    <div className="directory-box-head">
     <label className="directory-search">
      <Search size={16} aria-hidden="true"/>
      <input
       type="search"
       value={query}
       onChange={e=>setQuery(e.target.value)}
       placeholder="Buscar por título, categoría o referencia…"
       aria-label="Buscar recordatorio"
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
       {filtered.length}/{reminders.length}
      </span>
     ):null}
    </div>

    <div className="directory-scroll directory-scroll-in-box" style={{maxHeight:"min(480px,55vh)"}}>
     {!reminders.length?(
      <p className="muted small" style={{margin:0,padding:"12px 4px"}}>No hay recordatorios en esta vista.</p>
     ):!filtered.length?(
      <p className="muted small" style={{margin:0,padding:"12px 4px"}}>Ningún recordatorio coincide con “{query.trim()}”.</p>
     ):filtered.map(r=>{
      const urgency=reminderUrgency(r);
      const daysText=daysTextFor(r);
      const docsCount=r.business_reminder_documents?.length??0;
      return (
       <button
        key={r.id}
        type="button"
        className="employee-dir-row template-dir-row"
        onClick={()=>setOpenId(r.id)}
       >
        <span className="employee-dir-main">
         <strong>{r.title}</strong>
         <small>
          {categoryLabel(r.category)}
          {r.company?` · ${r.company}`:""}
          {r.reference_code?` · ${r.reference_code}`:""}
          {docsCount>0?` · ${docsCount} doc(s)`:""}
         </small>
        </span>
        <span className="employee-dir-meta muted small">
         {dateOnly(r.due_on)}{daysText?` · ${daysText}`:""}
        </span>
        <Badge tone={urgencyTone(urgency)}>{urgencyLabel(urgency)}</Badge>
       </button>
      );
     })}
    </div>
   </div>

   {selected&&(
    <EditReminderModal
     key={selected.id}
     reminder={selected}
     onClose={()=>setOpenId(null)}
    />
   )}
  </>
 );
}
