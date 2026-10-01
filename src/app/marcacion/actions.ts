"use server";
import {requireRole} from "@/lib/auth";import {punchSchema} from "@/lib/schemas";
export async function punch(input:unknown):Promise<{error?:string;ok?:boolean;at?:string}>{
 const {client}=await requireRole("kiosk");const parsed=punchSchema.safeParse(input);
 if(!parsed.success)return {error:"Revisa el código y el PIN (6 a 8 dígitos)."};
 const v=parsed.data;
 const {data,error}=await client.rpc("register_punch",{p_code:v.code,p_pin:v.pin,p_kind:v.kind,p_request_id:v.requestId});
 if(error)return {error:"No se confirmó la marcación. Reintenta sin cambiar los datos o consulta al administrador."};
 return data;
}
