"use client";
import {useEffect,useRef,useState} from "react";import {LogIn,LogOut,CircleCheck,CircleX,Camera,CameraOff} from "lucide-react";import {punch} from "./actions";
const kinds=[{id:"entry",name:"Entrada",icon:LogIn},{id:"exit",name:"Salida",icon:LogOut}] as const;
const PHOTO_W=480,PHOTO_H=360;
const requestCamera=()=>navigator.mediaDevices?navigator.mediaDevices.getUserMedia({video:{facingMode:"user",width:{ideal:640},height:{ideal:480}},audio:false}):Promise.reject(new Error("Cámara no soportada"));
export function Kiosk(){
 const [clock,setClock]=useState("");const [code,setCode]=useState("");const [pin,setPin]=useState("");const [kind,setKind]=useState<string>("entry");
 const [busy,setBusy]=useState(false);const [message,setMessage]=useState<{error?:string;ok?:boolean;at?:string;kind?:string;photoUrl?:string|null}>({});
 const [camera,setCamera]=useState<"pending"|"ready"|"unavailable">("pending");
 const open=Boolean(message.ok||message.error);const close=()=>setMessage({});
 const request=useRef<{key:string;id:string}|null>(null);const submitting=useRef(false);
 const video=useRef<HTMLVideoElement>(null);const stream=useRef<MediaStream|null>(null);
 async function attach(s:MediaStream){stream.current=s;if(video.current){video.current.srcObject=s;await video.current.play();}}
 async function startCamera(){
  if(stream.current?.getVideoTracks().some(t=>t.readyState==="live"))return true;
  try{await attach(await requestCamera());setCamera("ready");return true;}
  catch{setCamera("unavailable");return false;}
 }
 function capture(){
  const v=video.current;if(!v||v.readyState<2||!v.videoWidth)return null;
  const scale=Math.min(v.videoWidth/PHOTO_W,v.videoHeight/PHOTO_H);const sw=PHOTO_W*scale,sh=PHOTO_H*scale;
  const canvas=document.createElement("canvas");canvas.width=PHOTO_W;canvas.height=PHOTO_H;
  canvas.getContext("2d")?.drawImage(v,(v.videoWidth-sw)/2,(v.videoHeight-sh)/2,sw,sh,0,0,PHOTO_W,PHOTO_H);
  return canvas.toDataURL("image/jpeg",0.7);
 }
 useEffect(()=>{let cancelled=false;
  requestCamera().then(async s=>{if(cancelled){s.getTracks().forEach(t=>t.stop());return}await attach(s);setCamera("ready")}).catch(()=>{if(!cancelled)setCamera("unavailable")});
  return()=>{cancelled=true;stream.current?.getTracks().forEach(t=>t.stop());stream.current=null}},[]);
 useEffect(()=>{
  const tick=()=>{
   const parts=new Intl.DateTimeFormat("en-US",{timeZone:"America/Costa_Rica",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:true}).formatToParts(new Date());
   const get=(t:string)=>parts.find(p=>p.type===t)?.value??"";
   const suffix=/^a/i.test(get("dayPeriod"))?"a. m.":"p. m.";
   setClock(`${get("hour")}:${get("minute")}:${get("second")} ${suffix}`);
  };
  tick();const id=setInterval(tick,1000);return ()=>clearInterval(id);
 },[]);
 useEffect(()=>{if(!open)return;const id=setTimeout(()=>setMessage({}),message.ok?6000:10000);const onKey=(e:KeyboardEvent)=>{if(e.key==="Escape")setMessage({})};window.addEventListener("keydown",onKey);return()=>{clearTimeout(id);window.removeEventListener("keydown",onKey)}},[open,message.ok]);
 async function submit(e:React.FormEvent){e.preventDefault();if(submitting.current)return;
 if(!navigator.onLine){setMessage({error:"Sin conexión. No se ha registrado la marca. Comunícate con el administrador."});return;}
 submitting.current=true;setBusy(true);setMessage({});const key=JSON.stringify([code,pin,kind]);
 if(request.current?.key!==key)request.current={key,id:crypto.randomUUID()};
 try{const shot=await startCamera()?capture():null;
 const result=await punch({code,pin,kind,requestId:request.current.id,photo:shot?.split(",")[1]??null});
 setMessage({...result,kind:kinds.find(k=>k.id===kind)?.name,photoUrl:result.ok&&result.photo?shot:null});
 setCode("");setPin("");request.current=null;if(result.ok)setKind("entry");}
 catch{setMessage({error:"No se confirmó la marcación. Reintenta con los mismos datos."});}
 finally{submitting.current=false;setBusy(false);}
 }
 return <main className="kiosk kiosk-light"><video ref={video} className="camera-feed" playsInline muted aria-hidden="true"/><div className="kiosk-body">
 <div className="kiosk-brand">
  <img src="/logo-grt.png" alt="Gasolinera Río Tempisque" className="kiosk-logo" width={160} height={90} decoding="async"/>
 </div>
 <p className="eyebrow">BIENVENIDO A TU JORNADA</p><div className="clock" aria-label="Hora local">{clock||"--:--:--"}</div><p className="muted">Hora de Costa Rica · La marca se confirma con la hora del servidor</p><form onSubmit={submit} className="kiosk-form" autoComplete="off"><div className="two-col"><label>Código de empleado<input name="employee-code" value={code} onChange={e=>setCode(e.target.value.toUpperCase())} placeholder="1" maxLength={12} autoComplete="off" spellCheck={false} data-lpignore="true" data-1p-ignore required disabled={busy}/></label><label>PIN personal<input name="employee-pin" value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,""))} type="password" inputMode="numeric" minLength={4} maxLength={4} autoComplete="new-password" data-lpignore="true" data-1p-ignore placeholder="••••" required disabled={busy}/></label></div><div className="punch-options">{kinds.map(k=><button type="button" key={k.id} className={kind===k.id?"selected":""} aria-pressed={kind===k.id} disabled={busy} onClick={()=>setKind(k.id)}><k.icon size={40}/>{k.name}</button>)}</div>
 {camera==="unavailable"?<p className="camera-notice warning"><CameraOff size={18}/>Cámara no disponible. La marca se registrará sin foto y se notificará al administrador.</p>:<p className="camera-notice"><Camera size={18}/>Al confirmar se tomará una foto como evidencia de tu marcación.</p>}
 <button className="primary wide" disabled={busy}>{busy?"Registrando…":"Confirmar marcación"}</button></form><p className="small muted">No compartas tu PIN. Si olvidaste una marca, consulta al administrador.</p><p className="small"><a href="/operaciones">Tareas del turno →</a></p></div>{open&&<div className="punch-modal-backdrop" onClick={close}><div className={`punch-modal ${message.ok?"success":"error"}`} role="alertdialog" aria-modal="true" aria-labelledby="punch-modal-title" aria-describedby="punch-modal-text" onClick={e=>e.stopPropagation()}>{message.ok&&message.photoUrl?<img src={message.photoUrl} alt="Foto tomada como evidencia de la marcación" className="punch-photo"/>:message.ok?<CircleCheck size={72}/>:<CircleX size={72}/>}<h2 id="punch-modal-title">{message.ok?"Marcación registrada":"No se registró la marca"}</h2><p id="punch-modal-text">{message.ok?<>{message.kind} registrada a las <strong>{new Intl.DateTimeFormat("es-CR",{timeZone:"America/Costa_Rica",hour:"2-digit",minute:"2-digit"}).format(new Date(message.at!))}</strong>.</>:message.error}</p>{message.ok&&!message.photoUrl&&<p className="small muted">La marca se guardó sin foto. El administrador verá una alerta.</p>}<button className="primary wide" onClick={close} autoFocus>Aceptar</button></div></div>}</main>;
}
