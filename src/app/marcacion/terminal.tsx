"use client";
import {useEffect,useRef,useState} from "react";import {LogIn,LogOut,Coffee,Play,ShieldCheck} from "lucide-react";import {punch} from "./actions";
const kinds=[{id:"entry",name:"Entrada",icon:LogIn},{id:"exit",name:"Salida",icon:LogOut},{id:"break_start",name:"Iniciar descanso",icon:Coffee},{id:"break_end",name:"Finalizar descanso",icon:Play}] as const;
export function Kiosk(){
 const [clock,setClock]=useState("");const [code,setCode]=useState("");const [pin,setPin]=useState("");const [kind,setKind]=useState<string>("entry");
 const [busy,setBusy]=useState(false);const [message,setMessage]=useState<{error?:string;ok?:boolean;at?:string}>({});
 const request=useRef<{key:string;id:string}|null>(null);const submitting=useRef(false);
 useEffect(()=>{const tick=()=>setClock(new Intl.DateTimeFormat("es-CR",{timeZone:"America/Costa_Rica",hour:"2-digit",minute:"2-digit",second:"2-digit"}).format(new Date()));tick();const id=setInterval(tick,1000);return ()=>clearInterval(id)},[]);
 useEffect(()=>{if(!message.ok)return;const id=setTimeout(()=>setMessage({}),8000);return()=>clearTimeout(id)},[message]);
 async function submit(e:React.FormEvent){e.preventDefault();if(submitting.current)return;
 if(!navigator.onLine){setMessage({error:"Sin conexión. No se ha registrado la marca. Comunícate con el administrador."});return;}
 submitting.current=true;setBusy(true);setMessage({});const key=JSON.stringify([code,pin,kind]);
 if(request.current?.key!==key)request.current={key,id:crypto.randomUUID()};
 try{const result=await punch({code,pin,kind,requestId:request.current.id});setMessage(result);
 if(result.ok){setCode("");setPin("");setKind("entry");request.current=null;}}
 catch{setMessage({error:"No se confirmó la marcación. Reintenta con los mismos datos."});}
 finally{submitting.current=false;setBusy(false);}
 }
 return <main className="kiosk"><header className="kiosk-header"><div className="brand"><div className="brand-mark">GRT</div><div><strong>Gasolinera Río Tempisque</strong><span>Terminal de asistencia</span></div></div><span className="badge"><ShieldCheck size={15}/> Terminal autorizada</span></header><div className="kiosk-body"><p className="eyebrow">BIENVENIDO A TU JORNADA</p><div className="clock" aria-label="Hora local">{clock||"--:--:--"}</div><p className="muted">Hora de Costa Rica · La marca se confirma con la hora del servidor</p><form onSubmit={submit} className="kiosk-form"><div className="two-col"><label>Código de empleado<input value={code} onChange={e=>setCode(e.target.value.toUpperCase())} placeholder="GRT001" maxLength={12} autoComplete="off" required disabled={busy}/></label><label>PIN personal<input value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,""))} type="password" inputMode="numeric" minLength={6} maxLength={8} autoComplete="off" required disabled={busy}/></label></div><div className="punch-options">{kinds.map(k=><button type="button" key={k.id} className={kind===k.id?"selected":""} aria-pressed={kind===k.id} disabled={busy} onClick={()=>setKind(k.id)}><k.icon size={26}/>{k.name}</button>)}</div><button className="primary wide" disabled={busy}>{busy?"Registrando…":"Confirmar marcación"}</button><div aria-live="polite">{message.error&&<p className="alert error">{message.error}</p>}{message.ok&&<p className="alert success">✓ Marcación registrada a las {new Intl.DateTimeFormat("es-CR",{timeZone:"America/Costa_Rica",hour:"2-digit",minute:"2-digit"}).format(new Date(message.at!))}.</p>}</div></form><p className="small muted">No compartas tu PIN. Si olvidaste una marca, consulta al administrador.</p></div></main>;
}
