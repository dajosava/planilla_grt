import Link from "next/link";
import {AlarmClock,BellRing,CalendarClock,CheckCircle2,FileWarning} from "lucide-react";
import {requireRole} from "@/lib/auth";
import {Heading,Panel,CollapsiblePanel,Empty} from "@/components/admin-ui";
import {ActionForm} from "@/components/action-form";
import {KpiCard} from "@/components/ui/kpi-card";
import {RemindersDirectory,type ReminderListItem} from "@/components/reminders-directory";
import {COMPANIES} from "@/lib/companies";
import {todayCR} from "@/lib/format";
import {REMINDER_CATEGORIES,reminderUrgency} from "@/lib/reminders";
import {saveReminder} from "./actions";

export default async function Page({searchParams}:{searchParams:Promise<{vista?:string}>}){
 const {client}=await requireRole("admin");
 const params=await searchParams;
 const vista=typeof params.vista==="string"?params.vista:"abiertos";
 const today=todayCR();

 const {data,error}=await client.from("business_reminders")
  .select("*,business_reminder_documents(id,file_name,mime_type,file_size,created_at)")
  .order("due_on",{ascending:true});
 if(error)throw new Error("No se pudieron cargar los recordatorios. Aplicá las migraciones 202610190004 y 202610190005.");

 const all=(data??[]).map((r):ReminderListItem=>({
  id:r.id,
  title:r.title,
  description:r.description??"",
  category:r.category,
  company:r.company??null,
  due_on:r.due_on,
  alert_days:Number(r.alert_days),
  reference_code:r.reference_code??"",
  status:r.status,
  completed_at:r.completed_at??null,
  completed_note:r.completed_note??"",
  business_reminder_documents:r.business_reminder_documents??[],
 }));
 const open=all.filter(r=>r.status==="open");
 const closed=all.filter(r=>r.status!=="open");

 const overdue=open.filter(r=>reminderUrgency(r)==="overdue");
 const urgent=open.filter(r=>reminderUrgency(r)==="urgent");
 const soon=open.filter(r=>reminderUrgency(r)==="soon");

 const list=
  vista==="vencidos"?overdue:
  vista==="alarmas"?[...overdue,...urgent,...soon]:
  vista==="atendidos"?closed:
  open;

 return <>
  <Heading
   title="Recordatorios y documentación"
   description="Trámites, permisos y renovaciones con fecha límite. El sistema genera alarmas tempranas para que las atiendas a tiempo."
  />

  <div className="stats">
   <KpiCard label="Activos" value={open.length} tone="green" icon={<BellRing size={18}/>} sub="Recordatorios abiertos por atender" href="/admin/recordatorios?vista=abiertos"/>
   <KpiCard label="Vencidos" value={overdue.length} tone={overdue.length?"danger":"navy"} icon={<FileWarning size={18}/>} sub="Ya pasó la fecha límite" href="/admin/recordatorios?vista=vencidos"/>
   <KpiCard label="Urgentes" value={urgent.length} tone={urgent.length?"danger":"navy"} icon={<AlarmClock size={18}/>} sub="Vencen en 7 días o menos" href="/admin/recordatorios?vista=alarmas"/>
   <KpiCard label="Alarmas tempranas" value={soon.length} tone={soon.length?"orange":"navy"} icon={<CalendarClock size={18}/>} sub="Dentro del plazo de aviso" href="/admin/recordatorios?vista=alarmas"/>
   <KpiCard label="Atendidos" value={closed.filter(r=>r.status==="done").length} tone="green" icon={<CheckCircle2 size={18}/>} sub="Cerrados correctamente" href="/admin/recordatorios?vista=atendidos"/>
  </div>

  <CollapsiblePanel title="Nuevo recordatorio">
   <p className="muted small">Definí la fecha límite y cuántos días antes querés que empiece a alertar (ej. 30 = un mes de anticipación).</p>
   <ActionForm action={saveReminder} submit="Crear recordatorio">
    <label>Título<input name="title" required minLength={3} maxLength={160} placeholder="Ej. Renovación permiso de funcionamiento"/></label>
    <label>Categoría<select name="category" defaultValue="tramite">{REMINDER_CATEGORIES.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
    <label>Sociedad (opcional)<select name="company" defaultValue="">
     <option value="">Todas / general</option>
     {COMPANIES.map(c=><option key={c}>{c}</option>)}
    </select></label>
    <label>Fecha límite<input name="due_on" type="date" required min={today}/></label>
    <label>Alarma temprana (días antes)<input name="alert_days" type="number" min={1} max={365} defaultValue={30} required/><small className="muted">Aviso desde N días antes + urgente los últimos 7.</small></label>
    <label>Nº expediente / referencia<input name="reference_code" maxLength={80} placeholder="Opcional"/></label>
    <label>Notas / documentación<textarea name="description" rows={3} maxLength={2000} placeholder="Qué hay que hacer, dónde se gestiona, documentos necesarios…"/></label>
   </ActionForm>
  </CollapsiblePanel>

  <Panel title="Lista de recordatorios">
   <nav className="company-tabs" aria-label="Filtrar recordatorios">
    <Link className={vista==="abiertos"?"active":""} href="/admin/recordatorios?vista=abiertos">Abiertos ({open.length})</Link>
    <Link className={vista==="vencidos"?"active":""} href="/admin/recordatorios?vista=vencidos">Vencidos ({overdue.length})</Link>
    <Link className={vista==="alarmas"?"active":""} href="/admin/recordatorios?vista=alarmas">En alarma ({overdue.length+urgent.length+soon.length})</Link>
    <Link className={vista==="atendidos"?"active":""} href="/admin/recordatorios?vista=atendidos">Atendidos ({closed.length})</Link>
   </nav>

   {!list.length?(
    <Empty text={vista==="atendidos"?"Todavía no hay trámites cerrados.":"No hay recordatorios en esta vista."}/>
   ):(
    <RemindersDirectory reminders={list}/>
   )}
  </Panel>
 </>;
}
