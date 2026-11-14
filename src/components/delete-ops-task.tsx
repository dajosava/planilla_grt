"use client";
import {useActionState,useEffect,useState} from "react";
import {createPortal} from "react-dom";
import {Trash2,TriangleAlert} from "lucide-react";
import type {ActionState} from "./action-form";

type Props={
 id:string;
 title:string;
 runDateLabel:string;
 action:(state:ActionState,form:FormData)=>Promise<ActionState>;
};

export function DeleteOpsTask({id,title,runDateLabel,action}:Props){
 const [state,formAction,pending]=useActionState(action,{});
 const [open,setOpen]=useState(false);
 const [reason,setReason]=useState("");
 const reset=()=>{setOpen(false);setReason("")};
 const close=()=>{if(!pending)reset()};

 useEffect(()=>{
  if(!open)return;
  const onKey=(e:KeyboardEvent)=>{if(e.key==="Escape"&&!pending)reset()};
  window.addEventListener("keydown",onKey);
  return ()=>window.removeEventListener("keydown",onKey);
 },[open,pending]);

 useEffect(()=>{
  if(state.success)reset();
 },[state.success]);

 const dialog=open?createPortal(
  <div className="modal-backdrop" onClick={close} style={{zIndex:60}}>
   <div
    className="modal"
    role="alertdialog"
    aria-modal="true"
    aria-labelledby={`del-task-${id}`}
    onClick={e=>e.stopPropagation()}
   >
    <TriangleAlert size={48} className="modal-danger-icon"/>
    <h2 id={`del-task-${id}`}>Eliminar tarea</h2>
    <p><strong>{title}</strong></p>
    <p className="muted small">Fecha: {runDateLabel}</p>
    <p>Se borrará la tarea, su checklist y evidencias. Si venía de una plantilla, podés volver a generarla después.</p>
    <p className="muted small">Quedará constancia en Auditoría.</p>
    <form action={formAction} className="form-grid" style={{textAlign:"left"}}>
     <input type="hidden" name="id" value={id}/>
     <label>Motivo
      <input
       name="reason"
       value={reason}
       onChange={e=>setReason(e.target.value)}
       minLength={5}
       maxLength={500}
       required
       autoComplete="off"
       autoFocus
       disabled={pending}
       placeholder="Ej. Asignada por error"
      />
     </label>
     {state.error&&<p role="alert" className="alert error">{state.error}</p>}
     <div className="modal-actions">
      <button type="button" className="secondary" onClick={close} disabled={pending}>Cancelar</button>
      <button className="danger-solid" disabled={pending||reason.trim().length<5}>
       <Trash2 size={15}/>{pending?"Eliminando…":"Eliminar tarea"}
      </button>
     </div>
    </form>
   </div>
  </div>,
  document.body
 ):null;

 return <>
  <button type="button" className="danger small-button punch-delete-btn" onClick={()=>setOpen(true)} title="Eliminar tarea">
   <Trash2 size={11}/>Borrar
  </button>
  {dialog}
 </>;
}
