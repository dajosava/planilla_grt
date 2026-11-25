import {NextResponse} from "next/server";
import {requireRole} from "@/lib/auth";
import {parseKioskPresenceList,PRESENCE_STALE_SECONDS} from "@/lib/kiosk-presence";

export const dynamic="force-dynamic";

/** Estado del reloj de marcación para el header del admin. */
export async function GET(){
 try{
  const {client}=await requireRole("admin");
  const {data,error}=await client.rpc("list_kiosk_presence",{p_stale_seconds:PRESENCE_STALE_SECONDS});
  if(error){
   return NextResponse.json(
    {ok:false,error:"No se pudo leer presencia",stale_seconds:PRESENCE_STALE_SECONDS,any_online:false,devices:[]},
    {status:200}
   );
  }
  return NextResponse.json(parseKioskPresenceList(data),{
   headers:{"cache-control":"no-store"},
  });
 }catch{
  return NextResponse.json(
   {ok:false,error:"No autorizado",stale_seconds:PRESENCE_STALE_SECONDS,any_online:false,devices:[]},
   {status:401}
  );
 }
}
