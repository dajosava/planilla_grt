import Link from "next/link";
import {requireRole} from "@/lib/auth";
import {Heading,Panel,CollapsiblePanel,Table,Empty} from "@/components/admin-ui";
import {ActionForm} from "@/components/action-form";
import {AttendanceOtAlert,type AttendanceOtItem} from "@/components/attendance-ot-alert";
import {AckAttendanceAlert} from "@/components/ack-attendance-alert";
import {Badge} from "@/components/ui/badge";
import {correctSession,deleteAttendanceSession} from "../actions";
import {DeleteAttendance} from "@/components/delete-attendance";
import {AttendancePhotoThumb} from "@/components/attendance-photo-thumb";
import {dateTime,todayCR,labels} from "@/lib/format";
import {classifyShift,overtimeHours,type ShiftResult} from "@/lib/shift-cr";

const MAX_OPEN_HOURS=12;
const PHOTO_EAGER_MS=24*60*60*1000;
const isDate=(v:unknown):v is string=>typeof v==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v));
const addDays=(date:string,days:number)=>{const d=new Date(date+"T00:00:00Z");d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10)};
const startCR=(date:string)=>new Date(date+"T00:00:00-06:00").toISOString();
const openHours=(start:string)=>(Date.now()-new Date(start).getTime())/3600000;
const photoEager=(occurredAt:string,now:number)=>now-new Date(occurredAt).getTime()<PHOTO_EAGER_MS;

export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const {client}=await requireRole("admin");
 const params=await searchParams;
 const today=todayCR();
 let from=isDate(params.desde)?params.desde:addDays(today,-6);
 let to=isDate(params.hasta)?params.hasta:today;
 if(from>to)[from,to]=[to,from];
 const employee=typeof params.empleado==="string"&&/^[0-9a-f-]{36}$/i.test(params.empleado)?params.empleado:"";

 let query=client.from("effective_sessions").select("*").gte("started_at",startCR(from)).lt("started_at",startCR(addDays(to,1))).order("started_at",{ascending:false}).limit(500);
 let eventsQuery=client.from("attendance_events").select("id,session_id,employee_id,kind,occurred_at,punch_photos(status)").gte("occurred_at",startCR(from)).lt("occurred_at",startCR(addDays(to,2))).order("occurred_at").limit(3000);
 if(employee){query=query.eq("employee_id",employee);eventsQuery=eventsQuery.eq("employee_id",employee)}

 const [sessions,open,emp,events,otRpc,acks,shiftsRes]=await Promise.all([
  query,
  client.from("effective_sessions").select("*").is("ended_at",null).order("started_at"),
  client.from("employees").select("id,code,full_name").order("full_name"),
  eventsQuery,
  client.rpc("list_attendance_ot_alerts",{p_from:from,p_to:to}),
  client.from("attendance_alert_acks").select("kind,ref_id").in("kind",["missing_photo","missing_exit"]),
  client.from("shifts").select("employee_id,starts_at,ends_at")
   .lt("starts_at",startCR(addDays(to,2)))
   .gt("ends_at",startCR(addDays(from,-1))),
 ]);
 if(sessions.error||open.error||emp.error||events.error)throw new Error("No se pudo cargar la asistencia");
 const shiftsByEmp=new Map<string,{starts_at:string;ends_at:string}[]>();
 for(const sh of shiftsRes.data??[]){
  const list=shiftsByEmp.get(sh.employee_id)??[];
  list.push({starts_at:sh.starts_at,ends_at:sh.ends_at});
  shiftsByEmp.set(sh.employee_id,list);
 }
 function sessionShift(employeeId:string,startedAt:string,endedAt:string|null):{shift:ShiftResult;scheduled:boolean}|null{
  if(!endedAt)return null;
  const assigned=(shiftsByEmp.get(employeeId)??[]).find(sh=>{
   const a=new Date(sh.starts_at).getTime();
   const b=new Date(sh.ends_at).getTime();
   const s=new Date(startedAt).getTime();
   const e=new Date(endedAt).getTime();
   return a<e&&b>s;
  });
  try{
   if(assigned)return {shift:classifyShift(assigned.starts_at,assigned.ends_at),scheduled:true};
   return {shift:classifyShift(startedAt,endedAt),scheduled:false};
  }catch{return null}
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
 const alerts=(open.data??[]).filter(s=>missingExit(s)&&!ackedExit.has(s.id));
 const rows=sessions.data??[];
 const correctable=[...alerts,...rows.filter(r=>!alerts.some(a=>a.id===r.id))];
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
    <p className="muted small">Estas jornadas son de días anteriores o llevan más de {MAX_OPEN_HOURS} horas abiertas. Corrígelas abajo o aceptá el aviso si ya lo revisaste.</p>
    <Table headers={["Empleado","Entrada","Tiempo abierta","Acción"]}>
     {alerts.map(s=>(
      <tr key={s.id}>
       <td><strong>{names.get(s.employee_id)}</strong></td>
       <td>{dateTime(s.started_at)}</td>
       <td><span className="badge danger">{Math.floor(openHours(s.started_at))} h sin salida</span></td>
       <td className="alert-row-actions">
        <AckAttendanceAlert kind="missing_exit" refId={s.id} label="Aceptar aviso"/>
       </td>
      </tr>
     ))}
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

  <Panel title={from===to?`Jornadas del ${from}`:`Jornadas del ${from} al ${to}`}>
   {!rows.length?<Empty text="No hay jornadas en este rango."/>:(
    <Table headers={["Empleado","Fotos","Entrada","Salida","Jornada","Horas","Estado"]}>
     {rows.map(s=>{
      const hours=s.worked_hours===null?null:Number(s.worked_hours);
      const classified=sessionShift(s.employee_id,s.started_at,s.ended_at);
      const ot=classified&&hours!=null?overtimeHours(hours,classified.shift):0;
      const isOt=ot>0;
      const empLabel=names.get(s.employee_id)??"Empleado";
      return (
       <tr key={s.id} className={isOt?"ot-row":undefined}>
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
           <span className={missingExit(s)?"text-danger":undefined}>Sin salida</span>
          )}
         </div>
        </td>
        <td>
         {classified?(
          <span title={classified.scheduled?"Según turno asignado":"Sin turno asignado · revisión recomendada"}>
           {classified.shift.label}
           <small className="muted"> · lim. {classified.shift.legalOrdinaryLimitHours} h{classified.scheduled?"":" · sin turno"}</small>
          </span>
         ):"—"}
        </td>
        <td>
         {hours===null?"—":hours.toFixed(2)}
         {isOt&&<small className="text-danger"> · +{ot.toFixed(2)} h extra</small>}
        </td>
        <td>
         {missingExit(s)?<Badge tone="danger">Falta salida</Badge>:
          isOt?<Badge tone="danger">Con extras</Badge>:
          <Badge tone={s.adjusted?"approved":"pending"}>{s.adjusted?"Ajustada":s.ended_at?"Completa":"En turno"}</Badge>}
        </td>
       </tr>
      );
     })}
    </Table>
   )}
   {rows.length===500&&<p className="muted small">Se muestran las primeras 500 jornadas. Reduce el rango para ver el resto.</p>}
  </Panel>

  <CollapsiblePanel title="Corregir una jornada">
   <p className="muted small">El ajuste deja un motivo y el usuario responsable. Para cambios posteriores, consulta el historial de auditoría.</p>
   <ActionForm action={correctSession}>
    <label>Jornada
     <select name="session_id" defaultValue="" required>
      <option value="" disabled>Selecciona una jornada</option>
      {correctable.map(s=>(
       <option value={s.id} key={s.id}>
        {missingExit(s)?"⚠ Sin salida · ":""}{names.get(s.employee_id)} · {dateTime(s.started_at)}
       </option>
      ))}
     </select>
    </label>
    <label>Entrada correcta<input name="started_at" type="datetime-local" required/></label>
    <label>Salida correcta<input name="ended_at" type="datetime-local" required/></label>
    <label>Descanso total (minutos)<input name="break_minutes" type="number" defaultValue="0" min="0" max="1440" required/></label>
    <label>Motivo<input name="reason" minLength={5} maxLength={500} required/></label>
   </ActionForm>
  </CollapsiblePanel>
 </>;
}
