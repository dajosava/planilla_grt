/** Cola local de marcaciones (IndexedDB) para tablet PWA sin red. */

const DB_NAME="grt-kiosk";
const DB_VERSION=2;
const STORE="punch_queue";
const STATE_STORE="session_state";

export type PunchKind="entry"|"exit"|"break_start"|"break_end";

export type QueuedPunch={
 id:string;
 code:string;
 pin:string;
 kind:PunchKind;
 photo:string|null;
 occurredAt:string;
 createdAt:string;
 status:"pending"|"failed";
 error:string;
 attempts:number;
};

type SessionStateRow={
 code:string;
 open:boolean;
 updatedAt:string;
};

/** Aplica una marca al flag “jornada abierta” (misma regla que el RPC). */
export function applyPunchToOpen(open:boolean,kind:PunchKind):boolean{
 if(kind==="entry")return true;
 if(kind==="exit")return false;
 return open;
}

/**
 * ¿Se puede encolar esta marca dado el estado actual de jornada?
 * Evita doble entrada / doble salida (y break incoherente a alto nivel).
 */
export function validatePunchAgainstOpen(open:boolean,kind:PunchKind):{ok:true}|{ok:false;error:string}{
 if(kind==="entry"){
  if(open)return {ok:false,error:"Ya tenés una entrada pendiente o abierta. Marcá la salida antes de otra entrada."};
  return {ok:true};
 }
 if(kind==="exit"){
  if(!open)return {ok:false,error:"No hay una entrada abierta. Marcá la entrada primero."};
  return {ok:true};
 }
 if(kind==="break_start"||kind==="break_end"){
  if(!open)return {ok:false,error:"No hay una entrada abierta para registrar descanso."};
  return {ok:true};
 }
 return {ok:true};
}

/** Simula cola pendiente sobre un estado base (última sync conocida). */
export function openAfterPending(baseOpen:boolean,pending:Pick<QueuedPunch,"kind"|"occurredAt">[]):boolean{
 let open=baseOpen;
 for(const item of pending.slice().sort((a,b)=>a.occurredAt.localeCompare(b.occurredAt))){
  open=applyPunchToOpen(open,item.kind);
 }
 return open;
}

function openDb():Promise<IDBDatabase>{
 return new Promise((resolve,reject)=>{
  const req=indexedDB.open(DB_NAME,DB_VERSION);
  req.onerror=()=>reject(req.error??new Error("IndexedDB no disponible"));
  req.onsuccess=()=>resolve(req.result);
  req.onupgradeneeded=()=>{
   const db=req.result;
   if(!db.objectStoreNames.contains(STORE)){
    const store=db.createObjectStore(STORE,{keyPath:"id"});
    store.createIndex("by_time","occurredAt",{unique:false});
    store.createIndex("by_status","status",{unique:false});
   }
   if(!db.objectStoreNames.contains(STATE_STORE)){
    db.createObjectStore(STATE_STORE,{keyPath:"code"});
   }
  };
 });
}

function txDone(tx:IDBTransaction){
 return new Promise<void>((resolve,reject)=>{
  tx.oncomplete=()=>resolve();
  tx.onerror=()=>reject(tx.error??new Error("Error IndexedDB"));
  tx.onabort=()=>reject(tx.error??new Error("Transacción abortada"));
 });
}

function normalizeCode(code:string){
 return code.trim().toUpperCase();
}

export async function getKnownSessionOpen(code:string):Promise<boolean>{
 const key=normalizeCode(code);
 const db=await openDb();
 const tx=db.transaction(STATE_STORE,"readonly");
 const req=tx.objectStore(STATE_STORE).get(key);
 const row=await new Promise<SessionStateRow|undefined>((resolve,reject)=>{
  req.onsuccess=()=>resolve(req.result as SessionStateRow|undefined);
  req.onerror=()=>reject(req.error??new Error("No se pudo leer el estado local"));
 });
 await txDone(tx);
 db.close();
 return !!row?.open;
}

export async function setKnownSessionOpen(code:string,open:boolean):Promise<void>{
 const key=normalizeCode(code);
 const db=await openDb();
 const tx=db.transaction(STATE_STORE,"readwrite");
 tx.objectStore(STATE_STORE).put({code:key,open,updatedAt:new Date().toISOString()} satisfies SessionStateRow);
 await txDone(tx);
 db.close();
}

/** Estado efectivo = última sync conocida + marcas pending de ese código. */
export async function effectiveSessionOpen(code:string):Promise<boolean>{
 const key=normalizeCode(code);
 const base=await getKnownSessionOpen(key);
 const pending=(await listQueuedPunches()).filter(
  p=>normalizeCode(p.code)===key&&p.status==="pending"
 );
 return openAfterPending(base,pending);
}

/** Valida antes de guardar offline (o al caer a cola por error de red). */
export async function canQueuePunch(code:string,kind:PunchKind):Promise<{ok:true}|{ok:false;error:string}>{
 const open=await effectiveSessionOpen(code);
 return validatePunchAgainstOpen(open,kind);
}

export async function enqueuePunch(input:Omit<QueuedPunch,"status"|"error"|"attempts"|"createdAt">):Promise<QueuedPunch>{
 const check=await canQueuePunch(input.code,input.kind);
 if(!check.ok)throw new Error(check.error);

 const row:QueuedPunch={
  ...input,
  code:normalizeCode(input.code),
  createdAt:new Date().toISOString(),
  status:"pending",
  error:"",
  attempts:0,
 };
 const db=await openDb();
 const tx=db.transaction(STORE,"readwrite");
 tx.objectStore(STORE).put(row);
 await txDone(tx);
 db.close();
 return row;
}

export async function listQueuedPunches():Promise<QueuedPunch[]>{
 const db=await openDb();
 const tx=db.transaction(STORE,"readonly");
 const store=tx.objectStore(STORE);
 const req=store.getAll();
 const rows=await new Promise<QueuedPunch[]>((resolve,reject)=>{
  req.onsuccess=()=>resolve((req.result as QueuedPunch[])??[]);
  req.onerror=()=>reject(req.error??new Error("No se pudo leer la cola"));
 });
 await txDone(tx);
 db.close();
 return rows.slice().sort((a,b)=>a.occurredAt.localeCompare(b.occurredAt));
}

export async function removeQueuedPunch(id:string):Promise<void>{
 const db=await openDb();
 const tx=db.transaction(STORE,"readwrite");
 tx.objectStore(STORE).delete(id);
 await txDone(tx);
 db.close();
}

export async function markQueuedPunchFailed(id:string,error:string):Promise<void>{
 const db=await openDb();
 const tx=db.transaction(STORE,"readwrite");
 const store=tx.objectStore(STORE);
 const getReq=store.get(id);
 const row=await new Promise<QueuedPunch|undefined>((resolve,reject)=>{
  getReq.onsuccess=()=>resolve(getReq.result as QueuedPunch|undefined);
  getReq.onerror=()=>reject(getReq.error??new Error("No se pudo leer la marca"));
 });
 if(row){
  row.status="failed";
  row.error=error.slice(0,400);
  row.attempts=(row.attempts||0)+1;
  store.put(row);
 }
 await txDone(tx);
 db.close();
}

/** Pasa marcas fallidas otra vez a pending (reintento manual). */
export async function requeueFailedPunches():Promise<number>{
 const all=await listQueuedPunches();
 const failed=all.filter(p=>p.status==="failed");
 if(!failed.length)return 0;
 const db=await openDb();
 const tx=db.transaction(STORE,"readwrite");
 const store=tx.objectStore(STORE);
 for(const row of failed){
  store.put({...row,status:"pending" as const,error:""});
 }
 await txDone(tx);
 db.close();
 return failed.length;
}

export async function queueStats():Promise<{pending:number;failed:number;total:number}>{
 const all=await listQueuedPunches();
 const pending=all.filter(p=>p.status==="pending").length;
 const failed=all.filter(p=>p.status==="failed").length;
 return {pending,failed,total:pending+failed};
}

/** Actualiza estado local tras marca online o sync OK / error conocido. */
export async function rememberPunchResult(
 code:string,
 kind:PunchKind,
 result:{ok?:boolean;error?:string}
):Promise<void>{
 const key=normalizeCode(code);
 if(result.ok){
  if(kind==="entry")await setKnownSessionOpen(key,true);
  else if(kind==="exit")await setKnownSessionOpen(key,false);
  return;
 }
 const err=(result.error??"").toLowerCase();
 if(err.includes("entrada abierta"))await setKnownSessionOpen(key,true);
 else if(err.includes("entrada primero")||err.includes("registrar una entrada"))await setKnownSessionOpen(key,false);
}
