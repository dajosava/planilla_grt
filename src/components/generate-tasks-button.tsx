"use client";
import {useTransition,useState} from "react";
import {ClipboardPlus} from "lucide-react";
import {generateTodayTasks} from "@/app/admin/ops-actions";

export function GenerateTasksButton(){
 const [pending,start]=useTransition();
 const [msg,setMsg]=useState<{error?:string;success?:string}>({});
 return <div>
  <button
   type="button"
   disabled={pending}
   aria-label="Generar tareas de hoy"
   title="Crea las tareas del día desde las plantillas activas"
   onClick={()=>{
    if(!confirm("¿Generar las tareas de hoy desde las plantillas activas? Si ya existen, no se duplican; sí se actualiza el empleado asignado en las abiertas."))return;
    start(async()=>{setMsg({});setMsg(await generateTodayTasks())});
   }}
  >
   <ClipboardPlus size={18} aria-hidden="true"/>
   {pending?"Generando…":"Generar tareas de hoy"}
  </button>
  {msg.success&&<p className="alert success" role="status">{msg.success}</p>}
  {msg.error&&<p className="alert error" role="alert">{msg.error}</p>}
 </div>;
}
