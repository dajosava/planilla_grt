import {requireRole} from "@/lib/auth";
import {z} from "zod";

export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){
 const {client}=await requireRole("admin");
 const {id}=await params;
 if(!z.uuid().safeParse(id).success)return new Response("No encontrado",{status:404});

 const {data,error}=await client.from("business_reminder_documents")
  .select("file_name,mime_type,content")
  .eq("id",id)
  .maybeSingle();
 if(error||!data)return new Response("No encontrado",{status:404});
 if(typeof data.content!=="string"||!data.content.startsWith("\\x")){
  return new Response("No encontrado",{status:404});
 }

 const bytes=new Uint8Array(Buffer.from(data.content.slice(2),"hex"));
 const safeName=String(data.file_name||"documento").replace(/[^\w.\- ()áéíóúÁÉÍÓÚñÑ]+/g,"_");
 return new Response(bytes,{
  headers:{
   "Content-Type":data.mime_type||"application/octet-stream",
   "Content-Disposition":`attachment; filename="${safeName}"`,
   "Cache-Control":"private, max-age=120",
   "X-Content-Type-Options":"nosniff",
  },
 });
}
