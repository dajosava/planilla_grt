"use client";
import type {ReactNode} from "react";
import Link from "next/link";
import {usePathname} from "next/navigation";

const links=[
 {href:"/admin/operaciones/plantillas",label:"Plantillas"},
 {href:"/admin/operaciones/tareas",label:"Todas las tareas"},
 {href:"/admin/incidentes",label:"Incidentes"},
];

export function OpsNavBar({end}:{end?:ReactNode}={}){
 const path=usePathname();
 return <div className={`ops-toolbar${end?" has-filters":""}`}>
  <nav className="ops-nav-bar" aria-label="Módulos de operaciones">
   {links.map(l=>{
    const active=path===l.href||path.startsWith(l.href+"/");
    return <Link key={l.href} className={`button${active?" active":""}`} href={l.href} aria-current={active?"page":undefined}>{l.label}</Link>;
   })}
  </nav>
  {end}
 </div>;
}
