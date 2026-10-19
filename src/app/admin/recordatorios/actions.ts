"use server";
import {revalidatePath} from "next/cache";
import {z} from "zod";
import {requireRole} from "@/lib/auth";
import {companySchema,dateSchema} from "@/lib/schemas";
import type {ActionState} from "@/components/action-form";

function failure(error:unknown):ActionState{
 if(error instanceof z.ZodError)return {error:"Revisa los campos del formulario."};
 return {error:error instanceof Error?error.message:"No se pudo guardar."};
}
function dbError(error:{message:string;code?:string}|null){
 if(error)throw new Error(error.code==="P0001"?error.message:"No se pudo guardar. Revisa los datos.");
}

const categorySchema=z.enum(["tramite","permiso","renovacion","documentacion","otro"]);

export async function saveReminder(_:ActionState,form:FormData):Promise<ActionState>{
 const {client}=await requireRole("admin");
 try{
  const idRaw=String(form.get("id")||"");
  const id=idRaw&&z.uuid().safeParse(idRaw).success?idRaw:null;
  const title=z.string().trim().min(3).max(160).parse(form.get("title"));
  const description=z.string().trim().max(2000).parse(form.get("description")??"");
  const category=categorySchema.parse(form.get("category"));
  const companyRaw=String(form.get("company")||"");
  const company=companyRaw&&companySchema.safeParse(companyRaw).success?companyRaw:null;
  const due_on=dateSchema.parse(form.get("due_on"));
  const alert_days=z.coerce.number().int().min(1).max(365).parse(form.get("alert_days")||"30");
  const reference=z.string().trim().max(80).parse(form.get("reference_code")??"");
  const {error}=await client.rpc("upsert_business_reminder",{
   p_id:id,
   p_title:title,
   p_description:description,
   p_category:category,
   p_company:company,
   p_due_on:due_on,
   p_alert_days:alert_days,
   p_reference:reference,
  });
  dbError(error);
  revalidatePath("/admin/recordatorios");
  revalidatePath("/admin");
  return {success:id?"Recordatorio actualizado.":"Recordatorio creado. El sistema avisará antes de la fecha límite."};
 }catch(e){return failure(e)}
}

export async function completeReminder(_:ActionState,form:FormData):Promise<ActionState>{
 const {client}=await requireRole("admin");
 try{
  const id=z.uuid().parse(form.get("id"));
  const note=z.string().trim().max(1000).parse(form.get("note")??"");
  const {error}=await client.rpc("complete_business_reminder",{p_id:id,p_note:note});
  dbError(error);
  revalidatePath("/admin/recordatorios");
  revalidatePath("/admin");
  return {success:"Trámite marcado como atendido."};
 }catch(e){return failure(e)}
}

export async function cancelReminder(_:ActionState,form:FormData):Promise<ActionState>{
 const {client}=await requireRole("admin");
 try{
  const id=z.uuid().parse(form.get("id"));
  const note=z.string().trim().max(1000).parse(form.get("note")??"");
  const {error}=await client.rpc("cancel_business_reminder",{p_id:id,p_note:note});
  dbError(error);
  revalidatePath("/admin/recordatorios");
  revalidatePath("/admin");
  return {success:"Recordatorio cancelado."};
 }catch(e){return failure(e)}
}

const ALLOWED_MIME=new Set([
 "application/pdf",
 "image/jpeg",
 "image/png",
 "image/webp",
 "application/msword",
 "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

function guessMime(name:string,reported:string){
 if(ALLOWED_MIME.has(reported))return reported;
 const lower=name.toLowerCase();
 if(lower.endsWith(".pdf"))return "application/pdf";
 if(lower.endsWith(".jpg")||lower.endsWith(".jpeg"))return "image/jpeg";
 if(lower.endsWith(".png"))return "image/png";
 if(lower.endsWith(".webp"))return "image/webp";
 if(lower.endsWith(".doc"))return "application/msword";
 if(lower.endsWith(".docx"))return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
 return reported;
}

export async function uploadReminderDocument(_:ActionState,form:FormData):Promise<ActionState>{
 const {client}=await requireRole("admin");
 try{
  const reminderId=z.uuid().parse(form.get("reminder_id"));
  const file=form.get("file");
  if(!(file instanceof File)||file.size===0)throw new Error("Seleccioná un archivo.");
  if(file.size>5*1024*1024)throw new Error("El archivo supera 5 MB.");
  const fileName=z.string().trim().min(1).max(180).parse(file.name);
  const mime=guessMime(fileName,file.type||"");
  if(!ALLOWED_MIME.has(mime))throw new Error("Tipo no permitido. Usá PDF, JPG, PNG, WEBP o Word.");
  const buf=Buffer.from(await file.arrayBuffer());
  const b64=buf.toString("base64");
  const {error}=await client.rpc("upload_reminder_document",{
   p_reminder_id:reminderId,
   p_file_name:fileName,
   p_mime:mime,
   p_content_b64:b64,
  });
  dbError(error);
  revalidatePath("/admin/recordatorios");
  return {success:"Documento guardado."};
 }catch(e){return failure(e)}
}

export async function deleteReminderDocument(_:ActionState,form:FormData):Promise<ActionState>{
 const {client}=await requireRole("admin");
 try{
  const id=z.uuid().parse(form.get("id"));
  const {error}=await client.rpc("delete_reminder_document",{p_id:id});
  dbError(error);
  revalidatePath("/admin/recordatorios");
  return {success:"Documento eliminado."};
 }catch(e){return failure(e)}
}
