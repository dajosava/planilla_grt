import {z} from "zod";
import {todayCR} from "@/lib/format";
import {csvCell} from "@/lib/payroll";
import type {Company} from "@/lib/companies";
import {isCompany} from "@/lib/companies";

export type PayrollHistoryRow={
 item_id:string;
 employee_id:string;
 employee_code:string;
 employee_name:string;
 run_id:string;
 period_start:string;
 period_end:string;
 kind:string|null;
 status:string;
 company:string;
 base_cents:number;
 ot_hours:number;
 ot_amount_cents:number;
 double_hours:number;
 double_amount_cents:number;
 other_pay_cents:number;
 ccss_cents:number;
 shortage_cents:number;
 receipt_cents:number;
 other_deduction_cents:number;
 net_cents:number;
 note:string|null;
};

type SbClient={
 from:(table:string)=>any;
};

export function addMonthsYmd(ymd:string,delta:number):string{
 const [y,m,d]=ymd.split("-").map(Number);
 const dt=new Date(y,m-1+delta,1);
 const last=new Date(dt.getFullYear(),dt.getMonth()+1,0).getDate();
 const day=Math.min(d,last);
 return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
}

export function defaultHistoryRange(){
 const hasta=todayCR();
 return {desde:addMonthsYmd(hasta,-6),hasta};
}

export function parseEmpIds(raw:string|string[]|undefined):string[]{
 const list=(Array.isArray(raw)?raw:raw?[raw]:[]).flatMap(v=>v.split(",")).map(s=>s.trim()).filter(Boolean);
 const out:string[]=[];
 for(const id of list){
  if(z.uuid().safeParse(id).success&&!out.includes(id))out.push(id);
 }
 return out.slice(0,50);
}

export type HistoryFilters={
 desde:string;
 hasta:string;
 estado:"closed"|"all";
 empresa:Company|null;
 empIds:string[];
};

export function parseHistoryFilters(params:{
 desde?:string;hasta?:string;estado?:string;empresa?:string;emp?:string|string[];
}):HistoryFilters{
 const defaults=defaultHistoryRange();
 const desde=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).safeParse(params.desde).success
  ?String(params.desde):defaults.desde;
 const hasta=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).safeParse(params.hasta).success
  ?String(params.hasta):defaults.hasta;
 const estado:HistoryFilters["estado"]=params.estado==="all"?"all":"closed";
 const empresa=typeof params.empresa==="string"&&isCompany(params.empresa)?params.empresa:null;
 const empIds=parseEmpIds(params.emp);
 return {desde,hasta:hasta<desde?desde:hasta,estado,empresa,empIds};
}

type RunRow={
 id:string;
 period_start:string;
 period_end:string;
 kind:string|null;
 status:string;
 company:string;
};

export async function fetchPayrollHistory(
 client:SbClient,
 filters:HistoryFilters,
):Promise<PayrollHistoryRow[]>{
 if(!filters.empIds.length)return [];

 let runsQuery=client.from("payroll_runs")
  .select("id,period_start,period_end,kind,status,company")
  .gte("period_start",filters.desde)
  .lte("period_start",filters.hasta)
  .order("period_start",{ascending:false});
 if(filters.estado==="closed")runsQuery=runsQuery.eq("status","closed");
 if(filters.empresa)runsQuery=runsQuery.eq("company",filters.empresa);

 const {data:runs,error:runErr}=await runsQuery;
 if(runErr)throw new Error("No se pudieron cargar las quincenas del rango.");
 const runList=(runs??[]) as RunRow[];
 if(!runList.length)return [];

 const runMap=new Map(runList.map(r=>[r.id,r]));
 const {data:items,error:itemErr}=await client.from("payroll_items")
  .select("id,run_id,employee_id,employee_code,employee_name,base_cents,ot_hours,ot_amount_cents,double_hours,double_amount_cents,other_pay_cents,ccss_cents,shortage_cents,receipt_cents,other_deduction_cents,net_cents,note")
  .in("run_id",[...runMap.keys()])
  .in("employee_id",filters.empIds)
  .order("employee_name");
 if(itemErr)throw new Error("No se pudieron cargar los pagos de los empleados.");

 const rows:PayrollHistoryRow[]=[];
 for(const i of items??[]){
  const run=runMap.get(i.run_id as string);
  if(!run)continue;
  rows.push({
   item_id:i.id,
   employee_id:i.employee_id,
   employee_code:i.employee_code,
   employee_name:i.employee_name,
   run_id:run.id,
   period_start:run.period_start,
   period_end:run.period_end,
   kind:run.kind,
   status:run.status,
   company:run.company,
   base_cents:Number(i.base_cents??0),
   ot_hours:Number(i.ot_hours??0),
   ot_amount_cents:Number(i.ot_amount_cents??0),
   double_hours:Number(i.double_hours??0),
   double_amount_cents:Number(i.double_amount_cents??0),
   other_pay_cents:Number(i.other_pay_cents??0),
   ccss_cents:Number(i.ccss_cents??0),
   shortage_cents:Number(i.shortage_cents??0),
   receipt_cents:Number(i.receipt_cents??0),
   other_deduction_cents:Number(i.other_deduction_cents??0),
   net_cents:Number(i.net_cents??0),
   note:i.note??null,
  });
 }
 rows.sort((a,b)=>{
  const byEmp=a.employee_name.localeCompare(b.employee_name,"es");
  if(byEmp)return byEmp;
  return b.period_start.localeCompare(a.period_start);
 });
 return rows;
}

export function payrollHistoryToCsv(rows:PayrollHistoryRow[]):string{
 const header=[
  "Código","Empleado","Sociedad","Periodo inicio","Periodo fin","Estado",
  "Adelanto CRC","Horas extra","Monto extra","Horas doble","Monto doble","Otros pagos",
  "CCSS","Faltantes","Facturas","Otras deducciones","Neto CRC","Notas",
 ];
 const body=rows.map(r=>[
  r.employee_code,r.employee_name,r.company,r.period_start,r.period_end,r.status,
  (r.base_cents/100).toFixed(2),
  String(r.ot_hours),
  (r.ot_amount_cents/100).toFixed(2),
  String(r.double_hours),
  (r.double_amount_cents/100).toFixed(2),
  (r.other_pay_cents/100).toFixed(2),
  (r.ccss_cents/100).toFixed(2),
  (r.shortage_cents/100).toFixed(2),
  (r.receipt_cents/100).toFixed(2),
  (r.other_deduction_cents/100).toFixed(2),
  (r.net_cents/100).toFixed(2),
  r.note??"",
 ]);
 return "\uFEFF"+[header,...body].map(line=>line.map(csvCell).join(",")).join("\r\n");
}

export function historyQueryString(filters:HistoryFilters):string{
 const q=new URLSearchParams();
 q.set("desde",filters.desde);
 q.set("hasta",filters.hasta);
 q.set("estado",filters.estado);
 if(filters.empresa)q.set("empresa",filters.empresa);
 for(const id of filters.empIds)q.append("emp",id);
 return q.toString();
}
