import {requireRole} from "@/lib/auth";
import {Heading,Panel,Empty,Table} from "@/components/admin-ui";
import {ActionForm} from "@/components/action-form";
import {updateIncident} from "../ops-actions";
import {dateTime} from "@/lib/format";

const sev:Record<string,string>={low:"Baja",medium:"Media",high:"Alta",critical:"Crítica"};
const st:Record<string,string>={open:"Abierto",assigned:"Asignado",resolved:"Resuelto",closed:"Cerrado"};

export default async function Page(){
 const {client}=await requireRole("admin");
 const {data,error}=await client.from("incidents").select("*,employees:reported_by_employee_id(full_name,code)").order("created_at",{ascending:false}).limit(100);
 if(error)throw new Error("No se pudieron cargar los incidentes");
 return <>
  <Heading title="Incidentes" description="Reportes operativos desde la tablet. Asigna, resuelve y cierra."/>
  <Panel title="Últimos 100">{!data?.length?<Empty text="Sin incidentes."/>:<Table headers={["Fecha","Título","Categoría","Severidad","Estado","Reportó","Acción"]}>{data.map(i=>{
   const emp=i.employees as {full_name?:string;code?:string}|null;
   return <tr key={i.id}>
    <td>{dateTime(i.created_at)}</td>
    <td><strong>{i.title}</strong><small>{i.description}</small></td>
    <td>{i.category}</td>
    <td><span className={`badge${i.severity==="critical"||i.severity==="high"?" danger":""}`}>{sev[i.severity]}</span></td>
    <td>{st[i.status]}</td>
    <td>{emp?`${emp.full_name} (${emp.code})`:"—"}</td>
    <td><details><summary>Actualizar</summary><ActionForm action={updateIncident} submit="Guardar">
     <input type="hidden" name="id" value={i.id}/>
     <label>Estado<select name="status" defaultValue={i.status}><option value="open">Abierto</option><option value="assigned">Asignado</option><option value="resolved">Resuelto</option><option value="closed">Cerrado</option></select></label>
     <label>Nota<input name="note" defaultValue={i.resolved_note} maxLength={1000}/></label>
    </ActionForm></details></td>
   </tr>;
  })}</Table>}</Panel>
 </>;
}
