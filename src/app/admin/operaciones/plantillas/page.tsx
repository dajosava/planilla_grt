import {requireRole} from "@/lib/auth";
import {Heading,Panel,Empty,Table,CollapsiblePanel} from "@/components/admin-ui";
import {ActionForm} from "@/components/action-form";
import {saveTemplate} from "../../ops-actions";
import {OPS_AREAS} from "@/lib/ops";

type Emp={id:string;full_name:string;code:string};
type Item={label:string;sort_order:number;requires_photo:boolean};

function AssigneeSelect({employees,defaultValue}:{employees:Emp[];defaultValue?:string|null}){
 return <label>Asignar por defecto a<select name="assignee" defaultValue={defaultValue??""}>
  <option value="">Sin asignar (asignar después en Tareas)</option>
  {employees.map(e=><option key={e.id} value={e.id}>{e.full_name} ({e.code})</option>)}
 </select></label>;
}

export default async function Page(){
 const {client}=await requireRole("admin");
 const [{data:templates,error},{data:employees}]=await Promise.all([
  client.from("task_templates").select("*,assignee:default_assignee_id(id,full_name,code),task_template_items(id,label,sort_order,requires_photo)").order("title"),
  client.from("employees").select("id,full_name,code").eq("active",true).order("full_name")
 ]);
 if(error)throw new Error("No se pudieron cargar las plantillas");
 const staff=(employees??[]) as Emp[];
 return <>
  <Heading title="Plantillas de operaciones" description="Define checklists recurrentes y, si quieres, el empleado que las recibirá cada día. Antepones ! a un ítem para exigir foto."/>
  <Panel title="Plantillas activas">{!templates?.length?<Empty/>:<Table headers={["Título","Área","Recurrencia","Asignado","Ítems","Estado"]}>{templates.map(t=>{
   const items=Array.isArray(t.task_template_items)?t.task_template_items:[];
   const assignee=t.assignee as Emp|null;
   return <tr key={t.id}><td><strong>{t.title}</strong></td><td>{t.area}</td><td>{t.recurrence}</td><td>{assignee?`${assignee.full_name} (${assignee.code})`:"—"}</td><td>{items.length}</td><td><span className="badge">{t.active?"Activa":"Inactiva"}</span></td></tr>;
  })}</Table>}</Panel>
  <CollapsiblePanel title="Nueva plantilla">
   <p className="muted small">Un ítem por línea. Ejemplo: <code>!Revisar baños</code> exige foto.</p>
   <ActionForm action={saveTemplate} submit="Crear plantilla">
    <label>Título<input name="title" required minLength={3} maxLength={120} placeholder="Apertura de estación"/></label>
    <label>Área<select name="area">{OPS_AREAS.map(a=><option key={a}>{a}</option>)}</select></label>
    <label>Recurrencia<select name="recurrence"><option value="daily">Diaria</option><option value="weekdays">Lunes a viernes</option><option value="once">Una sola vez</option></select></label>
    <label>Vence (minutos desde medianoche CR)<input name="due_offset_minutes" type="number" defaultValue={90} min={5} max={1440} required/></label>
    <AssigneeSelect employees={staff}/>
    <label>Checklist (una línea por ítem)<textarea name="items" rows={6} required placeholder={"Revisar dispensadores\n!Revisar baños\nRevisar precios"}/></label>
    <label className="checkbox"><input type="checkbox" name="active" defaultChecked/> Activa</label>
   </ActionForm>
  </CollapsiblePanel>
  {templates?.map(t=>{
   const raw=Array.isArray(t.task_template_items)?(t.task_template_items as Item[]):[];
   const items=raw.slice().sort((a:Item,b:Item)=>a.sort_order-b.sort_order);
   const text=items.map((i:Item)=>(i.requires_photo?"!":"")+i.label).join("\n");
   const assignee=t.assignee as Emp|null;
   return <details key={t.id}><summary>Editar · {t.title}</summary>
    <ActionForm action={saveTemplate} submit="Actualizar">
     <input type="hidden" name="id" value={t.id}/>
     <label>Título<input name="title" defaultValue={t.title} required minLength={3} maxLength={120}/></label>
     <label>Área<select name="area" defaultValue={t.area}>{OPS_AREAS.map(a=><option key={a}>{a}</option>)}</select></label>
     <label>Recurrencia<select name="recurrence" defaultValue={t.recurrence}><option value="daily">Diaria</option><option value="weekdays">Lunes a viernes</option><option value="once">Una sola vez</option></select></label>
     <label>Vence (minutos)<input name="due_offset_minutes" type="number" defaultValue={t.due_offset_minutes} min={5} max={1440} required/></label>
     <AssigneeSelect employees={staff} defaultValue={assignee?.id}/>
     <label>Checklist<textarea name="items" rows={6} required defaultValue={text}/></label>
     <label className="checkbox"><input type="checkbox" name="active" defaultChecked={t.active}/> Activa</label>
    </ActionForm>
   </details>;
  })}
 </>;
}
