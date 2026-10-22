"use client";
import {useActionState,useEffect,useState} from "react";
import {X} from "lucide-react";
import type {ActionState} from "@/components/action-form";
import {ChecklistEditor,type ChecklistDraftItem} from "@/components/checklist-editor";
import {Badge} from "@/components/ui/badge";
import {OPS_AREAS} from "@/lib/ops-areas";
import {saveTemplate} from "@/app/admin/ops-actions";

export type TemplateListItem={
 id:string;
 title:string;
 area:string;
 recurrence:string;
 due_offset_minutes:number;
 active:boolean;
 assignee:null|{id:string;full_name:string;code:string};
 items:ChecklistDraftItem[];
};

type Emp={id:string;full_name:string;code:string};

const recurrenceLabel:Record<string,string>={
 daily:"Diaria",
 weekdays:"Lunes a viernes",
 once:"Una sola vez",
};

function AssigneeSelect({employees,defaultValue}:{employees:Emp[];defaultValue?:string|null}){
 return (
  <label>Asignar por defecto a
   <select name="assignee" defaultValue={defaultValue??""}>
    <option value="">Sin asignar (asignar después en Tareas)</option>
    {employees.map(e=><option key={e.id} value={e.id}>{e.full_name} ({e.code})</option>)}
   </select>
  </label>
 );
}

function EditTemplateModal({
 template,employees,onClose,
}:{
 template:TemplateListItem;
 employees:Emp[];
 onClose:()=>void;
}){
 const [state,formAction,pending]=useActionState(saveTemplate,{} as ActionState);

 useEffect(()=>{
  if(state.success){
   const t=window.setTimeout(onClose,600);
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
    aria-labelledby={`tpl-edit-${template.id}`}
    onClick={e=>e.stopPropagation()}
   >
    <form action={formAction} className="template-modal-form">
     <input type="hidden" name="id" value={template.id}/>
     <div className="modal-head">
      <div className="modal-head-copy">
       <p className="eyebrow">Editar plantilla</p>
       <h2 id={`tpl-edit-${template.id}`}>{template.title}</h2>
      </div>
      <div className="modal-head-actions">
       <label className="template-active-check template-active-check-header">
        <input type="checkbox" name="active" defaultChecked={template.active}/>
        <span>Activa</span>
       </label>
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

     <div className="form-grid modal-form-grid template-edit-form">
      <label>Título<input name="title" defaultValue={template.title} required minLength={3} maxLength={120}/></label>
      <label>Área
       <select name="area" defaultValue={template.area}>
        {OPS_AREAS.map(a=><option key={a}>{a}</option>)}
       </select>
      </label>
      <label>Recurrencia
       <select name="recurrence" defaultValue={template.recurrence}>
        <option value="daily">Diaria</option>
        <option value="weekdays">Lunes a viernes</option>
        <option value="once">Una sola vez</option>
       </select>
      </label>
      <label className="template-due-label">Vence (minutos)
       <input name="due_offset_minutes" type="number" defaultValue={template.due_offset_minutes} min={5} max={1440} required/>
      </label>
      <div className="template-assignee-full">
       <AssigneeSelect employees={employees} defaultValue={template.assignee?.id}/>
      </div>
      <ChecklistEditor
       key={template.id}
       initial={template.items.length?template.items:[{label:"",requires_photo:false,for_bitacora:false}]}
      />
      <div className="form-footer">
       {state.error&&<p role="alert" className="alert error">{state.error}</p>}
       {state.success&&<p role="status" className="alert success">{state.success}</p>}
       <button type="button" className="secondary" onClick={onClose} disabled={pending}>Cancelar</button>
       <button disabled={pending}>{pending?"Guardando…":"Guardar cambios"}</button>
      </div>
     </div>
    </form>
   </div>
  </div>
 );
}

export function TemplatesDirectory({
 templates,employees,
}:{
 templates:TemplateListItem[];
 employees:Emp[];
}){
 const [openId,setOpenId]=useState<string|null>(null);
 const selected=templates.find(t=>t.id===openId)??null;

 return (
  <>
   <p className="muted small">Tocá una plantilla para verla y editarla en un modal.</p>
   <div className="directory-scroll">
    {templates.map(t=>(
     <button
      key={t.id}
      type="button"
      className="employee-dir-row template-dir-row"
      onClick={()=>setOpenId(t.id)}
     >
      <span className="employee-dir-main">
       <strong>{t.title}</strong>
       <small>
        {t.area} · {recurrenceLabel[t.recurrence]??t.recurrence} · {t.items.length} ítem{t.items.length===1?"":"s"}
       </small>
      </span>
      <span className="employee-dir-meta muted small">
       {t.assignee?`${t.assignee.full_name} (${t.assignee.code})`:"Sin asignar"}
      </span>
      <Badge tone={t.active?"approved":"pending"}>{t.active?"Activa":"Inactiva"}</Badge>
     </button>
    ))}
   </div>

   {selected&&(
    <EditTemplateModal
     key={selected.id}
     template={selected}
     employees={employees}
     onClose={()=>setOpenId(null)}
    />
   )}
  </>
 );
}

/** Re-export for create form on the same page (keeps AssigneeSelect private). */
export function TemplateCreateFields({employees}:{employees:Emp[]}){
 return (
  <div className="template-edit-form contents">
   <label>Título<input name="title" required minLength={3} maxLength={120} placeholder="Apertura de estación"/></label>
   <label>Área<select name="area">{OPS_AREAS.map(a=><option key={a}>{a}</option>)}</select></label>
   <label>Recurrencia
    <select name="recurrence">
     <option value="daily">Diaria</option>
     <option value="weekdays">Lunes a viernes</option>
     <option value="once">Una sola vez</option>
    </select>
   </label>
   <label className="template-due-label">Vence (minutos desde medianoche CR)
    <input name="due_offset_minutes" type="number" defaultValue={90} min={5} max={1440} required/>
   </label>
   <div className="template-assignee-full">
    <AssigneeSelect employees={employees}/>
   </div>
   <label className="template-active-check">
    <input type="checkbox" name="active" defaultChecked/>
    <span>Activa</span>
   </label>
   <ChecklistEditor/>
  </div>
 );
}
