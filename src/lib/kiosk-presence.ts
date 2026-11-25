/** Identidad local del reloj + helpers de presencia (heartbeat → admin). */

const DEVICE_KEY="grt-kiosk-device-id";
const LAST_REPORT_KEY="grt-kiosk-presence-reported-at";

/** Escribe en DB como máximo cada 60 s (el probe local sigue cada 15 s). */
export const PRESENCE_REPORT_MS=60_000;
/** Sin heartbeat reciente → offline en el panel admin. */
export const PRESENCE_STALE_SECONDS=90;

export function getKioskDeviceId():string{
 if(typeof window==="undefined")return "";
 try{
  let id=localStorage.getItem(DEVICE_KEY);
  if(id&&id.length>=8)return id;
  id=typeof crypto!=="undefined"&&"randomUUID" in crypto
   ?crypto.randomUUID()
   :`kiosk-${Date.now()}-${Math.random().toString(36).slice(2,10)}`;
  localStorage.setItem(DEVICE_KEY,id);
  return id;
 }catch{
  return `kiosk-tmp-${Date.now()}`;
 }
}

export function shouldReportPresence(now=Date.now(),force=false):boolean{
 if(force)return true;
 if(typeof window==="undefined")return false;
 try{
  const raw=sessionStorage.getItem(LAST_REPORT_KEY);
  const prev=raw?Number(raw):0;
  if(!Number.isFinite(prev)||now-prev>=PRESENCE_REPORT_MS)return true;
  return false;
 }catch{
  return true;
 }
}

export function markPresenceReported(now=Date.now()):void{
 try{sessionStorage.setItem(LAST_REPORT_KEY,String(now));}catch{/* ignore */}
}

export type KioskPresenceDevice={
 device_id:string;
 label:string;
 last_seen_at:string;
 queue_pending:number;
 online:boolean;
 seconds_ago:number;
};

export type KioskPresenceList={
 ok:boolean;
 error?:string;
 stale_seconds:number;
 any_online:boolean;
 devices:KioskPresenceDevice[];
};

export function parseKioskPresenceList(data:unknown):KioskPresenceList{
 const empty:KioskPresenceList={ok:false,stale_seconds:PRESENCE_STALE_SECONDS,any_online:false,devices:[]};
 if(!data||typeof data!=="object")return empty;
 const o=data as Record<string,unknown>;
 const devices=Array.isArray(o.devices)
  ?(o.devices as Record<string,unknown>[]).map(d=>({
   device_id:String(d.device_id??""),
   label:String(d.label??"Reloj marcación"),
   last_seen_at:String(d.last_seen_at??""),
   queue_pending:Number(d.queue_pending??0)||0,
   online:!!d.online,
   seconds_ago:Number(d.seconds_ago??0)||0,
  })).filter(d=>d.device_id)
  :[];
 return {
  ok:o.ok===true,
  error:typeof o.error==="string"?o.error:undefined,
  stale_seconds:Number(o.stale_seconds??PRESENCE_STALE_SECONDS)||PRESENCE_STALE_SECONDS,
  any_online:!!o.any_online,
  devices,
 };
}
