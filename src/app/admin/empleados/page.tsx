import Link from "next/link";
import {employees} from "@/lib/data";
import {todayCR} from "@/lib/format";
import {Heading,CollapsiblePanel,Empty} from "@/components/admin-ui";
import {ActionForm} from "@/components/action-form";
import {EmployeeSelect} from "@/components/employee-select";
import {EmployeesDirectory,type EmployeeListItem} from "@/components/employees-directory";
import {COMPANIES,isCompany} from "@/lib/companies";
import {createEmployee,resetPin,vacationBalance} from "../actions";

export default async function Page({searchParams}:{searchParams:Promise<{area?:string}>}){
 const list=await employees();
 const params=await searchParams;
 const area=typeof params.area==="string"&&isCompany(params.area)?params.area:null;
 const filtered=area?list.filter(e=>e.department===area):list;
 const counts=Object.fromEntries(COMPANIES.map(c=>[c,list.filter(e=>e.department===c).length])) as Record<string,number>;
 const today=todayCR();

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
  active:!!e.active,
 }));

 return <>
  <Heading title="Empleados" description="Cada persona pertenece a una sociedad: Gasolinera, Supermercado o Transporte (planilla separada)."/>
  <CollapsiblePanel title={area?`Directorio · ${area}`:"Directorio"}>
   <nav className="company-tabs" aria-label="Filtrar por sociedad">
    <Link className={!area?"active":""} href="/admin/empleados">Todas ({list.length})</Link>
    {COMPANIES.map(c=>(
     <Link key={c} className={area===c?"active":""} href={`/admin/empleados?area=${encodeURIComponent(c)}`}>{c} ({counts[c]??0})</Link>
    ))}
   </nav>
   {area?<p className="muted small">Mostrando {filtered.length} de {area}.</p>:null}
   {!list.length?<Empty text="Registra el primer empleado para comenzar."/>:(
    !filtered.length?<Empty text={area?`No hay empleados en ${area}.`:"No hay empleados."}/>:(
     <EmployeesDirectory employees={directory} today={today}/>
    )
   )}
  </CollapsiblePanel>

  <CollapsiblePanel title="Registrar empleado">
   <ActionForm action={createEmployee} submit="Crear empleado">
    <label>Código<input name="code" placeholder="1" pattern="[A-Za-z0-9-]{1,12}" required minLength={1} maxLength={12}/></label>
    <label>Nombre completo<input name="full_name" required minLength={3} maxLength={120}/></label>
    <label>Cédula<input name="cedula" inputMode="numeric" pattern="[0-9\-]{9,14}" placeholder="1-2345-6789" required minLength={9} maxLength={14}/></label>
    <label>Correo electrónico<input name="email" type="email" placeholder="empleado@ejemplo.com" required maxLength={254} autoComplete="email"/></label>
    <label>Sociedad / planilla<select name="department" defaultValue="Gasolinera">{COMPANIES.map(v=><option key={v}>{v}</option>)}</select></label>
    <label>Puesto<input name="position" required minLength={2} maxLength={80}/></label>
    <label>Fecha de ingreso<input name="hired_on" type="date" defaultValue={today} max={today} min="1950-01-01" required/></label>
    <label>Salario mensual (CRC)<input name="salary" type="number" min="0" step="0.01" required/></label>
    <label>Horas ordinarias / mes<input name="hours_month" type="number" min="1" max="400" step="0.01" defaultValue={243.36} required/></label>
    <label className="checkbox"><input name="exempt_from_ccss" type="checkbox"/>Exento de CCSS</label>
    <label>Saldo inicial de vacaciones (días)<input name="vacation_balance" type="number" min="0" max="365" step="0.01" defaultValue="0" required/></label>
    <label>PIN inicial (4 dígitos)<input name="pin" type="password" inputMode="numeric" pattern="[0-9]{4}" minLength={4} maxLength={4} autoComplete="new-password" required/></label>
   </ActionForm>
  </CollapsiblePanel>

  {list.length>0&&<div className="two-col">
   <CollapsiblePanel title="Restablecer PIN">
    <ActionForm action={resetPin}>
     <EmployeeSelect employees={list}/>
     <label>Nuevo PIN (4 dígitos)<input name="pin" type="password" pattern="[0-9]{4}" minLength={4} maxLength={4} inputMode="numeric" required autoComplete="new-password"/></label>
    </ActionForm>
   </CollapsiblePanel>
   <CollapsiblePanel title="Ajustar saldo de vacaciones">
    <p className="muted small">Registra acreditaciones o correcciones validadas. El sistema no acumula días automáticamente.</p>
    <ActionForm action={vacationBalance}>
     <EmployeeSelect employees={list}/>
     <label>Días (+ acreditar / − descontar)<input name="days" type="number" min="-365" max="365" step="0.01" required/></label>
     <label>Motivo<input name="reason" minLength={5} maxLength={500} required/></label>
    </ActionForm>
   </CollapsiblePanel>
  </div>}
 </>;
}
