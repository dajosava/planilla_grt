"use client";
import {useEffect,useState,useSyncExternalStore} from "react";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {
 Menu,PanelLeftClose,PanelLeft,Bell,Search,LogOut,
 ClipboardCheck,TriangleAlert,LayoutDashboard,Users,Clock3,CalendarDays,ClipboardList,Wallet,ScrollText,AlarmClock,
} from "lucide-react";
import {Avatar} from "@/components/ui/avatar";
import {CommandPalette} from "./command-palette";

const collapseListeners=new Set<()=>void>();
function getCollapsed(){return typeof window!=="undefined"&&localStorage.getItem("grt-sidebar-collapsed")==="1"}
function setCollapsedStore(v:boolean){
 localStorage.setItem("grt-sidebar-collapsed",v?"1":"0");
 collapseListeners.forEach(l=>l());
}

type BadgeKey="late"|"incidents"|"reminders"|"ot";
type NavItem={href:string;label:string;icon:typeof LayoutDashboard;badgeKey?:BadgeKey};
const groups:{label:string;items:NavItem[]}[]=[
 {label:"Ops",items:[
  {href:"/admin/operaciones",label:"Operaciones",icon:ClipboardCheck,badgeKey:"late"},
  {href:"/admin/incidentes",label:"Incidentes",icon:TriangleAlert,badgeKey:"incidents"},
 ]},
 {label:"Administración",items:[
  {href:"/admin",label:"Resumen",icon:LayoutDashboard},
  {href:"/admin/empleados",label:"Empleados",icon:Users},
  {href:"/admin/asistencia",label:"Asistencia",icon:Clock3},
  {href:"/admin/turnos",label:"Turnos",icon:CalendarDays},
  {href:"/admin/ausencias",label:"Vacaciones y ausencias",icon:ClipboardList},
  {href:"/admin/planilla",label:"Planilla",icon:Wallet,badgeKey:"ot"},
  {href:"/admin/recordatorios",label:"Recordatorios",icon:AlarmClock,badgeKey:"reminders"},
  {href:"/admin/auditoria",label:"Auditoría",icon:ScrollText},
 ]},
];

const crumbs:Record<string,string>={
 "/admin":"Resumen","/admin/operaciones":"Operaciones","/admin/operaciones/plantillas":"Plantillas",
 "/admin/operaciones/tareas":"Tareas","/admin/incidentes":"Incidentes","/admin/empleados":"Empleados",
 "/admin/asistencia":"Asistencia","/admin/turnos":"Turnos","/admin/ausencias":"Vacaciones y ausencias",
 "/admin/planilla":"Planilla","/admin/planilla/historial":"Historial de pagos",
 "/admin/recordatorios":"Recordatorios","/admin/auditoria":"Auditoría",
};

export function AdminShell({
 children,displayName,logoutAction,badges={late:0,incidents:0,reminders:0,ot:0},
}:{
 children:React.ReactNode;displayName:string;logoutAction:()=>Promise<void>;
 badges?:{late:number;incidents:number;reminders:number;ot:number};
}){
 const path=usePathname();
 const [open,setOpen]=useState(false);
 const collapsed=useSyncExternalStore(
  (cb)=>{collapseListeners.add(cb);return ()=>collapseListeners.delete(cb)},
  getCollapsed,
  ()=>false
 );
 const [cmdk,setCmdk]=useState(false);
 const notif=badges.late+badges.incidents+badges.reminders+badges.ot;

 useEffect(()=>{
  function onKey(e:KeyboardEvent){
   if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="k"){e.preventDefault();setCmdk(true)}
   if(e.key==="Escape")setCmdk(false);
  }
  window.addEventListener("keydown",onKey);
  return ()=>window.removeEventListener("keydown",onKey);
 },[]);

 const trail: {href:string;label:string}[]=[];
 let acc="";
 for(const p of path.split("/").filter(Boolean)){
  acc+=`/${p}`;
  if(crumbs[acc])trail.push({href:acc,label:crumbs[acc]});
 }

 return <div className={`shell${collapsed?" sidebar-collapsed":""}`}>
  <div className={`sidebar-backdrop${open?" open":""}`} onClick={()=>setOpen(false)} aria-hidden={!open}/>
  <aside className={`sidebar${open?" open":""}`} aria-label="Navegación principal">
   <Link href="/admin" className="brand" onClick={()=>setOpen(false)}>
    <div className="brand-mark">GRT</div>
    <div><strong>Gasolinera Río Tempisque</strong><span>Gestión de Operaciones y personal</span></div>
   </Link>
   {groups.map(g=><div className="nav-group" key={g.label}>
    <p className="nav-label">{g.label}</p>
    <nav aria-label={g.label}>{g.items.map(item=>{
     const active=item.href==="/admin"?path===item.href:path===item.href||path.startsWith(item.href+"/");
     const count=item.badgeKey!=null?badges[item.badgeKey]:0;
     return <Link key={item.href} href={item.href} className={active?"active":undefined} aria-current={active?"page":undefined} onClick={()=>setOpen(false)} title={item.label}>
      <item.icon size={18} aria-hidden="true"/><span className="nav-text">{item.label}</span>
      {count>0&&<span className="nav-badge" aria-label={`${count} pendientes`}>{count>99?"99+":count}</span>}
     </Link>;
    })}</nav>
   </div>)}
   <div className="sidebar-footer">
    <div className="user-chip">
     <Avatar name={displayName} className="navy"/>
     <div><strong>{displayName}</strong><span>Administrador</span></div>
    </div>
    <form action={logoutAction}>
     <button type="submit" className="btn-logout" aria-label="Cerrar sesión"><LogOut size={16}/><span className="logout-label">Cerrar sesión</span></button>
    </form>
   </div>
  </aside>

  <div className="workspace">
   <header className="topbar">
    <div className="topbar-left">
     <button type="button" className="secondary btn-icon menu-toggle" onClick={()=>setOpen(true)} aria-label="Abrir menú"><Menu size={18}/></button>
     <button type="button" className="secondary btn-icon" style={{display:"none"}} id="desktop-collapse" onClick={()=>setCollapsedStore(!collapsed)} aria-label={collapsed?"Expandir menú":"Colapsar menú"}>
      {collapsed?<PanelLeft size={18}/>:<PanelLeftClose size={18}/>}
     </button>
     <style>{`@media(min-width:1025px){#desktop-collapse{display:grid!important;place-items:center}}`}</style>
     <nav className="breadcrumbs" aria-label="Migas de pan">
      <Link href="/admin">Admin</Link>
      {trail.map((c,i)=><span key={c.href} style={{display:"contents"}}>
       <span aria-hidden="true">/</span>
       {i===trail.length-1?<span className="current">{c.label}</span>:<Link href={c.href}>{c.label}</Link>}
      </span>)}
     </nav>
    </div>
    <div className="topbar-right">
     <button type="button" className="search-trigger" onClick={()=>setCmdk(true)} aria-label="Buscar (Ctrl K)">
      <Search size={15} aria-hidden="true"/> Buscar… <kbd>Ctrl K</kbd>
     </button>
     <button type="button" className="notif-btn" aria-label={`Notificaciones${notif?`, ${notif}`:""}`} title={notif?`${badges.late} ops · ${badges.incidents} incidentes · ${badges.ot} extras · ${badges.reminders} recordatorios`:"Sin alertas"}>
      <Bell size={17}/>{notif>0&&<span className="dot">{notif>9?"9+":notif}</span>}
     </button>
     <Avatar name={displayName}/>
    </div>
   </header>
   <main className="content">{children}</main>
  </div>

  <nav className="bottom-nav" aria-label="Accesos rápidos">
   {[
    {href:"/admin/operaciones",label:"Ops",icon:ClipboardCheck},
    {href:"/admin/incidentes",label:"Alertas",icon:TriangleAlert},
    {href:"/admin/asistencia",label:"Asistencia",icon:Clock3},
    {href:"/admin/empleados",label:"Equipo",icon:Users},
   ].map(i=>{
    const active=path===i.href||path.startsWith(i.href+"/");
    return <Link key={i.href} href={i.href} className={active?"active":undefined}><i.icon size={18}/><span>{i.label}</span></Link>;
   })}
  </nav>
  <CommandPalette open={cmdk} onClose={()=>setCmdk(false)}/>
 </div>;
}
