"use client";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {Users,CalendarDays,Clock3,Wallet,LayoutDashboard,ClipboardList,ClipboardCheck,TriangleAlert} from "lucide-react";

const groups=[
 {label:"Ops",items:[
  {href:"/admin/operaciones",label:"Operaciones",icon:ClipboardCheck},
  {href:"/admin/incidentes",label:"Incidentes",icon:TriangleAlert},
 ]},
 {label:"Administración",items:[
  {href:"/admin",label:"Resumen",icon:LayoutDashboard},
  {href:"/admin/empleados",label:"Empleados",icon:Users},
  {href:"/admin/asistencia",label:"Asistencia",icon:Clock3},
  {href:"/admin/turnos",label:"Turnos",icon:CalendarDays},
  {href:"/admin/ausencias",label:"Vacaciones y ausencias",icon:ClipboardList},
  {href:"/admin/planilla",label:"Planilla",icon:Wallet},
  {href:"/admin/auditoria",label:"Auditoría",icon:ClipboardList},
 ]},
];

export function AdminNav(){
 const path=usePathname();
 return <>
  {groups.map(g=><div key={g.label} className="nav-group">
   <p className="nav-label">{g.label}</p>
   <nav aria-label={g.label}>{g.items.map(l=>{
    const active=l.href==="/admin"?path===l.href:path===l.href||path.startsWith(l.href+"/");
    return <Link href={l.href} key={l.href} className={active?"active":undefined} aria-current={active?"page":undefined}>
     <l.icon size={19}/>{l.label}
    </Link>;
   })}</nav>
  </div>)}
 </>;
}
