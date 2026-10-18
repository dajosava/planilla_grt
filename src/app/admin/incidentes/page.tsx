import {requireRole} from "@/lib/auth";
import {Heading,Panel,Empty} from "@/components/admin-ui";
import {ActionForm} from "@/components/action-form";
import {OpsNavBar} from "@/components/ops-nav-bar";
import {updateIncident} from "../ops-actions";
import {dateTime} from "@/lib/format";
import {ChevronDown} from "lucide-react";

const sev:Record<string,string>={low:"Baja",medium:"Media",high:"Alta",critical:"Crítica"};
const st:Record<string,string>={open:"Abierto",assigned:"Asignado",resolved:"Resuelto",closed:"Cerrado"};
const sevTone:Record<string,string>={low:"approved",medium:"pending",high:"danger",critical:"critical"};

export default async function Page(){
 const {client}=await requireRole("admin");
 const {data,error}=await client.from("incidents").select("*,employees:reported_by_employee_id(full_name,code)").order("created_at",{ascending:false}).limit(100);
 if(error)throw new Error("No se pudieron cargar los incidentes");
 return <>
  <Heading title="Incidentes" description="Reportes operativos desde la tablet. Asigna, resuelve y cierra."/>
  <OpsNavBar/>
  <Panel title="Últimos 100">{!data?.length?<Empty text="Sin incidentes."/>:<div className="table-scroll stack-mobile"><table>
   <thead><tr>{["Fecha","Título","Categoría","Severidad","Estado","Reportó","Acción"].map(h=><th key={h}>{h}</th>)}</tr></thead>
   <tbody>{data.map(i=>{
    const emp=i.employees as {full_name?:string;code?:string}|null;
    return <tr key={i.id}>
     <td>{dateTime(i.created_at)}</td>
     <td><strong>{i.title}</strong><small>{i.description}</small></td>
     <td>{i.category}</td>
     <td><span className={`badge ${sevTone[i.severity]??""}`}>{sev[i.severity]}</span></td>
     <td><span className="badge">{st[i.status]}</span></td>
     <td>{emp?`${emp.full_name} (${emp.code})`:"—"}</td>
     <td><details><summary className="button secondary btn-sm" style={{listStyle:"none",cursor:"pointer"}}><ChevronDown size={14} aria-hidden="true"/> Actualizar</summary><ActionForm action={updateIncident} submit="Guardar">
      <input type="hidden" name="id" value={i.id}/>
      <label>Estado<select name="status" defaultValue={i.status}><option value="open">Abierto</option><option value="assigned">Asignado</option><option value="resolved">Resuelto</option><option value="closed">Cerrado</option></select></label>
      <label>Nota<input name="note" defaultValue={i.resolved_note} maxLength={1000}/></label>
     </ActionForm></details></td>
    </tr>;
   })}</tbody>
  </table></div>}</Panel>
 </>;
}
