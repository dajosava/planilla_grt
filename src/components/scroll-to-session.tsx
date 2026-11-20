"use client";

import {useEffect} from "react";

/** Tras filtrar por aviso de salida faltante, lleva la vista a esa fila. */
export function ScrollToSession({sessionId}:{sessionId:string}){
 useEffect(()=>{
  if(!sessionId)return;
  const el=document.getElementById(`sesion-${sessionId}`);
  if(!el)return;
  el.scrollIntoView({behavior:"smooth",block:"center"});
 },[sessionId]);
 return null;
}
