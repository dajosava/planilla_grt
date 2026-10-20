"use client";
import {useActionState,useEffect,useState} from "react";
import {Trash2,TriangleAlert} from "lucide-react";
import type {ActionState} from "./action-form";

export function DeletePayroll({
 id,company,periodLabel,status,action,
}:{
 id:string;
 company:string;
 periodLabel:string;
 status:string;
 action:(state:ActionState,form:FormData)=>Promise<ActionState>;
}){
 const [state,formAction,pending]=useActionState(action,{});
 const [open,setOpen]=useState(false);
 const [typed,setTyped]=useState("");
 const close=()=>{if(!pending){setOpen(false);setTyped("")}};
 useEffect(()=>{
  if(!open)return;
  const onKey=(e:KeyboardEvent)=>{if(e.key==="Escape"&&!pending){setOpen(false);setTyped("")}};
  window.addEventListener("keydown",onKey);
  return ()=>window.removeEventListener("keydown",onKey);
 },[open,pending]);

 return <>
  <button
   type="button"
   className="btn-danger"
   onClick={()=>setOpen(true)}
  >
   <Trash2 size={15}/> Eliminar quincena
  </button>
  {open&&(
   <div className="modal-backdrop" onClick={close}>
    <div
     className="modal"
     role="alertdialog"
     aria-modal="true"
     aria-labelledby={`del-pay-${id}`}
     onClick={e=>e.stopPropagation()}
    >
     <TriangleAlert size={48} className="modal-danger-icon"/>
     <h2 id={`del-pay-${id}`}>Eliminar quincena</h2>
     <p>
      Vas a borrar <strong>{periodLabel}</strong> de <strong>{company}</strong>
      {status==="closed"?" (ya estaba cerrada)":" (borrador)"}.
     </p>
     <p>Se eliminarán los empleados de esa nómina, extras sugeridas y el cierre. Podés volver a crear la quincena después.</p>
     <p className="muted small">Esta acción no se puede deshacer.</p>
     <form action={formAction}>
      <input type="hidden" name="id" value={id}/>
      <label>
       Para confirmar, escribí <strong>{company}</strong>
       <input
        name="confirm"
        value={typed}
        onChange={e=>setTyped(e.target.value)}
        autoComplete="off"
        autoFocus
        disabled={pending}
       />
      </label>
      {state.error&&<p role="alert" className="alert error">{state.error}</p>}
      <div className="modal-actions">
       <button type="button" className="secondary" onClick={close} disabled={pending}>Cancelar</button>
       <button className="danger-solid" disabled={pending||typed!==company}>
        <Trash2 size={15}/>{pending?"Eliminando…":"Eliminar quincena"}
       </button>
      </div>
     </form>
    </div>
   </div>
  )}
 </>;
}
