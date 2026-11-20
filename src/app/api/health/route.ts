/** Ping liviano para que la tablet compruebe salida real a internet (no solo navigator.onLine). */
export const dynamic="force-dynamic";

function ok(){
 return new Response("ok",{
  status:200,
  headers:{
   "cache-control":"no-store, no-cache, must-revalidate",
   "content-type":"text/plain; charset=utf-8",
  },
 });
}

export function GET(){return ok();}
export function HEAD(){return ok();}
