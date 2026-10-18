import {Suspense} from "react";
import Link from "next/link";
import {AlertTriangle,CheckCircle2,ClipboardList,Loader2,Percent,ShieldAlert} from "lucide-react";
import {requireRole} from "@/lib/auth";
import {Heading,Panel,Empty,Table} from "@/components/admin-ui";
import {GenerateTasksButton} from "@/components/generate-tasks-button";
import {AreaBars,DayBars,EmployeeBars,StatusDonut} from "@/components/ops-charts";
import {OpsTaskBoard,type BoardTask} from "@/components/ops-task-board";
import {OpsNavBar} from "@/components/ops-nav-bar";
import {KpiCard} from "@/components/ui/kpi-card";
import {Badge} from "@/components/ui/badge";
import type {OpsDashboard} from "@/lib/ops";
import {dateOnly,todayCR} from "@/lib/format";

function addDays(iso:string,n:number){
 const d=new Date(iso+"T12:00:00Z");
 d.setUTCDate(d.getUTCDate()+n);
 return d.toISOString().slice(0,10);
}
function parseDay(v:string|string[]|undefined,fallback:string){
 return typeof v==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(v)?v:fallback;
}
function qs(base:Record<string,string>,extra?:Record<string,string|undefined>){
 const p=new URLSearchParams(base);
 if(extra)Object.entries(extra).forEach(([k,v])=>{if(v)p.set(k,v);else p.delete(k)});
 return `?${p.toString()}`;
}

export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const {client}=await requireRole("admin");
 const params=await searchParams;
 const today=todayCR();
 const from=parseDay(params.desde,parseDay(params.fecha,today));
 const to=parseDay(params.hasta,from);
 const weekStart=addDays(today,-6);
 const monthStart=`${today.slice(0,8)}01`;
 const estado=typeof params.estado==="string"?params.estado:undefined;
 const area=typeof params.area==="string"?params.area:undefined;

 const {data,error}=await client.rpc("ops_dashboard",{p_from:from,p_to:to});
 if(error)throw new Error(error.message.includes("rango")||error.message.includes("fecha")?error.message:"No se pudo cargar el dashboard de operaciones");
 const dash=data as OpsDashboard;

 const {data:tasksRaw}=await client.from("tasks")
  .select("id,title,area,status,due_at,run_date,assignee:assigned_employee_id(full_name,code)")
  .gte("run_date",from).lte("run_date",to).order("due_at",{ascending:true}).limit(100);

 const tasks:BoardTask[]=(tasksRaw??[]).map(t=>({
  id:t.id,title:t.title,area:t.area,status:t.status,due_at:t.due_at,run_date:t.run_date,
  assignee:(t.assignee as BoardTask["assignee"])??null,
 }));

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

 const base={desde:from,hasta:to};
 const rangeLabel=sameDay?dateOnly(from):`${dateOnly(from)} → ${dateOnly(to)}`;

 return <>
  <Heading
   title="Operaciones"
   description={`Cumplimiento del turno · ${rangeLabel}. Un vistazo y sabes cómo va el día.`}
   actions={<GenerateTasksButton/>}
  />

  <OpsNavBar/>

  <Panel title="Periodo">
   <form className="filters ops-dash-filters" method="get">
    <label>Desde<input type="date" name="desde" defaultValue={from} required/></label>
    <label>Hasta<input type="date" name="hasta" defaultValue={to} required/></label>
    {estado&&<input type="hidden" name="estado" value={estado}/>}
    {area&&<input type="hidden" name="area" value={area}/>}
    <button type="submit">Aplicar</button>
   </form>
   <div className="ops-dash-presets" role="group" aria-label="Filtros rápidos">
    <Link className={`chip${from===today&&to===today?" active":""}`} href={`/admin/operaciones${qs({desde:today,hasta:today})}`}>Hoy</Link>
    <Link className={`chip${from===weekStart&&to===today?" active":""}`} href={`/admin/operaciones${qs({desde:weekStart,hasta:today})}`}>Últimos 7 días</Link>
    <Link className={`chip${from===monthStart&&to===today?" active":""}`} href={`/admin/operaciones${qs({desde:monthStart,hasta:today})}`}>Mes en curso</Link>
   </div>
  </Panel>

  <div className="stats">
   <KpiCard
    label="Cumplimiento" value={`${pct}%`} tone="green" icon={<Percent size={18}/>} progress={pct}
    sub={`${done} de ${total} tareas`} title="Porcentaje de tareas completadas o aprobadas en el periodo"
    href={`/admin/operaciones${qs(base)}`}
   />
   <KpiCard
    label="Pendientes" value={t?.pending??0} tone="orange" icon={<ClipboardList size={18}/>}
    sub="Por iniciar"
    badge={(t?.late??0)>0?<Badge tone="late"><AlertTriangle size={12}/> {t.late} atrasadas</Badge>:undefined}
    href={`/admin/operaciones${qs(base,{estado:"pending"})}`}
   />
   <KpiCard
    label="En proceso" value={t?.in_progress??0} tone="amber" icon={<Loader2 size={18}/>}
    sub="En ejecución"
    badge={(dash.unassigned??0)>0?<Badge tone="pending">{dash.unassigned} sin asignar</Badge>:undefined}
    href={`/admin/operaciones${qs(base,{estado:"in_progress"})}`}
   />
   <KpiCard
    label="Completadas" value={(t?.completed??0)+(t?.approved??0)} tone="green" icon={<CheckCircle2 size={18}/>}
    sub={`${t?.approved??0} aprobadas · ${t?.rejected??0} rechazadas`}
    href={`/admin/operaciones${qs(base,{estado:"completed"})}`}
   />
   <KpiCard
    label="Incidentes" value={dash.incidents?.open??0} tone={(dash.incidents?.critical??0)>0?"danger":"navy"} icon={<ShieldAlert size={18}/>}
    sub={`${dash.incidents?.reported??0} reportados en el periodo`}
    badge={(dash.incidents?.critical??0)>0?<Badge tone="critical">{dash.incidents!.critical} críticos</Badge>:undefined}
    href="/admin/incidentes"
   />
  </div>

  <div className="two-col">
   <Panel title="Estados">{!statusItems.length?<Empty text="Sin tareas en el periodo."/>:(
    <Suspense fallback={<Empty text="Cargando gráfica…"/>}><StatusDonut items={statusItems}/></Suspense>
   )}</Panel>
   <Panel title={sameDay?"Áreas del día":"Áreas del periodo"}>{!(dash.by_area?.length)?<Empty text="Sin datos por área."/>:<AreaBars areas={dash.by_area}/>}</Panel>
  </div>

  {!sameDay&&<Panel title="Tendencia diaria">{!(dash.by_day?.length)?<Empty text="Sin datos diarios."/>:<DayBars days={dash.by_day}/>}</Panel>}

  <div className="two-col">
   <Panel title="Por empleado asignado">{!(dash.by_employee?.length)?<Empty text="No hay tareas asignadas en este periodo."/>:<EmployeeBars rows={dash.by_employee}/>}</Panel>
   <Panel title="Resumen por área">{!(dash.by_area?.length)?<Empty/>:<Table headers={["Área","Pend.","Proceso","Hechas","Total","%"]}>{dash.by_area.map(a=>{
    const p=a.total?Math.round(a.done*100/a.total):0;
    const tone=p<50?"late":p<80?"pending":"approved";
    return <tr key={a.area}><td>{a.area}</td><td>{a.pending}</td><td>{a.in_progress}</td><td>{a.done}</td><td>{a.total}</td><td><Badge tone={tone}>{p}%</Badge></td></tr>;
   })}</Table>}</Panel>
  </div>

  <Panel title="Tablero de tareas" action={<Link className="text-link" href="/admin/operaciones/tareas">Asignar y aprobar →</Link>}>
   <OpsTaskBoard tasks={tasks} filterStatus={estado} filterArea={area} nowMs={Date.now()}/>
  </Panel>
 </>;
}
