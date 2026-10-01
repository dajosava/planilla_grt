import "server-only";
import {requireRole} from "./auth";
export async function employees(){const {client}=await requireRole("admin");const {data,error}=await client.from("employees").select("*").order("full_name");if(error)throw new Error("No fue posible consultar empleados. Revisa la conexión y las migraciones.");return data??[];}
