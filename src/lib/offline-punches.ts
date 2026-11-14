/** Cola local de marcaciones (IndexedDB) para tablet PWA sin red. */

const DB_NAME="grt-kiosk";
const DB_VERSION=1;
const STORE="punch_queue";

export type QueuedPunch={
 id:string;
 code:string;
 pin:string;
 kind:"entry"|"exit"|"break_start"|"break_end";
 photo:string|null;
 occurredAt:string;
 createdAt:string;
 status:"pending"|"failed";
 error:string;
 attempts:number;
};

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

export async function enqueuePunch(input:Omit<QueuedPunch,"status"|"error"|"attempts"|"createdAt">):Promise<QueuedPunch>{
 const row:QueuedPunch={
  ...input,
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
