import Link from "next/link";
import {Download,History,Users,Wallet} from "lucide-react";
import {requireRole} from "@/lib/auth";
import {Heading,Panel,Table,Empty} from "@/components/admin-ui";
import {KpiCard} from "@/components/ui/kpi-card";
import {Badge} from "@/components/ui/badge";
import {COMPANIES} from "@/lib/companies";
import {money,labels,dateOnly} from "@/lib/format";
import {labelFortnight} from "@/lib/payroll";
import {
 fetchPayrollHistory,
 historyQueryString,
 parseHistoryFilters,
} from "@/lib/payroll-history";

export default async function Page({
 searchParams,
}:{
 searchParams:Promise<{desde?:string;hasta?:string;estado?:string;empresa?:string;emp?:string|string[]}>;
}){
 const {client}=await requireRole("admin");
 const params=await searchParams;
 const filters=parseHistoryFilters(params);
 const queried=filters.empIds.length>0;

 const {data:employees,error:empErr}=await client
  .from("employees")
  .select("id,code,full_name,department,active")
  .order("full_name");
 if(empErr)throw new Error("No se pudo cargar el directorio de empleados.");

 const rows=queried?await fetchPayrollHistory(client,filters):[];
 const selected=new Set(filters.empIds);
 const qs=historyQueryString(filters);

 const byEmp=new Map<string,{name:string;code:string;net:number;count:number}>();
 for(const r of rows){
  const cur=byEmp.get(r.employee_id)??{name:r.employee_name,code:r.employee_code,net:0,count:0};
  cur.net+=r.net_cents;
  cur.count+=1;
  byEmp.set(r.employee_id,cur);
 }
 const totalNet=rows.reduce((s,r)=>s+r.net_cents,0);

 return <>
  <Heading
   title="Historial de pagos"
   description="Consultá pagos de uno o varios empleados en un rango de fechas (por ejemplo, últimos 6 meses)."
   actions={<Link className="button secondary" href="/admin/planilla">Volver a planilla</Link>}
  />

  <Panel title="Filtros">
   <form method="get" className="history-filters">
    <div className="form-grid">
     <label>Desde<input type="date" name="desde" defaultValue={filters.desde} required/></label>
     <label>Hasta<input type="date" name="hasta" defaultValue={filters.hasta} required/></label>
     <label>Estado
      <select name="estado" defaultValue={filters.estado}>
       <option value="closed">Solo quincenas cerradas</option>
       <option value="all">Cerradas y borradores</option>
      </select>
     </label>
     <label>Sociedad
      <select name="empresa" defaultValue={filters.empresa??""}>
       <option value="">Todas</option>
       {COMPANIES.map(c=><option key={c} value={c}>{c}</option>)}
      </select>
     </label>
    </div>

    <div className="history-emp-pick">
     <p className="history-emp-title">Empleados (marcá uno o varios)</p>
     <div className="history-emp-grid">
      {(employees??[]).map(e=>(
       <label key={e.id} className="checkbox history-emp-item">
        <input type="checkbox" name="emp" value={e.id} defaultChecked={selected.has(e.id)}/>
        <span>
         <strong>{e.full_name}</strong>
         <small>{e.code} · {e.department}{e.active?"":" · inactivo"}</small>
        </span>
       </label>
      ))}
     </div>
     {!employees?.length&&<p className="muted">No hay empleados registrados.</p>}
    </div>

    <div className="form-footer">
     <button type="submit">Consultar historial</button>
     {queried&&rows.length>0&&(
      <a className="button secondary" href={`/api/reportes/historial?${qs}`}>
       <Download size={16} aria-hidden="true"/> Exportar CSV
      </a>
     )}
    </div>
   </form>
  </Panel>

  {!queried?(
   <Empty text="Seleccioná al menos un empleado y tocá Consultar historial."/>
  ):!rows.length?(
   <Empty text="No hay pagos en ese rango para los empleados elegidos."/>
  ):<>
   <div className="stats">
    <KpiCard
     label="Empleados en el reporte" value={byEmp.size} tone="navy" icon={<Users size={18}/>}
     sub={`${rows.length} quincena(s) / línea(s)`}
    />
    <KpiCard
     label="Neto acumulado" value={money(totalNet)} tone="green" icon={<Wallet size={18}/>}
     sub={`${dateOnly(filters.desde)} → ${dateOnly(filters.hasta)}`}
    />
    <KpiCard
     label="Periodo" value={`${filters.desde.slice(0,7)} …`} tone="amber" icon={<History size={18}/>}
     sub={filters.estado==="closed"?"Solo cerradas":"Incluye borradores"}
    />
   </div>

   <Panel title="Totales por empleado">
    <Table headers={["Empleado","Quincenas","Neto acumulado"]}>
     {[...byEmp.values()].map(e=>(
      <tr key={e.code}>
       <td><strong>{e.name}</strong><small>{e.code}</small></td>
       <td>{e.count}</td>
       <td><strong className="tabular">{money(e.net)}</strong></td>
      </tr>
     ))}
    </Table>
   </Panel>

   <Panel
    title="Detalle por quincena"
    action={<a className="button secondary btn-sm" href={`/api/reportes/historial?${qs}`}><Download size={14}/> CSV</a>}
   >
    <Table headers={["Empleado","Sociedad","Periodo","Adelanto","Extras","CCSS","Neto","Estado"]}>
     {rows.map(r=>{
      const extras=r.ot_amount_cents+r.double_amount_cents+r.other_pay_cents;
      return <tr key={r.item_id}>
       <td><strong>{r.employee_name}</strong><small>{r.employee_code}</small></td>
       <td>{r.company}</td>
       <td>
        {r.kind==="fortnight"?labelFortnight(r.period_start,r.period_end):`${r.period_start} → ${r.period_end}`}
       </td>
       <td>{money(r.base_cents)}</td>
       <td>{money(extras)}</td>
       <td>{money(r.ccss_cents)}</td>
       <td><strong className="tabular">{money(r.net_cents)}</strong></td>
       <td><Badge tone={r.status==="closed"?"approved":"pending"}>{labels[r.status]??r.status}</Badge></td>
      </tr>;
     })}
    </Table>
   </Panel>
  </>}
 </>;
}
