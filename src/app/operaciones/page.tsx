import {requireRole} from "@/lib/auth";
import {opsToken,type OpsTask} from "@/lib/ops";
import {OpsTerminal} from "./terminal";

export default async function Page(){
 const {client}=await requireRole("kiosk");
 const token=await opsToken();
 let needsLogin=true;
 let tasks:OpsTask[]=[];
 let employeeName:string|undefined;
 if(token){
  const {data}=await client.rpc("ops_list_my_tasks",{p_token:token});
  if(data&&!data.error){
   needsLogin=false;
   tasks=Array.isArray(data.tasks)?data.tasks:[];
   employeeName=data.employee?.full_name?`${data.employee.full_name} (${data.employee.code})`:undefined;
  }
 }
 return <OpsTerminal needsLogin={needsLogin} tasks={tasks} employeeName={employeeName}/>;
}
