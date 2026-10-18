"use client";
import {useRef,useState} from "react";
import {useRouter} from "next/navigation";
import {ActionForm} from "@/components/action-form";
import {Camera,CameraOff,ClipboardCheck,LogOut,TriangleAlert} from "lucide-react";
import {completeTask,endOpsSession,reportIncident,startOpsSession,toggleChecklist} from "./actions";
import type {OpsTask} from "@/lib/ops";

const PHOTO_W=480,PHOTO_H=360;
const requestCamera=()=>navigator.mediaDevices?navigator.mediaDevices.getUserMedia({video:{facingMode:"user",width:{ideal:640},height:{ideal:480}},audio:false}):Promise.reject(new Error("no cam"));

type Props={needsLogin:boolean;tasks:OpsTask[];employeeName?:string};

export function OpsTerminal({needsLogin,tasks,employeeName}:Props){
 const router=useRouter();
 const [tab,setTab]=useState<"tasks"|"incident">("tasks");
 const [busy,setBusy]=useState(false);
 const [msg,setMsg]=useState<{error?:string;ok?:string}>({});
 const [active,setActive]=useState<string|null>(null);
 const video=useRef<HTMLVideoElement>(null);const stream=useRef<MediaStream|null>(null);
 const [cam,setCam]=useState<"off"|"on"|"fail">("off");

 async function ensureCam(){
  if(stream.current?.getVideoTracks().some(t=>t.readyState==="live"))return true;
  try{const s=await requestCamera();stream.current=s;if(video.current){video.current.srcObject=s;await video.current.play();}setCam("on");return true;}
  catch{setCam("fail");return false;}
 }
 function capture(){
  const v=video.current;if(!v||v.readyState<2||!v.videoWidth)return null;
  const scale=Math.min(v.videoWidth/PHOTO_W,v.videoHeight/PHOTO_H);const sw=PHOTO_W*scale,sh=PHOTO_H*scale;
  const canvas=document.createElement("canvas");canvas.width=PHOTO_W;canvas.height=PHOTO_H;
  canvas.getContext("2d")?.drawImage(v,(v.videoWidth-sw)/2,(v.videoHeight-sh)/2,sw,sh,0,0,PHOTO_W,PHOTO_H);
  return canvas.toDataURL("image/jpeg",0.7).split(",")[1]??null;
 }

 if(needsLogin){
  return <main className="kiosk"><div className="kiosk-body"><p className="eyebrow">OPERACIONES</p><h1>Identifícate</h1><p className="muted">Usa tu código de empleado y PIN de 4 dígitos para ver las tareas del turno.</p>
   <ActionForm action={startOpsSession} submit="Entrar a operaciones"><label>Código<input name="code" required maxLength={12} autoComplete="off"/></label><label>PIN<input name="pin" type="password" inputMode="numeric" minLength={4} maxLength={4} required autoComplete="off"/></label></ActionForm>
   <p className="small muted"><a href="/marcacion">← Volver a marcación</a></p></div></main>;
 }

 return <main className="kiosk"><video ref={video} className="camera-feed" playsInline muted aria-hidden="true"/>
  <div className="kiosk-body ops-body">
   <header className="ops-top"><div><p className="eyebrow">OPERACIONES</p><h1>{employeeName??"Empleado"}</h1></div>
    <form action={endOpsSession}><button type="submit" className="secondary small-button"><LogOut size={14}/> Salir</button></form></header>
   <div className="ops-tabs"><button type="button" className={tab==="tasks"?"selected":""} onClick={()=>setTab("tasks")}><ClipboardCheck size={18}/> Tareas</button><button type="button" className={tab==="incident"?"selected":""} onClick={()=>setTab("incident")}><TriangleAlert size={18}/> Reportar incidente</button></div>
   {msg.error&&<p className="alert error">{msg.error}</p>}{msg.ok&&<p className="alert success">{msg.ok}</p>}
   {tab==="tasks"&&<>
    {!tasks.length?<p className="empty">No tienes tareas asignadas para hoy. Si esperabas ver alguna, pide al administrador que te la asigne.</p>:tasks.map(t=>{
     const open=active===t.id;
     const needPhoto=(t.checklist??[]).some(c=>c.requires_photo);
     return <section key={t.id} className="panel ops-task"><button type="button" className="ops-task-head" onClick={()=>setActive(open?null:t.id)}><strong>{t.title}</strong><span className="badge">{t.status}</span></button>
      {open&&<div className="ops-task-body"><p className="muted small">{t.area} · vence {new Date(t.due_at).toLocaleTimeString("es-CR",{hour:"2-digit",minute:"2-digit"})}</p>
       <ul className="ops-check">{(t.checklist??[]).map(c=><li key={c.id}><form action={toggleChecklist}><input type="hidden" name="id" value={c.id}/><input type="hidden" name="done" value={String(!c.done)}/><button type="submit" className={c.done?"selected":"secondary"} disabled={t.status==="completed"||t.status==="approved"}>{c.done?"✓":"○"} {c.label}{c.requires_photo?" 📷":""}</button></form></li>)}</ul>
       {t.status!=="completed"&&t.status!=="approved"&&<CompleteForm taskId={t.id} needPhoto={needPhoto} busy={busy} setBusy={setBusy} setMsg={setMsg} ensureCam={ensureCam} capture={capture} cam={cam} onDone={()=>router.refresh()}/>}
      </div>}
     </section>;
    })}
   </>}
   {tab==="incident"&&<IncidentForm busy={busy} setBusy={setBusy} setMsg={setMsg} ensureCam={ensureCam} capture={capture} cam={cam} onDone={()=>router.refresh()}/>}
   <p className="small muted"><a href="/marcacion">Ir a marcación</a></p>
  </div>
 </main>;
}

function CompleteForm({taskId,needPhoto,busy,setBusy,setMsg,ensureCam,capture,cam,onDone}:{taskId:string;needPhoto:boolean;busy:boolean;setBusy:(v:boolean)=>void;setMsg:(v:{error?:string;ok?:string})=>void;ensureCam:()=>Promise<boolean>;capture:()=>string|null;cam:string;onDone:()=>void}){
 const [comment,setComment]=useState("");
 return <div className="ops-complete">
  {needPhoto&&(cam==="fail"?<p className="camera-notice warning"><CameraOff size={16}/> Cámara no disponible</p>:<p className="camera-notice"><Camera size={16}/> Se tomará foto al enviar</p>)}
  <label>Comentario (opcional)<input value={comment} onChange={e=>setComment(e.target.value)} maxLength={500} disabled={busy}/></label>
  <button className="primary wide" disabled={busy} onClick={async()=>{setBusy(true);setMsg({});const photo=needPhoto&&await ensureCam()?capture():null;const r=await completeTask({taskId,comment,photo});setBusy(false);if(r.error)setMsg({error:r.error});else{setMsg({ok:"Tarea enviada a revisión."});onDone();}}}>{busy?"Enviando…":"Marcar como completada"}</button>
 </div>;
}

function IncidentForm({busy,setBusy,setMsg,ensureCam,capture,cam,onDone}:{busy:boolean;setBusy:(v:boolean)=>void;setMsg:(v:{error?:string;ok?:string})=>void;ensureCam:()=>Promise<boolean>;capture:()=>string|null;cam:string;onDone:()=>void}){
 const [category,setCategory]=useState("Dispensador");
 const [severity,setSeverity]=useState("medium");
 const [title,setTitle]=useState("");
 const [description,setDescription]=useState("");
 return <section className="panel"><h2>Reportar incidente</h2>
  {cam==="fail"?<p className="camera-notice warning"><CameraOff size={16}/> Sin cámara: el reporte se enviará sin foto</p>:<p className="camera-notice"><Camera size={16}/> Se adjuntará una foto</p>}
  <label>Categoría<select value={category} onChange={e=>setCategory(e.target.value)}>{["Dispensador","Derrame","Seguridad","Caja","Tienda","Mantenimiento","Otro"].map(c=><option key={c}>{c}</option>)}</select></label>
  <label>Severidad<select value={severity} onChange={e=>setSeverity(e.target.value)}><option value="low">Baja</option><option value="medium">Media</option><option value="high">Alta</option><option value="critical">Crítica</option></select></label>
  <label>Título<input value={title} onChange={e=>setTitle(e.target.value)} required minLength={3} maxLength={160}/></label>
  <label>Descripción<textarea value={description} onChange={e=>setDescription(e.target.value)} rows={3} maxLength={1000}/></label>
  <button className="primary wide" disabled={busy||title.trim().length<3} onClick={async()=>{setBusy(true);setMsg({});const photo=await ensureCam()?capture():null;const r=await reportIncident({category,severity,title,description,photo});setBusy(false);if(r.error)setMsg({error:r.error});else{setMsg({ok:"Incidente registrado."});setTitle("");setDescription("");onDone();}}}>{busy?"Enviando…":"Enviar incidente"}</button>
 </section>;
}
