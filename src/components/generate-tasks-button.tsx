"use client";
import {useTransition,useState} from "react";
import {generateTodayTasks} from "@/app/admin/ops-actions";

export function GenerateTasksButton(){
 const [pending,start]=useTransition();
 const [msg,setMsg]=useState<{error?:string;success?:string}>({});
 return <div>
  <button type="button" className="secondary" disabled={pending} onClick={()=>start(async()=>{setMsg({});setMsg(await generateTodayTasks())})}>
   {pending?"Generando…":"Generar tareas de hoy"}
  </button>
  {msg.success&&<p className="alert success" role="status">{msg.success}</p>}
  {msg.error&&<p className="alert error" role="alert">{msg.error}</p>}
 </div>;
}
