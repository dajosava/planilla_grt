"use client";
import {useMemo,useSyncExternalStore} from "react";
import Link from "next/link";
import {LayoutGrid,List} from "lucide-react";
import {Avatar} from "@/components/ui/avatar";
import {Badge} from "@/components/ui/badge";
import {EmptyState} from "@/components/ui/empty-state";
import {timeOnly} from "@/lib/format";

export type BoardTask={
 id:string;title:string;area:string;status:string;due_at:string;run_date:string;
 assignee:{full_name?:string;code?:string}|null;
};

const COLS=[
 {key:"pending",label:"Pendiente"},
 {key:"in_progress",label:"En proceso"},
 {key:"completed",label:"Completada"},
 {key:"approved",label:"Aprobada"},
] as const;

const statusLabel:Record<string,string>={
 pending:"Pendiente",in_progress:"En proceso",completed:"Completada",approved:"Aprobada",rejected:"Rechazada",
};

function isLate(status:string,due:string,nowMs:number){
 return ["pending","in_progress"].includes(status)&&new Date(due).getTime()<nowMs;
}

const viewListeners=new Set<()=>void>();
function getView():"table"|"kanban"{
 return typeof window!=="undefined"&&localStorage.getItem("grt-ops-view")==="kanban"?"kanban":"table";
}
function setStoredView(v:"table"|"kanban"){
 localStorage.setItem("grt-ops-view",v);
 viewListeners.forEach(l=>l());
}

export function OpsTaskBoard({tasks,filterStatus,filterArea,nowMs}:{tasks:BoardTask[];filterStatus?:string;filterArea?:string;nowMs:number}){
 const view=useSyncExternalStore(
  (onStore)=> {viewListeners.add(onStore);return ()=>viewListeners.delete(onStore)},
  getView,
  ()=>"table" as const
 );
 const filtered=useMemo(()=>tasks.filter(t=>{
  if(filterStatus&&filterStatus!=="all"&&t.status!==filterStatus)return false;
  if(filterArea&&filterArea!=="all"&&t.area!==filterArea)return false;
  return true;
 }),[tasks,filterStatus,filterArea]);

 function setViewMode(v:"table"|"kanban"){setStoredView(v)}

 return <div>
  <div className="panel-head" style={{marginBottom:12}}>
   <p className="muted small" style={{margin:0}}>{filtered.length} tarea(s)</p>
   <div className="view-toggle" role="group" aria-label="Vista de tareas">
    <button type="button" className={view==="table"?"active":""} onClick={()=>setViewMode("table")} aria-pressed={view==="table"}><List size={14}/> Tabla</button>
    <button type="button" className={view==="kanban"?"active":""} onClick={()=>setViewMode("kanban")} aria-pressed={view==="kanban"}><LayoutGrid size={14}/> Kanban</button>
   </div>
  </div>

  {!filtered.length?<EmptyState text="No hay tareas con estos filtros."/>:view==="kanban"?(
   <div className="kanban">
    {COLS.map(col=>{
     const items=filtered.filter(t=>t.status===col.key);
     return <div key={col.key} className="kanban-col">
      <h3>{col.label}<span className="tabular">{items.length}</span></h3>
      {items.map(t=>{
       const late=isLate(t.status,t.due_at,nowMs);
       return <article key={t.id} className="kanban-card">
        <strong>{t.title}</strong>
        <p className="meta">{t.area} · {timeOnly(t.due_at)}{late?" · atrasada":""}</p>
        <p className="meta" style={{marginTop:6}}>{t.assignee?.full_name??"Sin asignar"}</p>
        <Link className="text-link" href={`/admin/operaciones/tareas?fecha=${t.run_date}`}>Gestionar →</Link>
       </article>;
      })}
     </div>;
    })}
   </div>
  ):(
   <>
    <div className="table-scroll stack-mobile">
     <table>
      <thead><tr><th>Tarea</th><th>Área</th><th>Responsable</th><th>Límite</th><th>Estado</th><th>Acción</th></tr></thead>
      <tbody>{filtered.map(t=>{
       const late=isLate(t.status,t.due_at,nowMs);
       const name=t.assignee?.full_name;
       return <tr key={t.id}>
        <td><strong>{t.title}</strong><small>{t.run_date}</small></td>
        <td>{t.area}</td>
        <td>{name?<span className="person-cell"><Avatar name={name}/>{name}</span>:<span className="muted">Sin asignar</span>}</td>
        <td className={late?"text-danger":undefined}>{timeOnly(t.due_at)}</td>
        <td><Badge tone={late?"late":t.status}>{late?"Atrasada":statusLabel[t.status]??t.status}</Badge></td>
        <td><Link className="text-link" href={`/admin/operaciones/tareas?fecha=${t.run_date}`}>Revisar →</Link></td>
       </tr>;
      })}</tbody>
     </table>
    </div>
    <div className="mobile-cards">{filtered.map(t=>{
     const late=isLate(t.status,t.due_at,nowMs);
     return <article key={t.id} className="mobile-card">
      <div className="page-heading-row"><strong>{t.title}</strong><Badge tone={late?"late":t.status}>{late?"Atrasada":statusLabel[t.status]}</Badge></div>
      <p className="small muted">{t.area} · {timeOnly(t.due_at)}</p>
      <p className="small">{t.assignee?.full_name??"Sin asignar"}</p>
      <Link className="text-link" href={`/admin/operaciones/tareas?fecha=${t.run_date}`}>Revisar →</Link>
     </article>;
    })}</div>
   </>
  )}
 </div>;
}
