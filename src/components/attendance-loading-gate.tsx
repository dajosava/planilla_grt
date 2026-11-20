"use client";

import {
 createContext,
 useCallback,
 useContext,
 useEffect,
 useState,
 type ReactNode,
} from "react";
import {useRouter} from "next/navigation";
import {PageSkeleton} from "@/components/ui/skeleton";

type NavCtx={navigate:(href:string)=>void};

const AttendanceNavContext=createContext<NavCtx|null>(null);

export function useAttendanceNavigate(){
 const ctx=useContext(AttendanceNavContext);
 if(!ctx)throw new Error("useAttendanceNavigate requiere AttendanceLoadingGate");
 return ctx.navigate;
}

function sameAsCurrent(href:string){
 try{
  const next=new URL(href,window.location.origin);
  return next.pathname===window.location.pathname&&next.search===window.location.search;
 }catch{
  return false;
 }
}

/**
 * Muestra el camión en cada cambio de filtro/enlace de asistencia.
 * paramsKey viene del servidor (desde|hasta|empleado|…) para apagar la carga
 * cuando llega el RSC nuevo — useTransition no alcanza en cambios de searchParams.
 */
export function AttendanceLoadingGate({
 paramsKey,
 children,
}:{
 paramsKey:string;
 children:ReactNode;
}){
 const router=useRouter();
 const [loading,setLoading]=useState(false);

 useEffect(()=>{
  setLoading(false);
 },[paramsKey]);

 const navigate=useCallback((href:string)=>{
  if(sameAsCurrent(href))return;
  setLoading(true);
  router.push(href);
 },[router]);

 useEffect(()=>{
  function onClick(e:MouseEvent){
   if(e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
   const a=(e.target as Element|null)?.closest?.("a");
   if(!a)return;
   const href=a.getAttribute("href");
   if(!href||!href.startsWith("/admin/asistencia"))return;
   if(a.hasAttribute("download")||a.getAttribute("target")==="_blank")return;
   if(sameAsCurrent(href))return;
   e.preventDefault();
   e.stopPropagation();
   navigate(href);
  }
  document.addEventListener("click",onClick,true);
  return()=>document.removeEventListener("click",onClick,true);
 },[navigate]);

 return (
  <AttendanceNavContext.Provider value={{navigate}}>
   <div className="attendance-loading-root">
    {loading?(
     <div className="attendance-filter-loading-overlay" role="status" aria-live="polite" aria-busy="true">
      <PageSkeleton label="Cargando jornadas…"/>
     </div>
    ):null}
    <div className={loading?"attendance-loading-hidden":undefined} aria-hidden={loading||undefined}>
     {children}
    </div>
   </div>
  </AttendanceNavContext.Provider>
 );
}
