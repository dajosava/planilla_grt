import Link from "next/link";
import {employees} from "@/lib/data";
import {todayCR} from "@/lib/format";
import {Heading,Panel,Empty} from "@/components/admin-ui";
import {ActionForm} from "@/components/action-form";
import {EmployeeSelect} from "@/components/employee-select";
import {EmployeesDirectory,type EmployeeListItem} from "@/components/employees-directory";
import {EmployeesAreaFilter} from "@/components/employees-area-filter";
import {EmployeePayFields} from "@/components/employee-pay-fields";
import {HolidaysCalendar,type HolidayItem} from "@/components/holidays-calendar";
import {COMPANIES,isCompany} from "@/lib/companies";
import {requireRole} from "@/lib/auth";
import {createEmployee,resetPin,vacationBalance} from "../actions";

const TABS=[
 {id:"directorio",label:"Directorio"},
 {id:"registrar",label:"Registrar empleado"},
 {id:"pin",label:"Restablecer PIN"},
 {id:"vacaciones",label:"Ajustar saldo de vacaciones"},
 {id:"feriados",label:"Feriados"},
] as const;

type TabId=(typeof TABS)[number]["id"];

function isTab(v:unknown):v is TabId{
 return typeof v==="string"&&TABS.some(t=>t.id===v);
}

export default async function Page({
 searchParams,
}:{
 searchParams:Promise<{area?:string;tab?:string;year?:string}>;
}){
 const list=await employees();
 const params=await searchParams;
 const tab:TabId=isTab(params.tab)?params.tab:"directorio";
 const area=typeof params.area==="string"&&isCompany(params.area)?params.area:null;
 const filtered=area?list.filter(e=>e.department===area):list;
 const counts=Object.fromEntries(COMPANIES.map(c=>[c,list.filter(e=>e.department===c).length])) as Record<string,number>;
 const today=todayCR();
 const yearRaw=Number(params.year);
 const holidayYear=Number.isFinite(yearRaw)&&yearRaw>=2000&&yearRaw<=2100
  ?Math.trunc(yearRaw)
  :Number(today.slice(0,4));

 let holidays:HolidayItem[]=[];
 if(tab==="feriados"){
  try{
   const {client}=await requireRole("admin");
   const {data}=await client.rpc("list_holidays",{p_year:holidayYear});
   if(data&&typeof data==="object"&&Array.isArray((data as {holidays?:unknown}).holidays)){
    holidays=((data as {holidays:Record<string,unknown>[]}).holidays).map(h=>({
     date:String(h.date??"").slice(0,10),
     name:String(h.name??"Feriado"),
    })).filter(h=>/^\d{4}-\d{2}-\d{2}$/.test(h.date));
   }
  }catch{/* RPC aún no migrado */}
 }

 const directory:EmployeeListItem[]=filtered.map(e=>({
  id:e.id,
  code:e.code,
  full_name:e.full_name,
  cedula:e.cedula??null,
  email:e.email??null,
  department:e.department,
  position:e.position,
  hired_on:e.hired_on,
  monthly_salary_cents:Number(e.monthly_salary_cents),
  hours_per_month:e.hours_per_month==null?null:Number(e.hours_per_month),
  vacation_balance:Number(e.vacation_balance),
  exempt_from_ccss:!!e.exempt_from_ccss,
  pay_by_hours:!!(e as {pay_by_hours?:boolean}).pay_by_hours,
  hourly_rate_cents:Number((e as {hourly_rate_cents?:number}).hourly_rate_cents??0),
  active:!!e.active,
 }));

 const tabHref=(id:TabId)=>{
  const q=new URLSearchParams();
  if(id!=="directorio")q.set("tab",id);
  if(id==="directorio"&&area)q.set("area",area);
  if(id==="feriados")q.set("year",String(holidayYear));
  const s=q.toString();
  return s?`/admin/empleados?${s}`:"/admin/empleados";
 };

 return <>
  <Heading
   title="Empleados"
   actions={
    <nav className="module-tabs" aria-label="Secciones de empleados">
     {TABS.map(t=>(
      <Link
       key={t.id}
       href={tabHref(t.id)}
       className={tab===t.id?"active":""}
       aria-current={tab===t.id?"page":undefined}
      >
       {t.label}
      </Link>
     ))}
    </nav>
   }
  />

  {tab==="directorio"&&(
   <Panel title="">
    <div className="empleados-dir-toolbar">
     <EmployeesAreaFilter area={area} counts={counts} total={list.length}/>
    </div>
    {area?<p className="muted small">Mostrando {filtered.length} de {area}.</p>:null}
    {!list.length?<Empty text="Registra el primer empleado para comenzar."/>:(
     !filtered.length?<Empty text={area?`No hay empleados en ${area}.`:"No hay empleados."}/>:(
      <EmployeesDirectory employees={directory} today={today}/>
     )
    )}
   </Panel>
  )}

  {tab==="registrar"&&(
   <Panel title="Registrar empleado">
    <ActionForm action={createEmployee} submit="Crear empleado">
     <label>Código<input name="code" placeholder="1" pattern="[A-Za-z0-9-]{1,12}" required minLength={1} maxLength={12}/></label>
     <label>Nombre completo<input name="full_name" required minLength={3} maxLength={120}/></label>
     <label>Cédula<input name="cedula" inputMode="numeric" pattern="[0-9\-]{9,14}" placeholder="1-2345-6789" required minLength={9} maxLength={14}/></label>
     <label>Correo electrónico<input name="email" type="email" placeholder="empleado@ejemplo.com" required maxLength={254} autoComplete="email"/></label>
     <label>Sociedad / planilla<select name="department" defaultValue="Gasolinera">{COMPANIES.map(v=><option key={v}>{v}</option>)}</select></label>
     <label>Puesto<input name="position" required minLength={2} maxLength={80}/></label>
     <label>Fecha de ingreso<input name="hired_on" type="date" defaultValue={today} max={today} min="1950-01-01" required/></label>
     <EmployeePayFields vacationMode="create"/>
     <label>PIN inicial (4 dígitos)<input name="pin" type="password" inputMode="numeric" pattern="[0-9]{4}" minLength={4} maxLength={4} autoComplete="new-password" required/></label>
    </ActionForm>
   </Panel>
  )}

  {tab==="pin"&&(
   <Panel title="Restablecer PIN">
    {!list.length?(
     <Empty text="Primero registrá un empleado."/>
    ):(
     <ActionForm action={resetPin}>
      <EmployeeSelect employees={list}/>
      <label>Nuevo PIN (4 dígitos)<input name="pin" type="password" pattern="[0-9]{4}" minLength={4} maxLength={4} inputMode="numeric" required autoComplete="new-password"/></label>
     </ActionForm>
    )}
   </Panel>
  )}

  {tab==="vacaciones"&&(
   <Panel title="Ajustar saldo de vacaciones">
    {!list.length?(
     <Empty text="Primero registrá un empleado."/>
    ):(
     <>
      <p className="muted small">Registra acreditaciones o correcciones validadas. El sistema no acumula días automáticamente.</p>
      <ActionForm action={vacationBalance}>
       <EmployeeSelect employees={list}/>
       <label>Días (+ acreditar / − descontar)<input name="days" type="number" min="-365" max="365" step="0.01" required/></label>
       <label>Motivo<input name="reason" minLength={5} maxLength={500} required/></label>
      </ActionForm>
     </>
    )}
   </Panel>
  )}

  {tab==="feriados"&&(
   <Panel title={`Calendario de feriados · ${holidayYear}`}>
    <HolidaysCalendar year={holidayYear} holidays={holidays}/>
   </Panel>
  )}
 </>;
}
