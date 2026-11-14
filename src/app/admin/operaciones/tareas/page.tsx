import Link from "next/link";
import {requireRole} from "@/lib/auth";
import {Heading,Panel,CollapsiblePanel,Empty,Table} from "@/components/admin-ui";
import {ActionForm} from "@/components/action-form";
import {ChecklistEditor} from "@/components/checklist-editor";
import {OpsNavBar} from "@/components/ops-nav-bar";
import {DeleteOpsTask} from "@/components/delete-ops-task";
import {assignTask,createAdHocTask,deleteTask,reviewTask} from "../../ops-actions";
import {OPS_AREAS} from "@/lib/ops";
import {dateOnly,dateTime,todayCR} from "@/lib/format";

const statusLabel:Record<string,string>={pending:"Pendiente",in_progress:"En progreso",completed:"Completada",approved:"Aprobada",rejected:"Rechazada"};

type Emp={id:string;full_name:string;code:string};
type Item={done:boolean};

const isDate=(v:unknown):v is string=>typeof v==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v+"T12:00:00Z"));
function addDays(iso:string,n:number){
 const d=new Date(iso+"T12:00:00Z");
 d.setUTCDate(d.getUTCDate()+n);
 return d.toISOString().slice(0,10);
}
function monthBounds(ym:string){
 const start=`${ym}-01`;
 const next=addDays(start,32).slice(0,8)+"01";
 return {start,end:addDays(next,-1)};
}
function yearBounds(year:string){
 return {start:`${year}-01-01`,end:`${year}-12-31`};
}
function qs(desde:string,hasta:string){
 return `/admin/operaciones/tareas?${new URLSearchParams({desde,hasta})}`;
}

export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const {client}=await requireRole("admin");
 const params=await searchParams;
 const today=todayCR();
 const month=today.slice(0,7);
 const year=today.slice(0,4);
 const monthRange=monthBounds(month);
 const yearRange=yearBounds(year);

 let from=isDate(params.desde)?params.desde:"";
 let to=isDate(params.hasta)?params.hasta:"";
 if(!from&&!to&&isDate(params.fecha)){from=params.fecha;to=params.fecha}
 if(!from)from=today;
 if(!to)to=from;
 if(from>to)[from,to]=[to,from];

 const [{data,error},{data:employees}] = await Promise.all([
  client.from("tasks")
   .select("*,assignee:assigned_employee_id(id,full_name,code),completed:completed_by(full_name),task_checklist_items(id,label,done,requires_photo)")
   .gte("run_date",from)
   .lte("run_date",to)
   .order("run_date",{ascending:false})
   .order("due_at")
   .limit(500),
  client.from("employees").select("id,full_name,code").eq("active",true).order("full_name")
 ]);
 if(error)throw new Error("No se pudieron cargar las tareas");
 const staff=(employees??[]) as Emp[];
 const sameDay=from===to;
 const rangeLabel=sameDay?dateOnly(from):`${dateOnly(from)} → ${dateOnly(to)}`;
 const isToday=from===today&&to===today;
 const isMonth=from===monthRange.start&&to===monthRange.end;
 const isYear=from===yearRange.start&&to===yearRange.end;

 return <>
  <Heading title="Tareas" description="Asigna cada tarea a un empleado. En la tablet solo verá las suyas. Luego aprueba o rechaza las completadas."/>
  <OpsNavBar/>
  <CollapsiblePanel title="Tarea ocasional">
   <p className="muted small">Para trabajos de una sola vez (no se repiten). Cámara = foto obligatoria. Bitácora = queda para posible impresión.</p>
   <ActionForm action={createAdHocTask} submit="Crear tarea ocasional">
    <label>Título<input name="title" required minLength={3} maxLength={120} placeholder="Ej. Revisar fuga reportada en pista 2"/></label>
    <label>Área<select name="area">{OPS_AREAS.map(a=><option key={a}>{a}</option>)}</select></label>
    <label>Fecha<input name="run_date" type="date" defaultValue={sameDay?from:today} required/></label>
    <label>Vence (minutos desde medianoche CR)<input name="due_offset_minutes" type="number" defaultValue={720} min={5} max={1440} required/></label>
    <label>Asignar a<select name="assignee" defaultValue="">
     <option value="">Sin asignar</option>
     {staff.map(e=><option key={e.id} value={e.id}>{e.full_name} ({e.code})</option>)}
    </select></label>
    <ChecklistEditor/>
   </ActionForm>
  </CollapsiblePanel>
  <CollapsiblePanel title="Filtro">
   <div className="filter-presets">
    <Link href={qs(today,today)} className={`badge${isToday?" selected":""}`}>Hoy</Link>
    <Link href={qs(monthRange.start,monthRange.end)} className={`badge${isMonth?" selected":""}`}>Mes completo</Link>
    <Link href={qs(yearRange.start,yearRange.end)} className={`badge${isYear?" selected":""}`}>Año {year}</Link>
   </div>
   <form className="filters" method="get">
    <label>Desde<input type="date" name="desde" defaultValue={from} required/></label>
    <label>Hasta<input type="date" name="hasta" defaultValue={to} required/></label>
    <button>Filtrar</button>
   </form>
  </CollapsiblePanel>
  <Panel title={`Tareas · ${rangeLabel}`}>
   {!data?.length?<Empty text="No hay tareas en este rango. Generá desde Operaciones, usá plantillas o creá una tarea ocasional."/>:<Table headers={["Tarea","Área","Fecha","Estado","Asignado","Vence","Acción"]}>{data.map(t=>{
   const items=Array.isArray(t.task_checklist_items)?(t.task_checklist_items as Item[]):[];
   const done=items.filter((i:Item)=>i.done).length;
   const assignee=t.assignee as Emp|null;
   const canAssign=["pending","in_progress","rejected"].includes(t.status);
   const adHoc=!t.template_id;
   return <tr key={t.id}>
    <td><strong>{t.title}</strong><small>{adHoc?"Ocasional · ":""}{done}/{items.length} ítems{(t.completed as {full_name?:string}|null)?.full_name?` · completó ${(t.completed as {full_name:string}).full_name}`:""}</small></td>
    <td>{t.area}</td>
    <td>{dateOnly(t.run_date)}</td>
    <td><span className={`badge${t.status==="rejected"||(t.status==="pending"&&new Date(t.due_at)<new Date())?" danger":""}`}>{statusLabel[t.status]??t.status}</span></td>
    <td>{canAssign?<ActionForm action={assignTask} submit="Asignar">
     <input type="hidden" name="id" value={t.id}/>
     <select name="assignee" defaultValue={assignee?.id??""} required={false}>
      <option value="">Sin asignar</option>
      {staff.map(e=><option key={e.id} value={e.id}>{e.full_name} ({e.code})</option>)}
    </select>
    </ActionForm>:assignee?`${assignee.full_name} (${assignee.code})`:"—"}</td>
    <td>{dateTime(t.due_at)}</td>
    <td>
     <div className="row-actions task-row-actions">
      {t.status==="completed"?(
       <>
        <ActionForm action={reviewTask} submit="Aprobar"><input type="hidden" name="id" value={t.id}/><input type="hidden" name="approve" value="true"/><input type="hidden" name="note" value=""/></ActionForm>
        <details><summary className="small">Rechazar</summary><ActionForm action={reviewTask} submit="Confirmar rechazo"><input type="hidden" name="id" value={t.id}/><input type="hidden" name="approve" value="false"/><label>Motivo<input name="note" required minLength={3}/></label></ActionForm></details>
       </>
      ):t.review_note? <span className="muted small">{t.review_note}</span>:null}
      <DeleteOpsTask
       id={t.id}
       title={t.title}
       runDateLabel={dateOnly(t.run_date)}
       action={deleteTask}
      />
     </div>
    </td>
   </tr>;
  })}</Table>}
   {data&&data.length===500&&<p className="muted small">Se muestran las primeras 500 tareas. Reduce el rango para ver el resto.</p>}
  </Panel>
 </>;
}
