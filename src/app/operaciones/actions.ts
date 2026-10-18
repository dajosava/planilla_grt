"use server";
import {cookies} from "next/headers";
import {redirect} from "next/navigation";
import {revalidatePath} from "next/cache";
import {z} from "zod";
import {requireRole} from "@/lib/auth";
import {OPS_COOKIE} from "@/lib/ops";
import type {ActionState} from "@/components/action-form";

export async function startOpsSession(_:ActionState,form:FormData):Promise<ActionState>{
 const {client}=await requireRole("kiosk");
 const code=String(form.get("code")??"").trim().toUpperCase();
 const pin=String(form.get("pin")??"");
 if(!code||!pin)return {error:"Ingresa código y PIN."};
 const {data,error}=await client.rpc("ops_start_session",{p_code:code,p_pin:pin});
 if(error)return {error:"No se pudo iniciar la sesión de operaciones."};
 if(!data?.ok)return {error:data?.error??"Código o PIN incorrecto."};
 const jar=await cookies();
 jar.set(OPS_COOKIE,String(data.token),{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",path:"/",expires:new Date(String(data.expires_at))});
 redirect("/operaciones");
}

export async function endOpsSession(){
 const {client}=await requireRole("kiosk");
 const jar=await cookies();
 const token=jar.get(OPS_COOKIE)?.value;
 if(token)await client.rpc("ops_end_session",{p_token:token});
 jar.delete(OPS_COOKIE);
 redirect("/operaciones");
}

export async function toggleChecklist(form:FormData){
 const {client}=await requireRole("kiosk");
 const jar=await cookies();
 const token=jar.get(OPS_COOKIE)?.value??"";
 const id=z.uuid().parse(form.get("id"));
 const done=form.get("done")==="true";
 await client.rpc("ops_toggle_checklist",{p_token:token,p_item_id:id,p_done:done});
 revalidatePath("/operaciones");
}

export async function completeTask(input:{taskId:string;comment:string;photo:string|null}){
 const {client}=await requireRole("kiosk");
 const jar=await cookies();
 const token=jar.get(OPS_COOKIE)?.value??"";
 const {data,error}=await client.rpc("ops_complete_task",{p_token:token,p_task_id:input.taskId,p_comment:input.comment,p_photo:input.photo});
 if(error)return {error:"No se pudo completar la tarea."};
 if(data?.error)return {error:String(data.error)};
 revalidatePath("/operaciones");
 return {ok:true as const};
}

export async function reportIncident(input:{category:string;severity:string;title:string;description:string;photo:string|null}){
 const {client}=await requireRole("kiosk");
 const jar=await cookies();
 const token=jar.get(OPS_COOKIE)?.value??"";
 const parsed=z.object({
  category:z.enum(["Dispensador","Derrame","Seguridad","Caja","Tienda","Mantenimiento","Otro"]),
  severity:z.enum(["low","medium","high","critical"]),
  title:z.string().trim().min(3).max(160),
  description:z.string().max(1000),
  photo:z.string().max(270000).nullish()
 }).safeParse(input);
 if(!parsed.success)return {error:"Revisa los datos del incidente."};
 const {data,error}=await client.rpc("ops_report_incident",{
  p_token:token,p_category:parsed.data.category,p_severity:parsed.data.severity,
  p_title:parsed.data.title,p_description:parsed.data.description,p_photo:parsed.data.photo??null
 });
 if(error)return {error:"No se pudo registrar el incidente."};
 if(data?.error)return {error:String(data.error)};
 revalidatePath("/operaciones");
 revalidatePath("/admin/incidentes");
 return {ok:true as const,id:String(data.id)};
}
