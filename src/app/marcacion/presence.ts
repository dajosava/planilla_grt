"use server";

import {requireRole} from "@/lib/auth";

/** Upsert de presencia del reloj (solo rol kiosk). */
export async function reportKioskPresence(input:{
 deviceId:string;
 queuePending?:number;
 label?:string;
 userAgent?:string;
}):Promise<{ok?:boolean;error?:string}>{
 try{
  const {client}=await requireRole("kiosk");
  const {data,error}=await client.rpc("report_kiosk_presence",{
   p_device_id:input.deviceId,
   p_queue_pending:input.queuePending??0,
   p_label:input.label??"Reloj marcación",
   p_user_agent:input.userAgent??"",
  });
  if(error)return {error:"No se pudo registrar presencia"};
  if(data&&typeof data==="object"&&(data as {ok?:boolean}).ok===false){
   return {error:String((data as {error?:string}).error??"Error")};
  }
  return {ok:true};
 }catch{
  return {error:"No se pudo registrar presencia"};
 }
}
