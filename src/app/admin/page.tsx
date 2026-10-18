import Link from "next/link";
import {Users,Clock3,ClipboardList} from "lucide-react";
import {requireRole} from "@/lib/auth";
import {Heading,Panel,Empty,Table} from "@/components/admin-ui";
import {KpiCard} from "@/components/ui/kpi-card";
import {dateTime,labels} from "@/lib/format";

export default async function Dashboard(){
 const {client}=await requireRole("admin");
 const [employees,open,pending,events]=await Promise.all([
  client.from("employees").select("id",{count:"exact",head:true}).eq("active",true),
  client.from("effective_sessions").select("id",{count:"exact",head:true}).is("ended_at",null),
  client.from("absences").select("id",{count:"exact",head:true}).eq("status","pending"),
  client.from("attendance_events").select("id,kind,occurred_at,employees(full_name,department)").order("occurred_at",{ascending:false}).limit(10),
 ]);
 if([employees,open,pending,events].some(r=>r.error))throw new Error("No se pudo cargar el resumen. Revisa las migraciones de Supabase.");
 return <>
  <Heading title="Resumen de personal" description="Un vistazo al equipo y a las novedades que requieren atención."
   actions={<Link className="button" href="/admin/operaciones">Ir a operaciones</Link>}/>
  <div className="stats">
   <KpiCard label="Empleados activos" value={employees.count??0} tone="green" icon={<Users size={18}/>} sub="En todas las áreas" href="/admin/empleados"/>
   <KpiCard label="Jornadas abiertas" value={open.count??0} tone="amber" icon={<Clock3 size={18}/>} sub="Entrada sin salida registrada" href="/admin/asistencia"/>
   <KpiCard label="Ausencias por revisar" value={pending.count??0} tone="navy" icon={<ClipboardList size={18}/>} sub="Vacaciones, permisos e incapacidades" href="/admin/ausencias"/>
  </div>
  <div className="notice">
   <div><strong>Antes de cerrar la planilla</strong><p>Resuelve las marcas faltantes y revisa los conceptos de pago de cada empleado.</p></div>
   <Link href="/admin/planilla" className="button">Revisar planilla</Link>
  </div>
  <Panel title="Últimas marcaciones">
   {!events.data?.length?<Empty text="Las marcas de la tablet aparecerán aquí."/>:<Table headers={["Empleado","Área","Movimiento","Fecha y hora"]}>{events.data.map(e=>{
    const emp=e.employees as unknown as {full_name:string;department:string}|null;
    return <tr key={e.id}><td>{emp?.full_name}</td><td>{emp?.department}</td><td><span className="badge">{labels[e.kind]}</span></td><td>{dateTime(e.occurred_at)}</td></tr>;
   })}</Table>}
  </Panel>
 </>;
}
