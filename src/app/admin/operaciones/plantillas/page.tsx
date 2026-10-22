import {requireRole} from "@/lib/auth";
import {Heading,Panel,Empty,CollapsiblePanel} from "@/components/admin-ui";
import {ActionForm} from "@/components/action-form";
import {OpsNavBar} from "@/components/ops-nav-bar";
import {TemplatesDirectory,TemplateCreateFields,type TemplateListItem} from "@/components/templates-directory";
import {saveTemplate} from "../../ops-actions";

type Emp={id:string;full_name:string;code:string};
type Item={label:string;sort_order:number;requires_photo:boolean;for_bitacora?:boolean};

export default async function Page(){
 const {client}=await requireRole("admin");
 const [{data:templates,error},{data:employees}]=await Promise.all([
  client.from("task_templates").select("*,assignee:default_assignee_id(id,full_name,code),task_template_items(id,label,sort_order,requires_photo,for_bitacora)").order("title"),
  client.from("employees").select("id,full_name,code").eq("active",true).order("full_name")
 ]);
 if(error)throw new Error("No se pudieron cargar las plantillas");
 const staff=(employees??[]) as Emp[];

 const list:TemplateListItem[]=(templates??[]).map(t=>{
  const raw=Array.isArray(t.task_template_items)?(t.task_template_items as Item[]):[];
  const items=raw.slice().sort((a,b)=>a.sort_order-b.sort_order).map(i=>({
   label:i.label,
   requires_photo:!!i.requires_photo,
   for_bitacora:!!i.for_bitacora,
  }));
  const assignee=t.assignee as Emp|null;
  return {
   id:t.id as string,
   title:t.title as string,
   area:t.area as string,
   recurrence:t.recurrence as string,
   due_offset_minutes:Number(t.due_offset_minutes),
   active:!!t.active,
   assignee:assignee?{id:assignee.id,full_name:assignee.full_name,code:assignee.code}:null,
   items,
  };
 });

 return <>
  <Heading title="Plantillas de operaciones" description="Define checklists recurrentes. Marcá cámara si el ítem exige foto y bitácora si debe quedar para impresión."/>
  <OpsNavBar/>
  <Panel title="Plantillas activas">
   {!list.length?<Empty/>:(
    <TemplatesDirectory templates={list} employees={staff}/>
   )}
  </Panel>
  <CollapsiblePanel title="Nueva plantilla">
   <p className="muted small">Agregá ítems al checklist. Cámara = foto obligatoria. Bitácora = queda para posible impresión.</p>
   <ActionForm action={saveTemplate} submit="Crear plantilla">
    <TemplateCreateFields employees={staff}/>
   </ActionForm>
  </CollapsiblePanel>
 </>;
}
