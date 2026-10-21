"use client";
import {useActionState,useEffect,useState} from "react";
import {Trash2,TriangleAlert} from "lucide-react";
import type {ActionState} from "./action-form";

export function DeleteAguinaldo({
 id,company,yearLabel,status,action,
}:{
 id:string;
 company:string;
 yearLabel:string;
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
  <button type="button" className="btn-danger" onClick={()=>setOpen(true)}>
   <Trash2 size={15}/> Eliminar aguinaldo
  </button>
  {open&&(
   <div className="modal-backdrop" onClick={close}>
    <div
     className="modal"
     role="alertdialog"
     aria-modal="true"
     aria-labelledby={`del-agu-${id}`}
     onClick={e=>e.stopPropagation()}
    >
     <TriangleAlert size={48} className="modal-danger-icon"/>
     <h2 id={`del-agu-${id}`}>Eliminar aguinaldo</h2>
     <p>
      Vas a borrar <strong>{yearLabel}</strong> de <strong>{company}</strong>
      {status==="closed"?" (ya estaba cerrado)":" (borrador)"}.
     </p>
     <p>Se eliminarán la acumulación y los ajustes. Podés crear la corrida de nuevo después.</p>
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
        required
       />
      </label>
      {state.error&&<p role="alert" className="alert error">{state.error}</p>}
      <div className="button-row" style={{marginTop:14}}>
       <button type="button" className="secondary" onClick={close} disabled={pending}>Cancelar</button>
       <button className="danger-solid" disabled={pending||typed.trim().toUpperCase()!==company.toUpperCase()}>
        {pending?"Eliminando…":"Eliminar definitivamente"}
       </button>
      </div>
     </form>
    </div>
   </div>
  )}
 </>;
}
