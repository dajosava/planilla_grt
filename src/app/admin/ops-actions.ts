"use server";
import {revalidatePath} from "next/cache";
import {z} from "zod";
import {requireRole} from "@/lib/auth";
import {OPS_AREAS} from "@/lib/ops";
import type {ActionState} from "@/components/action-form";

function failure(error:unknown):ActionState{
 if(error instanceof z.ZodError)return {error:"Revisa los campos del formulario."};
 return {error:error instanceof Error?error.message:"No se pudo guardar."};
}
function dbError(error:{message:string;code?:string}|null){
 if(error)throw new Error(error.code==="P0001"?error.message:"No se pudo guardar. Revisa los datos.");
}

export async function saveTemplate(_:ActionState,form:FormData):Promise<ActionState>{
 const {client}=await requireRole("admin");
 try{
  const id=String(form.get("id")||"");
  const title=z.string().trim().min(3).max(120).parse(form.get("title"));
  const area=z.enum(OPS_AREAS).parse(form.get("area"));
  const recurrence=z.enum(["daily","weekdays","once"]).parse(form.get("recurrence"));
  const due_offset=z.coerce.number().int().min(5).max(1440).parse(form.get("due_offset_minutes"));
  const active=form.get("active")==="on"||form.get("active")==="true";
  const raw=String(form.get("items")||"").split("\n").map(l=>l.trim()).filter(Boolean);
  if(!raw.length)throw new Error("Agrega al menos un ítem del checklist.");
  const items=raw.map(line=>{
   const photo=line.startsWith("!");
   return {label:photo?line.slice(1).trim():line,requires_photo:photo};
  });
  const assigneeRaw=String(form.get("assignee")||"");
  const assignee=assigneeRaw&&z.uuid().safeParse(assigneeRaw).success?assigneeRaw:null;
  const {error}=await client.rpc("ops_upsert_template",{
   p_id:id&&z.uuid().safeParse(id).success?id:null,
   p_title:title,p_area:area,p_recurrence:recurrence,p_due_offset:due_offset,p_active:active,p_items:items,
   p_assignee:assignee
  });
  dbError(error);
  revalidatePath("/admin/operaciones");
  revalidatePath("/admin/operaciones/plantillas");
  return {success:"Plantilla guardada."};
 }catch(e){return failure(e)}
}

export async function assignTask(_:ActionState,form:FormData):Promise<ActionState>{
 const {client}=await requireRole("admin");
 try{
  const id=z.uuid().parse(form.get("id"));
  const assigneeRaw=String(form.get("assignee")||"");
  const assignee=assigneeRaw&&z.uuid().safeParse(assigneeRaw).success?assigneeRaw:null;
  const {error}=await client.rpc("ops_assign_task",{p_task_id:id,p_employee_id:assignee});
  dbError(error);
  revalidatePath("/admin/operaciones");
  revalidatePath("/admin/operaciones/tareas");
  return {success:assignee?"Tarea asignada.":"Asignación quitada."};
 }catch(e){return failure(e)}
}

export async function generateTodayTasks():Promise<ActionState>{
 const {client}=await requireRole("admin");
 try{
  const {data,error}=await client.rpc("ops_generate_tasks_for_date",{p_date:null});
  dbError(error);
  revalidatePath("/admin/operaciones");
  revalidatePath("/admin/operaciones/tareas");
  const n=typeof data==="number"?data:0;
  return {success:n===0?"No había plantillas nuevas por generar para hoy.":`Se generaron ${n} tarea(s) para hoy.`};
 }catch(e){return failure(e)}
}

export async function reviewTask(_:ActionState,form:FormData):Promise<ActionState>{
 const {client}=await requireRole("admin");
 try{
  const id=z.uuid().parse(form.get("id"));
  const approve=form.get("approve")==="true";
  const note=z.string().max(500).parse(form.get("note")??"");
  const {error}=await client.rpc("ops_review_task",{p_task_id:id,p_approve:approve,p_note:note});
  dbError(error);
  revalidatePath("/admin/operaciones");
  revalidatePath("/admin/operaciones/tareas");
  return {success:approve?"Tarea aprobada.":"Tarea rechazada."};
 }catch(e){return failure(e)}
}

export async function updateIncident(_:ActionState,form:FormData):Promise<ActionState>{
 const {client}=await requireRole("admin");
 try{
  const id=z.uuid().parse(form.get("id"));
  const status=z.enum(["open","assigned","resolved","closed"]).parse(form.get("status"));
  const note=z.string().max(1000).parse(form.get("note")??"");
  const {error}=await client.rpc("ops_update_incident",{p_id:id,p_status:status,p_note:note});
  dbError(error);
  revalidatePath("/admin/incidentes");
  revalidatePath("/admin/operaciones");
  return {success:"Incidente actualizado."};
 }catch(e){return failure(e)}
}
