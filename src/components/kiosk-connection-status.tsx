"use client";

import {useCallback,useEffect,useState} from "react";
import {Wifi,WifiOff,Clock3} from "lucide-react";
import {
 parseKioskPresenceList,
 type KioskPresenceList,
 PRESENCE_STALE_SECONDS,
} from "@/lib/kiosk-presence";

const POLL_MS=30_000;

function formatAgo(seconds:number):string{
 if(seconds<5)return "ahora";
 if(seconds<60)return `hace ${seconds}s`;
 const m=Math.floor(seconds/60);
 if(m<60)return `hace ${m} min`;
 const h=Math.floor(m/60);
 return `hace ${h} h`;
}

export function KioskConnectionStatus({
 initial,
}:{
 initial?:KioskPresenceList|null;
}){
 const [status,setStatus]=useState<KioskPresenceList>(
  initial??{ok:false,stale_seconds:PRESENCE_STALE_SECONDS,any_online:false,devices:[]}
 );

 const refresh=useCallback(async()=>{
  try{
   const res=await fetch("/api/admin/kiosk-status",{cache:"no-store"});
   if(!res.ok)return;
   const json=await res.json();
   setStatus(parseKioskPresenceList(json));
  }catch{/* ignore */}
 },[]);

 useEffect(()=>{
  void refresh();
  const id=setInterval(()=>{void refresh();},POLL_MS);
  const onVis=()=>{if(document.visibilityState==="visible")void refresh();};
  document.addEventListener("visibilitychange",onVis);
  return()=>{
   clearInterval(id);
   document.removeEventListener("visibilitychange",onVis);
  };
 },[refresh]);

 const primary=status.devices[0];
 const online=status.any_online;
 const queue=status.devices.reduce((s,d)=>s+d.queue_pending,0);
 const ago=primary?formatAgo(primary.seconds_ago):null;

 let title="Sin señal del reloj de marcación. Abrí /marcación en la tablet con sesión kiosk.";
 if(primary){
  title=online
   ?`${primary.label} en línea · último heartbeat ${ago}${queue?` · ${queue} marca(s) en cola`:""}`
   :`${primary.label} sin señal · último heartbeat ${ago}. Revisá Wi‑Fi / PWA de la tablet.`;
 }

 return (
  <div
   className={`kiosk-conn${online?" is-online":" is-offline"}`}
   title={title}
   role="status"
   aria-live="polite"
  >
   <span className="kiosk-conn-icon" aria-hidden="true">
    {online?<Wifi size={15}/>:primary?<WifiOff size={15}/>:<Clock3 size={15}/>}
   </span>
   <span className="kiosk-conn-text">
    {online?"Reloj en línea":primary?"Reloj sin señal":"Reloj sin datos"}
    {ago?<span className="kiosk-conn-ago"> · {ago}</span>:null}
    {queue>0?<span className="kiosk-conn-queue"> · {queue} cola</span>:null}
   </span>
  </div>
 );
}
