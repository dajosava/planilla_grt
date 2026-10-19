import "server-only";
import {cookies} from "next/headers";
import {requireRole} from "./auth";

export const OPS_COOKIE="grt_ops_session";
export const OPS_AREAS=["Pista","Baños","Tienda","Caja","Seguridad","Mantenimiento","General"] as const;

export async function opsToken(){
 const jar=await cookies();
 return jar.get(OPS_COOKIE)?.value??"";
}

export async function requireAdminOps(){
 return requireRole("admin");
}

export async function requireKioskOps(){
 return requireRole("kiosk");
}

export type OpsDashboard={
 from:string;
 to:string;
 date?:string;
 tasks:{
  total:number;pending:number;in_progress:number;completed:number;
  approved:number;rejected:number;late:number;done:number;
 };
 by_status:{status:string;count:number}[];
 by_area:{area:string;total:number;pending:number;in_progress:number;done:number;approved:number;rejected:number}[];
 by_day:{day:string;total:number;done:number;pending:number;in_progress:number;rejected:number}[];
 by_employee:{employee_id:string;full_name:string;code:string;total:number;done:number;pending:number;in_progress:number;rejected:number}[];
 unassigned:number;
 incidents:{open:number;critical:number;resolved:number;reported:number;resolved_today?:number};
};

export type OpsTask={
 id:string;title:string;area:string;status:string;due_at:string;run_date:string;
 checklist:{id:string;label:string;done:boolean;requires_photo:boolean;for_bitacora?:boolean}[]|null;
};
