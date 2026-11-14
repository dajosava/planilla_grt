"use client";
import {useActionState,useEffect,useState} from "react";
import {Trash2,TriangleAlert} from "lucide-react";
import type {ActionState} from "./action-form";

type Mode="entry"|"exit";

type Props={
 sessionId:string;
 employeeLabel:string;
 timeLabel:string;
 mode:Mode;
 action:(state:ActionState,form:FormData)=>Promise<ActionState>;
};

const copy:Record<Mode,{btn:string;title:string;body:string;confirm:string;scope:"session"|"exit"}>={
 entry:{
  btn:"Borrar entrada",
  title:"Borrar marca de entrada",
  body:"Se elimina toda la jornada (entrada, descansos, salida y fotos). El empleado podrá marcar de nuevo.",
  confirm:"Borrar entrada",
  scope:"session",
 },
 exit:{
  btn:"Borrar salida",
  title:"Borrar marca de salida",
  body:"Solo se quita la salida. La entrada se conserva y la jornada queda abierta para marcar otra vez.",
  confirm:"Borrar salida",
  scope:"exit",
 },
};

export function DeleteAttendance({sessionId,employeeLabel,timeLabel,mode,action}:Props){
 const meta=copy[mode];
 const [state,formAction,pending]=useActionState(action,{});
 const [open,setOpen]=useState(false);
 const [reason,setReason]=useState("");
 const reset=()=>{setOpen(false);setReason("")};
 const close=()=>{if(!pending)reset()};

 useEffect(()=>{
  if(!open)return;
  const onKey=(e:KeyboardEvent)=>{if(e.key==="Escape"&&!pending)reset()};
  window.addEventListener("keydown",onKey);
  return()=>window.removeEventListener("keydown",onKey);
 },[open,pending]);

 useEffect(()=>{
  if(state.success)reset();
 },[state.success]);

 return <>
  <button type="button" className="danger small-button punch-delete-btn" onClick={()=>setOpen(true)}>
   <Trash2 size={13}/>{meta.btn}
  </button>
  {open&&(
   <div className="modal-backdrop" onClick={close}>
    <div className="modal" role="alertdialog" aria-modal="true" aria-labelledby={`del-att-${mode}-${sessionId}`} onClick={e=>e.stopPropagation()}>
     <TriangleAlert size={48} className="modal-danger-icon"/>
     <h2 id={`del-att-${mode}-${sessionId}`}>{meta.title}</h2>
     <p><strong>{employeeLabel}</strong></p>
     <p className="muted small">{mode==="entry"?"Entrada":"Salida"}: {timeLabel}</p>
     <p>{meta.body}</p>
     <p className="muted small">Quedará constancia en Auditoría. No se puede deshacer.</p>
     <form action={formAction} className="form-grid" style={{textAlign:"left"}}>
      <input type="hidden" name="session_id" value={sessionId}/>
      <input type="hidden" name="scope" value={meta.scope}/>
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
        placeholder="Ej. Marcó por error"
       />
      </label>
      {state.error&&<p role="alert" className="alert error">{state.error}</p>}
      <div className="modal-actions">
       <button type="button" className="secondary" onClick={close} disabled={pending}>Cancelar</button>
       <button className="danger-solid" disabled={pending||reason.trim().length<5}>
        <Trash2 size={15}/>{pending?"Borrando…":meta.confirm}
       </button>
      </div>
     </form>
    </div>
   </div>
  )}
 </>;
}
