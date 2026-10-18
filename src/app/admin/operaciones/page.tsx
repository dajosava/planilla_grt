import Link from "next/link";
import {requireRole} from "@/lib/auth";
import {Heading,Panel,Empty,Table} from "@/components/admin-ui";
import {GenerateTasksButton} from "@/components/generate-tasks-button";
import {AreaBars,DayBars,EmployeeBars,StatusDonut} from "@/components/ops-charts";
import type {OpsDashboard} from "@/lib/ops";
import {dateTime,todayCR} from "@/lib/format";

function addDays(iso:string,n:number){
 const d=new Date(iso+"T12:00:00Z");
 d.setUTCDate(d.getUTCDate()+n);
 return d.toISOString().slice(0,10);
}

function parseDay(v:string|string[]|undefined,fallback:string){
 return typeof v==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(v)?v:fallback;
}

export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const {client}=await requireRole("admin");
 const params=await searchParams;
 const today=todayCR();
 const from=parseDay(params.desde,parseDay(params.fecha,today));
 const to=parseDay(params.hasta,from);
 const weekStart=addDays(today,-6);

 const {data,error}=await client.rpc("ops_dashboard",{p_from:from,p_to:to});
 if(error)throw new Error(error.message.includes("rango")||error.message.includes("fecha")?error.message:"No se pudo cargar el dashboard de operaciones");
 const dash=data as OpsDashboard;

 const {data:tasks}=await client.from("tasks")
  .select("id,title,area,status,due_at,run_date,assignee:assigned_employee_id(full_name,code)")
  .gte("run_date",from).lte("run_date",to).order("due_at",{ascending:false}).limit(40);

 const t=dash.tasks;
 const total=t?.total??0;
 const done=t?.done??((t?.completed??0)+(t?.approved??0));
 const pct=total?Math.round(done*100/total):0;
 const sameDay=from===to;
 const statusItems=(dash.by_status?.length?dash.by_status:[
  {status:"pending",count:t?.pending??0},
  {status:"in_progress",count:t?.in_progress??0},
  {status:"completed",count:t?.completed??0},
  {status:"approved",count:t?.approved??0},
  {status:"rejected",count:t?.rejected??0},
 ]).filter(s=>s.count>0);

 const statusLabel:Record<string,string>={pending:"Pendiente",in_progress:"En proceso",completed:"Completada",approved:"Aprobada",rejected:"Rechazada"};

 return <>
  <Heading title="Dashboard de operaciones" description="Cumplimiento de tareas diarias, estados, áreas y responsables. Filtra por fechas para ver el periodo."/>

  <nav className="ops-nav-bar" aria-label="Módulos de operaciones">
   <Link className="button" href="/admin/operaciones/plantillas">Plantillas</Link>
   <Link className="button" href="/admin/operaciones/tareas">Todas las tareas</Link>
   <Link className="button" href="/admin/incidentes">Incidentes</Link>
  </nav>

  <Panel title="Filtro de fechas">
   <form className="filters ops-dash-filters" method="get">
    <label>Desde<input type="date" name="desde" defaultValue={from} required/></label>
    <label>Hasta<input type="date" name="hasta" defaultValue={to} required/></label>
    <button type="submit">Aplicar</button>
   </form>
   <div className="ops-dash-presets">
    <Link className="chip" href={`/admin/operaciones?desde=${today}&hasta=${today}`}>Hoy</Link>
    <Link className="chip" href={`/admin/operaciones?desde=${weekStart}&hasta=${today}`}>Últimos 7 días</Link>
    <Link className="chip" href={`/admin/operaciones?desde=${today.slice(0,8)}01&hasta=${today}`}>Mes en curso</Link>
   </div>
  </Panel>

  <div className="notice"><strong>Generación de tareas</strong><p>Las plantillas activas crean una tarea por día. Usa el botón si el cron aún no está configurado.</p><GenerateTasksButton/></div>

  <div className="stats">
   <div><span className="eyebrow">CUMPLIMIENTO</span><h2>{pct}%</h2><p className="muted">{done} de {total} tareas {sameDay?`el ${from}`:`del ${from} al ${to}`}</p></div>
   <div><span className="eyebrow">PENDIENTES</span><h2>{t?.pending??0}</h2><p className="muted">{t?.late??0} atrasadas</p></div>
   <div><span className="eyebrow">EN PROCESO</span><h2>{t?.in_progress??0}</h2><p className="muted">{dash.unassigned??0} sin asignar</p></div>
   <div><span className="eyebrow">COMPLETADAS</span><h2>{(t?.completed??0)+(t?.approved??0)}</h2><p className="muted">{t?.approved??0} aprobadas · {t?.rejected??0} rechazadas</p></div>
   <div><span className="eyebrow">INCIDENTES</span><h2>{dash.incidents?.open??0} abiertos</h2><p className="muted">{dash.incidents?.reported??0} reportados · {dash.incidents?.critical??0} críticos</p></div>
  </div>

  <div className="two-col">
   <Panel title="Estados">{!statusItems.length?<Empty text="Sin tareas en el periodo."/>:<StatusDonut items={statusItems}/>}</Panel>
   <Panel title={sameDay?"Áreas del día":"Áreas del periodo"}>{!(dash.by_area?.length)?<Empty text="Sin datos por área."/>:<AreaBars areas={dash.by_area}/>}</Panel>
  </div>

  {!sameDay&&<Panel title="Tendencia diaria">{!(dash.by_day?.length)?<Empty text="Sin datos diarios."/>:<DayBars days={dash.by_day}/>}</Panel>}

  <div className="two-col">
   <Panel title="Por empleado asignado">{!(dash.by_employee?.length)?<Empty text="No hay tareas asignadas en este periodo."/>:<EmployeeBars rows={dash.by_employee}/>}</Panel>
   <Panel title="Resumen por área">{!(dash.by_area?.length)?<Empty/>:<Table headers={["Área","Pend.","Proceso","Hechas","Total","%"]}>{dash.by_area.map(a=>{
    const p=a.total?Math.round(a.done*100/a.total):0;
    return <tr key={a.area}><td>{a.area}</td><td>{a.pending}</td><td>{a.in_progress}</td><td>{a.done}</td><td>{a.total}</td><td>{p}%</td></tr>;
   })}</Table>}</Panel>
  </div>

  <Panel title={`Tareas del periodo (${tasks?.length??0})`}>
   {!tasks?.length?<Empty text="No hay tareas en este rango. Genera o amplía las fechas."/>:<Table headers={["Fecha","Tarea","Área","Estado","Asignado","Vence"]}>{tasks.map(task=>{
    const assignee=task.assignee as {full_name?:string;code?:string}|null;
    const late=["pending","in_progress"].includes(task.status)&&new Date(task.due_at)<new Date();
    return <tr key={task.id}>
     <td>{task.run_date}</td>
     <td><Link href={`/admin/operaciones/tareas?fecha=${task.run_date}`}><strong>{task.title}</strong></Link></td>
     <td>{task.area}</td>
     <td><span className={`badge${late||task.status==="rejected"?" danger":""}`}>{statusLabel[task.status]??task.status}</span></td>
     <td>{assignee?`${assignee.full_name} (${assignee.code})`:<span className="muted">Sin asignar</span>}</td>
     <td>{dateTime(task.due_at)}</td>
    </tr>;
   })}</Table>}
  </Panel>
 </>;
}
