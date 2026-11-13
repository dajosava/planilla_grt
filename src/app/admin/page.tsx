import Link from "next/link";
import {Users,Clock3,ClipboardList,AlarmClock} from "lucide-react";
import {requireRole} from "@/lib/auth";
import {Heading,Panel,Empty,Table} from "@/components/admin-ui";
import {KpiCard} from "@/components/ui/kpi-card";
import {Badge} from "@/components/ui/badge";
import {dateTime,timeOnly} from "@/lib/format";

function sameCalendarDayCR(a:string,b:string){
 const fmt=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Costa_Rica",year:"numeric",month:"2-digit",day:"2-digit"});
 return fmt.format(new Date(a))===fmt.format(new Date(b));
}

function jornadaLabel(startedAt:string,endedAt:string|null){
 if(!endedAt){
  return <>Entrada {dateTime(startedAt)} · <span className="text-danger">sin salida</span></>;
 }
 if(sameCalendarDayCR(startedAt,endedAt)){
  return <>{timeOnly(startedAt)} → {timeOnly(endedAt)}</>;
 }
 return <>{dateTime(startedAt)} → {dateTime(endedAt)}</>;
}

export default async function Dashboard(){
 const {client}=await requireRole("admin");
 const [employees,open,pending,sessions,reminderAlerts]=await Promise.all([
  client.from("employees").select("id",{count:"exact",head:true}).eq("active",true),
  client.from("effective_sessions").select("id",{count:"exact",head:true}).is("ended_at",null),
  client.from("absences").select("id",{count:"exact",head:true}).eq("status","pending"),
  client.from("effective_sessions")
   .select("id,started_at,ended_at,worked_hours,adjusted,employees(full_name,department)")
   .order("started_at",{ascending:false})
   .limit(12),
  client.rpc("count_reminder_alerts"),
 ]);
 if([employees,open,pending,sessions].some(r=>r.error))throw new Error("No se pudo cargar el resumen. Revisa las migraciones de Supabase.");
 const alerts=typeof reminderAlerts.data==="number"?reminderAlerts.data:0;

 return <>
  <Heading title="Resumen de personal" description="Un vistazo al equipo y a las novedades que requieren atención."
   actions={<Link className="button" href="/admin/operaciones">Ir a operaciones</Link>}/>
  <div className="stats">
   <KpiCard label="Empleados activos" value={employees.count??0} tone="green" icon={<Users size={18}/>} sub="En todas las áreas" href="/admin/empleados"/>
   <KpiCard label="Jornadas abiertas" value={open.count??0} tone="amber" icon={<Clock3 size={18}/>} sub="Entrada sin salida registrada" href="/admin/asistencia"/>
   <KpiCard label="Ausencias por revisar" value={pending.count??0} tone="navy" icon={<ClipboardList size={18}/>} sub="Vacaciones, permisos e incapacidades" href="/admin/ausencias"/>
   <KpiCard label="Recordatorios en alarma" value={alerts} tone={alerts?"danger":"navy"} icon={<AlarmClock size={18}/>} sub="Trámites y renovaciones por atender" href="/admin/recordatorios?vista=alarmas"/>
  </div>
  <div className="notice">
   <div><strong>Antes de cerrar la planilla</strong><p>Resuelve las marcas faltantes y revisa los conceptos de pago de cada empleado.</p></div>
   <Link href="/admin/planilla" className="button">Revisar planilla</Link>
  </div>
  <Panel title="Últimas jornadas" action={<Link className="text-link" href="/admin/asistencia">Ver asistencia →</Link>}>
   {!sessions.data?.length?<Empty text="Las jornadas de la tablet aparecerán aquí."/>:(
    <Table headers={["Empleado","Área","Entrada → Salida","Horas","Estado"]}>
     {sessions.data.map(s=>{
      const emp=s.employees as unknown as {full_name:string;department:string}|null;
      const hours=s.worked_hours==null?null:Number(s.worked_hours);
      const openShift=!s.ended_at;
      return (
       <tr key={s.id}>
        <td><strong>{emp?.full_name??"—"}</strong></td>
        <td>{emp?.department??"—"}</td>
        <td className="tabular">{jornadaLabel(s.started_at,s.ended_at)}</td>
        <td className="tabular">{hours==null?"—":`${hours.toFixed(2)} h`}</td>
        <td>
         {openShift?(
          <Badge tone="pending">Abierta</Badge>
         ):s.adjusted?(
          <Badge tone="pending">Ajustada</Badge>
         ):(
          <Badge tone="approved">Cerrada</Badge>
         )}
        </td>
       </tr>
      );
     })}
    </Table>
   )}
  </Panel>
 </>;
}
