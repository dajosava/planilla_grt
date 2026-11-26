/** Ruta de health check usada por la tablet de marcación. */
export const HEALTH_PATH="/api/health";

export type ProbeOptions={
 /** URL absoluta o relativa. Por defecto `/api/health?t=…`. */
 url?:string;
 timeoutMs?:number;
 fetchImpl?:typeof fetch;
};

/**
 * Comprueba si hay salida real a la red (fetch al origen).
 * En tablets, `navigator.onLine` a menudo miente tras Wi‑Fi “congelado”;
 * este probe es la fuente de verdad para reanudar la cola offline.
 */
export async function probeReachability(opts:ProbeOptions={}):Promise<boolean>{
 const timeoutMs=opts.timeoutMs??4_000;
 const fetchImpl=opts.fetchImpl??fetch;
 const url=opts.url??`${HEALTH_PATH}?t=${Date.now()}`;
 const ctrl=new AbortController();
 const timer=setTimeout(()=>ctrl.abort(),timeoutMs);
 try{
  const res=await fetchImpl(url,{
   method:"GET",
   cache:"no-store",
   credentials:"same-origin",
   signal:ctrl.signal,
   headers:{
    "cache-control":"no-cache",
    pragma:"no-cache",
   },
  });
  return res.ok;
 }catch{
  return false;
 }finally{
  clearTimeout(timer);
 }
}
