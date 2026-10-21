"use client";
import {useMemo,useState} from "react";
import {useRouter} from "next/navigation";
import {ClipboardCheck,TriangleAlert,LayoutDashboard,Users,Clock3,CalendarDays,ClipboardList,Wallet,ScrollText,AlarmClock,Search} from "lucide-react";

const routes=[
 {href:"/admin",label:"Resumen",icon:LayoutDashboard,group:"Admin"},
 {href:"/admin/operaciones",label:"Operaciones",icon:ClipboardCheck,group:"Ops"},
 {href:"/admin/operaciones/plantillas",label:"Plantillas",icon:ClipboardCheck,group:"Ops"},
 {href:"/admin/operaciones/tareas",label:"Tareas",icon:ClipboardCheck,group:"Ops"},
 {href:"/admin/incidentes",label:"Incidentes",icon:TriangleAlert,group:"Ops"},
 {href:"/admin/empleados",label:"Empleados",icon:Users,group:"Admin"},
 {href:"/admin/asistencia",label:"Asistencia",icon:Clock3,group:"Admin"},
 {href:"/admin/turnos",label:"Turnos",icon:CalendarDays,group:"Admin"},
 {href:"/admin/ausencias",label:"Vacaciones y ausencias",icon:ClipboardList,group:"Admin"},
 {href:"/admin/planilla",label:"Planilla",icon:Wallet,group:"Admin"},
 {href:"/admin/planilla/aguinaldo",label:"Aguinaldo",icon:Wallet,group:"Admin"},
 {href:"/admin/recordatorios",label:"Recordatorios",icon:AlarmClock,group:"Admin"},
 {href:"/admin/auditoria",label:"Auditoría",icon:ScrollText,group:"Admin"},
];

export function CommandPalette({open,onClose}:{open:boolean;onClose:()=>void}){
 const router=useRouter();
 const [q,setQ]=useState("");
 const [sel,setSel]=useState(0);
 const items=useMemo(()=>{
  const n=q.trim().toLowerCase();
  return routes.filter(r=>!n||r.label.toLowerCase().includes(n)||r.group.toLowerCase().includes(n));
 },[q]);
 if(!open)return null;
 const active=Math.min(sel,Math.max(items.length-1,0));
 function go(href:string){onClose();router.push(href)}
 return <div className="cmdk-backdrop" role="dialog" aria-modal="true" aria-label="Buscar en el panel" onClick={onClose}>
  <div className="cmdk" onClick={e=>e.stopPropagation()}>
   <div style={{display:"flex",alignItems:"center",gap:8,paddingLeft:14}}>
    <Search size={18} aria-hidden="true" color="var(--text-muted)"/>
    <input autoFocus value={q} onChange={e=>{setQ(e.target.value);setSel(0)}} placeholder="Ir a una sección…"
     onKeyDown={e=>{
      if(e.key==="Escape")onClose();
      if(e.key==="ArrowDown"){e.preventDefault();setSel(s=>Math.min(s+1,items.length-1))}
      if(e.key==="ArrowUp"){e.preventDefault();setSel(s=>Math.max(s-1,0))}
      if(e.key==="Enter"&&items[active])go(items[active].href);
     }}/>
   </div>
   <div className="cmdk-list" role="listbox">
    {!items.length?<p className="cmdk-empty">Sin resultados</p>:items.map((r,i)=>
     <button key={r.href} type="button" role="option" className="cmdk-item" aria-selected={i===active} onMouseEnter={()=>setSel(i)} onClick={()=>go(r.href)}>
      <r.icon size={16} aria-hidden="true"/>{r.label}<span className="muted small" style={{marginLeft:"auto"}}>{r.group}</span>
     </button>
    )}
   </div>
  </div>
 </div>;
}
