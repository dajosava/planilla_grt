import {requireRole} from "@/lib/auth";
import {AttendanceOtAlert,type AttendanceOtItem} from "@/components/attendance-ot-alert";

/** Carga OT en paralelo al resto de la página (Suspense) para no tumbar el RSC si el RPC tarda. */
export async function OtAlertsSection({
 from,
 to,
 employee,
}:{
 from:string;
 to:string;
 employee:string;
}){
 const {client}=await requireRole("admin");
 const {data,error}=await client.rpc("list_attendance_ot_alerts",{p_from:from,p_to:to});
 if(error||!data||typeof data!=="object")return null;

 const otData=data as {items?:AttendanceOtItem[];people?:number};
 let items=(otData.items??[]) as AttendanceOtItem[];
 if(employee)items=items.filter(i=>i.employee_id===employee);
 if(!items.length)return null;

 const people=employee?(items.length?1:0):Number(otData.people??0);
 const otHours=items.reduce((s,i)=>s+Number(i.ot_hours||0),0);
 return <AttendanceOtAlert items={items} people={people} otHours={otHours}/>;
}
