import Link from "next/link";
import {requireRole} from "@/lib/auth";
import {Heading,CollapsiblePanel,Table,Empty} from "@/components/admin-ui";
import {ActionForm} from "@/components/action-form";
import {EmployeeSelect} from "@/components/employee-select";
import {AttendanceOtAlert,type AttendanceOtItem} from "@/components/attendance-ot-alert";
import {AckAttendanceAlert} from "@/components/ack-attendance-alert";
import {Badge} from "@/components/ui/badge";
import {createManualSession,deleteAttendanceSession} from "../actions";
import {DeleteAttendance} from "@/components/delete-attendance";
import {AttendancePhotoThumb} from "@/components/attendance-photo-thumb";
import {CorrectSessionForm,type CorrectableSession} from "@/components/correct-session-form";
import {ScrollToSession} from "@/components/scroll-to-session";
import {dateTime,dateCR,todayCR,labels} from "@/lib/format";
import {classifyShift,overtimeHours,type ShiftResult} from "@/lib/shift-cr";

const MAX_OPEN_HOURS=12;
const PHOTO_EAGER_MS=24*60*60*1000;
const isDate=(v:unknown):v is string=>typeof v==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v));
const addDays=(date:string,days:number)=>{const d=new Date(date+"T00:00:00Z");d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10)};
const startCR=(date:string)=>new Date(date+"T00:00:00-06:00").toISOString();
const openHours=(start:string)=>(Date.now()-new Date(start).getTime())/3600000;
const photoEager=(occurredAt:string,now:number)=>now-new Date(occurredAt).getTime()<PHOTO_EAGER_MS;
/** Incluye jornadas que cruzan medianoche (ej. sale el 16 aunque entró el 15). */
function overlapsRange(startedAt:string,endedAt:string|null,from:string,to:string){
 const start=dateCR(startedAt);
 const end=endedAt?dateCR(endedAt):start;
 return end>=from&&start<=to;
}

export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const {client}=await requireRole("admin");
 const params=await searchParams;
 const today=todayCR();
 let from=isDate(params.desde)?params.desde:today;
 let to=isDate(params.hasta)?params.hasta:today;
 if(from>to)[from,to]=[to,from];
 const employee=typeof params.empleado==="string"&&/^[0-9a-f-]{36}$/i.test(params.empleado)?params.empleado:"";
 const focusSession=typeof params.sesion==="string"&&/^[0-9a-f-]{36}$/i.test(params.sesion)?params.sesion:"";

 // Buffer −1 día: jornadas nocturnas que empiezan el día anterior y terminan en el rango.
 let query=client.from("effective_sessions").select("*")
  .gte("started_at",startCR(addDays(from,-1)))
  .lt("started_at",startCR(addDays(to,1)))
  .order("started_at",{ascending:false})
  .limit(500);
 let eventsQuery=client.from("attendance_events").select("id,session_id,employee_id,kind,occurred_at,punch_photos(status)")
  .gte("occurred_at",startCR(addDays(from,-1)))
  .lt("occurred_at",startCR(addDays(to,2)))
  .order("occurred_at")
  .limit(3000);
 if(employee){query=query.eq("employee_id",employee);eventsQuery=eventsQuery.eq("employee_id",employee)}

 const [sessions,open,emp,events,otRpc,acks]=await Promise.all([
  query,
  client.from("effective_sessions").select("*").is("ended_at",null).order("started_at"),
  client.from("employees").select("id,code,full_name").order("full_name"),
  eventsQuery,
  client.rpc("list_attendance_ot_alerts",{p_from:from,p_to:to}),
  client.from("attendance_alert_acks").select("kind,ref_id").in("kind",["missing_photo","missing_exit"]),
 ]);
 if(sessions.error||open.error||emp.error||events.error)throw new Error("No se pudo cargar la asistencia");
 function sessionShift(_employeeId:string,startedAt:string,endedAt:string|null):ShiftResult|null{
  if(!endedAt)return null;
  try{return classifyShift(startedAt,endedAt)}catch{return null}
 }

 const ackedPhoto=new Set((acks.data??[]).filter(a=>a.kind==="missing_photo").map(a=>a.ref_id));
 const ackedExit=new Set((acks.data??[]).filter(a=>a.kind==="missing_exit").map(a=>a.ref_id));

 type PunchEvent={id:string;session_id:string;employee_id:string;kind:string;occurred_at:string;photo:string|null};
 const punches:PunchEvent[]=(events.data??[]).map(ev=>{
  const p=Array.isArray(ev.punch_photos)?ev.punch_photos[0]:ev.punch_photos;
  return {id:ev.id,session_id:ev.session_id,employee_id:ev.employee_id,kind:ev.kind,occurred_at:ev.occurred_at,photo:(p as {status?:string}|null)?.status??null};
 });
 const bySession=new Map<string,PunchEvent[]>();
 for(const p of punches)bySession.set(p.session_id,[...(bySession.get(p.session_id)??[]),p]);
 const noPhoto=punches.filter(p=>p.photo==="missing"&&p.occurred_at<startCR(addDays(to,1))&&!ackedPhoto.has(p.id));
 const names=new Map(emp.data?.map(e=>[e.id,`${e.full_name} (${e.code})`]));
 const missingExit=(s:{ended_at:string|null;started_at:string})=>!s.ended_at&&(s.started_at<startCR(today)||openHours(s.started_at)>MAX_OPEN_HOURS);
 const alerts=(open.data??[]).filter(s=>missingExit(s)&&!ackedExit.has(s.id)&&(!employee||s.employee_id===employee));
 const rows=(sessions.data??[]).filter(s=>overlapsRange(s.started_at,s.ended_at,from,to));
 const correctable=[...alerts,...rows.filter(r=>!alerts.some(a=>a.id===r.id))];
 const correctableOptions:CorrectableSession[]=correctable.map(s=>{
  const breakMin=Math.round(Number(s.break_seconds??0)/60);
  const range=s.ended_at
   ?`${dateTime(s.started_at)} → ${dateTime(s.ended_at)}`
   :`${dateTime(s.started_at)} · sin salida`;
  const flags=[
   missingExit(s)?"⚠ Sin salida":"",
   s.adjusted?"Ajustada":"",
  ].filter(Boolean).join(" · ");
  return {
   id:s.id,
   label:`${flags?flags+" · ":""}${names.get(s.employee_id)??"Empleado"} · ${range}`,
   started_at:s.started_at,
   ended_at:s.ended_at,
   break_minutes:breakMin,
  };
 });
 const link=(desde:string,hasta:string)=>`/admin/asistencia?${new URLSearchParams({desde,hasta,...(employee?{empleado:employee}:{})})}`;
 const presets=[
  {label:"Hoy",from:today,to:today},
  {label:"Ayer",from:addDays(today,-1),to:addDays(today,-1)},
  {label:"Últimos 7 días",from:addDays(today,-6),to:today},
  {label:"Este mes",from:today.slice(0,8)+"01",to:today},
 ];

 const otData=otRpc.data&&typeof otRpc.data==="object"?otRpc.data as {
  items?:AttendanceOtItem[];people?:number;ot_hours?:number;
 }:null;
 let otItems=(otData?.items??[]) as AttendanceOtItem[];
 if(employee)otItems=otItems.filter(i=>i.employee_id===employee);
 const otPeople=employee
  ?(otItems.length?1:0)
  :Number(otData?.people??0);
 const otHoursTotal=otItems.reduce((s,i)=>s+Number(i.ot_hours||0),0);
 const photoNow=Date.now();

 return <>
  {focusSession?<ScrollToSession sessionId={focusSession}/>:null}
  <Heading
   title="Asistencia"
   description="Revisa jornadas (diurna / mixta / nocturna según legislación CR). Las extras se calculan sobre 8h, 7h o 6h según el tipo de jornada."
   actions={
    <div className="attendance-toolbar-filters">
     <div className="attendance-filter-presets" role="group" aria-label="Filtros rápidos">
      {presets.map(p=>(
       <Link key={p.label} href={link(p.from,p.to)} className={`badge${p.from===from&&p.to===to?" selected":""}`}>{p.label}</Link>
      ))}
     </div>
     <form className="attendance-filters" method="get">
      <label>Desde<input type="date" name="desde" defaultValue={from} max={today}/></label>
      <label>Hasta<input type="date" name="hasta" defaultValue={to} max={today}/></label>
      <label>Empleado
       <select name="empleado" defaultValue={employee}>
        <option value="">Todos</option>
        {emp.data?.map(e=><option key={e.id} value={e.id}>{e.full_name} ({e.code})</option>)}
       </select>
      </label>
      <button type="submit" className="secondary">Filtrar</button>
     </form>
    </div>
   }
  />

  <AttendanceOtAlert items={otItems} people={otPeople} otHours={otHoursTotal}/>

  {alerts.length>0&&(
   <section className="panel attendance-alerts" role="alert">
    <h2>⚠ {alerts.length===1?"1 jornada sin marca de salida":`${alerts.length} jornadas sin marca de salida`}</h2>
    <p className="muted small">
     Estas jornadas son de días anteriores o llevan más de {MAX_OPEN_HOURS} horas abiertas.
     Hacé clic en la fila para filtrar esa jornada; o aceptá el aviso si ya la revisaste.
    </p>
    <Table headers={["Empleado","Entrada","Tiempo abierta","Acción"]}>
     {alerts.map(s=>{
      const day=dateCR(s.started_at);
      const filterHref=`/admin/asistencia?${new URLSearchParams({
       desde:day,
       hasta:day,
       empleado:s.employee_id,
       sesion:s.id,
      })}`;
      const active=focusSession===s.id;
      return (
       <tr key={s.id} className={active?"alert-exit-row is-active":"alert-exit-row"}>
        <td>
         <Link href={filterHref} className="alert-exit-filter-link">
          <strong>{names.get(s.employee_id)}</strong>
         </Link>
        </td>
        <td>
         <Link href={filterHref} className="alert-exit-filter-link">{dateTime(s.started_at)}</Link>
        </td>
        <td>
         <Link href={filterHref} className="alert-exit-filter-link">
          <span className="badge pending">{Math.floor(openHours(s.started_at))} h sin salida</span>
          <span className="muted small"> · Ver jornada</span>
         </Link>
        </td>
        <td className="alert-row-actions">
         <AckAttendanceAlert kind="missing_exit" refId={s.id} label="Aceptar aviso"/>
        </td>
       </tr>
      );
     })}
    </Table>
   </section>
  )}

  {noPhoto.length>0&&(
   <section className="panel attendance-alerts">
    <h2>📷 {noPhoto.length===1?"1 marca sin foto":`${noPhoto.length} marcas sin foto`} en este rango</h2>
    <p className="muted small">La cámara de la tablet no estaba disponible al marcar. Confirmá con el empleado y aceptá el aviso si la marca es válida.</p>
    <Table headers={["Empleado","Marca","Hora","Acción"]}>
     {noPhoto.map(p=>(
      <tr key={p.id}>
       <td><strong>{names.get(p.employee_id)}</strong></td>
       <td>{labels[p.kind]}</td>
       <td>{dateTime(p.occurred_at)}</td>
       <td className="alert-row-actions">
        <AckAttendanceAlert kind="missing_photo" refId={p.id} label="Aceptar aviso"/>
       </td>
      </tr>
     ))}
    </Table>
   </section>
  )}

  <CollapsiblePanel
   title={from===to?`Jornadas del ${from}`:`Jornadas del ${from} al ${to}`}
   open
  >
   {focusSession?(
    <p className="muted small" style={{marginTop:0}}>
     Filtrado desde aviso de salida faltante.
     {" "}
     <Link
      href={`/admin/asistencia?${new URLSearchParams({desde:today,hasta:today})}`}
      className="text-link"
      style={{marginTop:0}}
     >
      Quitar filtro → Hoy
     </Link>
    </p>
   ):null}
   {!rows.length?<Empty text="No hay jornadas en este rango."/>:(
    <Table headers={["Empleado","Fotos","Entrada","Salida","Jornada","Horas","Estado"]}>
     {rows.map(s=>{
      const hours=s.worked_hours===null?null:Number(s.worked_hours);
      const classified=sessionShift(s.employee_id,s.started_at,s.ended_at);
      const ot=classified&&hours!=null?overtimeHours(hours,classified):0;
      const isOt=ot>0;
      const empLabel=names.get(s.employee_id)??"Empleado";
      return (
       <tr
        key={s.id}
        id={focusSession===s.id?`sesion-${s.id}`:undefined}
        className={[isOt?"ot-row":"",focusSession===s.id?"session-focus":""].filter(Boolean).join(" ")||undefined}
       >
        <td>{empLabel}</td>
        <td>
         <div className="photo-thumbs">
          {(bySession.get(s.id)??[]).map(p=>(
           <AttendancePhotoThumb
            key={p.id}
            id={p.id}
            kindLabel={labels[p.kind]??p.kind}
            title={`${labels[p.kind]??p.kind} · ${dateTime(p.occurred_at)}`}
            status={p.photo}
            eager={photoEager(p.occurred_at,photoNow)}
           />
          ))}
         </div>
        </td>
        <td>
         <div className="punch-cell">
          <span>{dateTime(s.started_at)}</span>
          <DeleteAttendance
           sessionId={s.id}
           employeeLabel={empLabel}
           timeLabel={dateTime(s.started_at)}
           mode="entry"
           action={deleteAttendanceSession}
          />
         </div>
        </td>
        <td>
         <div className="punch-cell">
          {s.ended_at?(
           <>
            <span>{dateTime(s.ended_at)}</span>
            <DeleteAttendance
             sessionId={s.id}
             employeeLabel={empLabel}
             timeLabel={dateTime(s.ended_at)}
             mode="exit"
             action={deleteAttendanceSession}
            />
           </>
          ):(
           <span className={missingExit(s)?"text-attention":undefined}>Sin salida</span>
          )}
         </div>
        </td>
        <td>
         {classified?(
          <span title="Según marcación entrada/salida">
           {classified.label}
           <small className="muted"> · lim. {classified.legalOrdinaryLimitHours} h</small>
          </span>
         ):"—"}
        </td>
        <td>
         {hours===null?"—":hours.toFixed(2)}
         {isOt&&<small className="text-attention"> · +{ot.toFixed(2)} h extra</small>}
        </td>
        <td>
         {missingExit(s)?<Badge tone="pending">Falta salida</Badge>:
          isOt?<Badge tone="pending">Con extras</Badge>:
          <Badge tone={s.adjusted?"approved":"pending"}>{s.adjusted?"Ajustada":s.ended_at?"Completa":"En turno"}</Badge>}
        </td>
       </tr>
      );
     })}
    </Table>
   )}
   {rows.length===500&&<p className="muted small">Se muestran las primeras 500 jornadas. Reduce el rango para ver el resto.</p>}
  </CollapsiblePanel>

  <CollapsiblePanel title="Ajustes de jornada">
   <div className="attendance-adjust-block">
    <h3>Registrar jornada faltante</h3>
    <p className="muted small">
     Cuando no hubo marcación en la tablet. Queda como ajustada (sin fotos). Horario Costa Rica.
    </p>
    <ActionForm action={createManualSession} submit="Registrar jornada">
     <EmployeeSelect employees={(emp.data??[]).map(e=>({id:e.id,full_name:e.full_name,code:e.code}))}/>
     <label>Entrada<input name="started_at" type="datetime-local" required/></label>
     <label>Salida<input name="ended_at" type="datetime-local" required/></label>
     <label>Descanso total (minutos)
      <input name="break_minutes" type="number" min={0} max={1440} defaultValue={0} required/>
     </label>
     <label>Motivo
      <input name="reason" minLength={5} maxLength={500} required placeholder="No marcó en tablet · jornada 16–17 nov"/>
     </label>
    </ActionForm>
   </div>
   <div className="attendance-adjust-block">
    <h3>Corregir una jornada existente</h3>
    <p className="muted small">
     Podés ajustar la misma jornada más de una vez. Al elegirla se cargan entrada/salida actuales (hora CR).
     Las jornadas nocturnas se listan con ambas fechas (ej. 15/11 10:11 p. m. → 16/11 5:09 a. m.).
    </p>
    <CorrectSessionForm sessions={correctableOptions}/>
   </div>
  </CollapsiblePanel>
 </>;
}
