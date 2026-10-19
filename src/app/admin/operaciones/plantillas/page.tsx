import {requireRole} from "@/lib/auth";
import {Heading,Panel,Empty,CollapsiblePanel} from "@/components/admin-ui";
import {ActionForm} from "@/components/action-form";
import {ChecklistEditor} from "@/components/checklist-editor";
import {OpsNavBar} from "@/components/ops-nav-bar";
import {Badge} from "@/components/ui/badge";
import {saveTemplate} from "../../ops-actions";
import {OPS_AREAS} from "@/lib/ops";

type Emp={id:string;full_name:string;code:string};
type Item={label:string;sort_order:number;requires_photo:boolean;for_bitacora?:boolean};

function AssigneeSelect({employees,defaultValue}:{employees:Emp[];defaultValue?:string|null}){
 return <label>Asignar por defecto a<select name="assignee" defaultValue={defaultValue??""}>
  <option value="">Sin asignar (asignar después en Tareas)</option>
  {employees.map(e=><option key={e.id} value={e.id}>{e.full_name} ({e.code})</option>)}
 </select></label>;
}

export default async function Page(){
 const {client}=await requireRole("admin");
 const [{data:templates,error},{data:employees}]=await Promise.all([
  client.from("task_templates").select("*,assignee:default_assignee_id(id,full_name,code),task_template_items(id,label,sort_order,requires_photo,for_bitacora)").order("title"),
  client.from("employees").select("id,full_name,code").eq("active",true).order("full_name")
 ]);
 if(error)throw new Error("No se pudieron cargar las plantillas");
 const staff=(employees??[]) as Emp[];
 return <>
  <Heading title="Plantillas de operaciones" description="Define checklists recurrentes. Marcá cámara si el ítem exige foto y bitácora si debe quedar para impresión."/>
  <OpsNavBar/>
  <Panel title="Plantillas activas">
   {!templates?.length?<Empty/>:(
    <>
     <p className="muted small">Tocá una plantilla para editarla.</p>
     <div className="directory-scroll">
      {templates.map(t=>{
       const raw=Array.isArray(t.task_template_items)?(t.task_template_items as Item[]):[];
       const items=raw.slice().sort((a,b)=>a.sort_order-b.sort_order);
       const assignee=t.assignee as Emp|null;
       return (
        <details key={t.id} className="employee-dir-row">
         <summary>
          <span className="employee-dir-main">
           <strong>{t.title}</strong>
           <small>{t.area} · {t.recurrence} · {items.length} ítem{items.length===1?"":"s"}</small>
          </span>
          <span className="employee-dir-meta muted small">{assignee?`${assignee.full_name} (${assignee.code})`:"Sin asignar"}</span>
          <Badge tone={t.active?"approved":"pending"}>{t.active?"Activa":"Inactiva"}</Badge>
         </summary>
         <div className="employee-dir-body">
          <ActionForm action={saveTemplate} submit="Guardar cambios">
           <input type="hidden" name="id" value={t.id}/>
           <label>Título<input name="title" defaultValue={t.title} required minLength={3} maxLength={120}/></label>
           <label>Área<select name="area" defaultValue={t.area}>{OPS_AREAS.map(a=><option key={a}>{a}</option>)}</select></label>
           <label>Recurrencia<select name="recurrence" defaultValue={t.recurrence}><option value="daily">Diaria</option><option value="weekdays">Lunes a viernes</option><option value="once">Una sola vez</option></select></label>
           <label>Vence (minutos)<input name="due_offset_minutes" type="number" defaultValue={t.due_offset_minutes} min={5} max={1440} required/></label>
           <AssigneeSelect employees={staff} defaultValue={assignee?.id}/>
           <ChecklistEditor initial={items.map(i=>({
            label:i.label,
            requires_photo:!!i.requires_photo,
            for_bitacora:!!i.for_bitacora,
           }))}/>
           <label className="checkbox"><input type="checkbox" name="active" defaultChecked={t.active}/> Activa</label>
          </ActionForm>
         </div>
        </details>
       );
      })}
     </div>
    </>
   )}
  </Panel>
  <CollapsiblePanel title="Nueva plantilla">
   <p className="muted small">Agregá ítems al checklist. Cámara = foto obligatoria. Bitácora = queda para posible impresión.</p>
   <ActionForm action={saveTemplate} submit="Crear plantilla">
    <label>Título<input name="title" required minLength={3} maxLength={120} placeholder="Apertura de estación"/></label>
    <label>Área<select name="area">{OPS_AREAS.map(a=><option key={a}>{a}</option>)}</select></label>
    <label>Recurrencia<select name="recurrence"><option value="daily">Diaria</option><option value="weekdays">Lunes a viernes</option><option value="once">Una sola vez</option></select></label>
    <label>Vence (minutos desde medianoche CR)<input name="due_offset_minutes" type="number" defaultValue={90} min={5} max={1440} required/></label>
    <AssigneeSelect employees={staff}/>
    <ChecklistEditor/>
    <label className="checkbox"><input type="checkbox" name="active" defaultChecked/> Activa</label>
   </ActionForm>
  </CollapsiblePanel>
 </>;
}
