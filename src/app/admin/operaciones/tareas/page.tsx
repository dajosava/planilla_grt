import {requireRole} from "@/lib/auth";
import {Heading,Panel,Empty,Table} from "@/components/admin-ui";
import {ActionForm} from "@/components/action-form";
import {assignTask,reviewTask} from "../../ops-actions";
import {dateTime,todayCR} from "@/lib/format";

const statusLabel:Record<string,string>={pending:"Pendiente",in_progress:"En progreso",completed:"Completada",approved:"Aprobada",rejected:"Rechazada"};

type Emp={id:string;full_name:string;code:string};
type Item={done:boolean};

export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const {client}=await requireRole("admin");
 const params=await searchParams;
 const day=typeof params.fecha==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(params.fecha)?params.fecha:todayCR();
 const [{data,error},{data:employees}] = await Promise.all([
  client.from("tasks").select("*,assignee:assigned_employee_id(id,full_name,code),completed:completed_by(full_name),task_checklist_items(id,label,done,requires_photo)").eq("run_date",day).order("due_at"),
  client.from("employees").select("id,full_name,code").eq("active",true).order("full_name")
 ]);
 if(error)throw new Error("No se pudieron cargar las tareas");
 const staff=(employees??[]) as Emp[];
 return <>
  <Heading title="Tareas" description="Asigna cada tarea a un empleado. En la tablet solo verá las suyas. Luego aprueba o rechaza las completadas."/>
  <Panel title="Filtro"><form className="filters" method="get"><label>Fecha<input type="date" name="fecha" defaultValue={day}/></label><button>Filtrar</button></form></Panel>
  <Panel title={`Tareas del ${day}`}>{!data?.length?<Empty text="No hay tareas. Genera desde Operaciones o crea plantillas."/>:<Table headers={["Tarea","Área","Estado","Asignado","Vence","Acción"]}>{data.map(t=>{
   const items=Array.isArray(t.task_checklist_items)?(t.task_checklist_items as Item[]):[];
   const done=items.filter((i:Item)=>i.done).length;
   const assignee=t.assignee as Emp|null;
   const canAssign=["pending","in_progress","rejected"].includes(t.status);
   return <tr key={t.id}>
    <td><strong>{t.title}</strong><small>{done}/{items.length} ítems{(t.completed as {full_name?:string}|null)?.full_name?` · completó ${(t.completed as {full_name:string}).full_name}`:""}</small></td>
    <td>{t.area}</td>
    <td><span className={`badge${t.status==="rejected"||(t.status==="pending"&&new Date(t.due_at)<new Date())?" danger":""}`}>{statusLabel[t.status]??t.status}</span></td>
    <td>{canAssign?<ActionForm action={assignTask} submit="Asignar">
     <input type="hidden" name="id" value={t.id}/>
     <select name="assignee" defaultValue={assignee?.id??""} required={false}>
      <option value="">Sin asignar</option>
      {staff.map(e=><option key={e.id} value={e.id}>{e.full_name} ({e.code})</option>)}
     </select>
    </ActionForm>:assignee?`${assignee.full_name} (${assignee.code})`:"—"}</td>
    <td>{dateTime(t.due_at)}</td>
    <td>{t.status==="completed"?<div className="row-actions">
     <ActionForm action={reviewTask} submit="Aprobar"><input type="hidden" name="id" value={t.id}/><input type="hidden" name="approve" value="true"/><input type="hidden" name="note" value=""/></ActionForm>
     <details><summary className="small">Rechazar</summary><ActionForm action={reviewTask} submit="Confirmar rechazo"><input type="hidden" name="id" value={t.id}/><input type="hidden" name="approve" value="false"/><label>Motivo<input name="note" required minLength={3}/></label></ActionForm></details>
    </div>:t.review_note||"—"}</td>
   </tr>;
  })}</Table>}</Panel>
 </>;
}
