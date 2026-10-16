"use server";
import {requireRole} from "@/lib/auth";import {punchSchema} from "@/lib/schemas";
export async function punch(input:unknown):Promise<{error?:string;ok?:boolean;at?:string;photo?:boolean}>{
 const {client}=await requireRole("kiosk");const parsed=punchSchema.safeParse(input);
 if(!parsed.success)return {error:"Revisa el código y el PIN (6 a 8 dígitos)."};
 const v=parsed.data;
 const {data,error}=await client.rpc("register_punch_with_photo",{p_code:v.code,p_pin:v.pin,p_kind:v.kind,p_request_id:v.requestId,p_photo:v.photo??null});
 if(error)return {error:"No se confirmó la marcación. Reintenta sin cambiar los datos o consulta al administrador."};
 return data;
}
