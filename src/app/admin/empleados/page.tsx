import {employees} from "@/lib/data";
import {money,dateOnly,todayCR,cedula} from "@/lib/format";
import {Heading,CollapsiblePanel,Empty} from "@/components/admin-ui";
import {ActionForm} from "@/components/action-form";
import {EmployeeSelect} from "@/components/employee-select";
import {DeleteEmployee} from "@/components/delete-employee";
import {Badge} from "@/components/ui/badge";
import {createEmployee,updateEmployee,resetPin,vacationBalance,toggleEmployee,deleteEmployee} from "../actions";

const DEPTS=["Pista","Supermercado","Tienda","Transporte","Administración"];

export default async function Page(){
 const list=await employees();
 const today=todayCR();
 return <>
  <Heading title="Empleados" description="El equipo de Gasolinera Río Tempisque, organizado por área."/>
  <CollapsiblePanel title="Directorio">
   <p className="muted small">Tocá un empleado para ver y editar sus datos.</p>
   <div className="directory-scroll">
    {!list.length?<Empty text="Registra el primer empleado para comenzar."/>:list.map(e=>(
     <details key={e.id} className="employee-dir-row">
      <summary>
       <span className="employee-dir-main">
        <strong>{e.full_name}</strong>
        <small>{e.code} · {cedula(e.cedula)}</small>
       </span>
       <span className="employee-dir-meta muted small">{e.department} · {e.position}</span>
       <strong className="tabular">{money(e.monthly_salary_cents)}</strong>
       <Badge tone={e.active?"approved":"pending"}>{e.active?"Activo":"Inactivo"}</Badge>
      </summary>
      <div className="employee-dir-body">
       <p className="muted small">Ingreso {dateOnly(e.hired_on)} · Vacaciones {e.vacation_balance} días{e.email?` · ${e.email}`:""}</p>
       <ActionForm action={updateEmployee} submit="Guardar cambios">
        <input name="id" type="hidden" value={e.id}/>
        <label>Nombre<input name="full_name" defaultValue={e.full_name} required minLength={3} maxLength={120}/></label>
        <label>Cédula<input name="cedula" defaultValue={e.cedula??""} inputMode="numeric" pattern="[0-9\-]{9,14}" placeholder="1-2345-6789" required minLength={9} maxLength={14}/></label>
        <label>Correo electrónico<input name="email" type="email" defaultValue={e.email??""} placeholder="empleado@ejemplo.com" required maxLength={254} autoComplete="email"/></label>
        <label>Área<select name="department" defaultValue={e.department}>{DEPTS.map(v=><option key={v}>{v}</option>)}</select></label>
        <label>Puesto<input name="position" defaultValue={e.position} required minLength={2} maxLength={80}/></label>
        <label>Fecha de ingreso<input name="hired_on" type="date" defaultValue={e.hired_on} max={today} min="1950-01-01" required/></label>
        <label>Salario mensual (CRC)<input name="salary" type="number" min="0" step="0.01" defaultValue={e.monthly_salary_cents/100} required/></label>
        <label>Horas ordinarias / mes<input name="hours_month" type="number" min="1" max="400" step="0.01" defaultValue={Number(e.hours_per_month??243.36)} required/><small className="muted">Default 243.36 (30.42×8). Define el valor hora.</small></label>
        <label className="checkbox"><input name="exempt_from_ccss" type="checkbox" defaultChecked={!!e.exempt_from_ccss}/>Exento de CCSS (caso especial)</label>
       </ActionForm>
       <div className="row-actions employee-delete">
        <form action={toggleEmployee}>
         <input type="hidden" name="id" value={e.id}/>
         <input type="hidden" name="active" value={String(!e.active)}/>
         <button className="secondary small-button">{e.active?"Desactivar":"Reactivar"}</button>
        </form>
        <DeleteEmployee id={e.id} name={e.full_name} code={e.code} action={deleteEmployee}/>
       </div>
      </div>
     </details>
    ))}
   </div>
  </CollapsiblePanel>

  <CollapsiblePanel title="Registrar empleado">
   <ActionForm action={createEmployee} submit="Crear empleado">
    <label>Código<input name="code" placeholder="1" pattern="[A-Za-z0-9-]{1,12}" required minLength={1} maxLength={12}/></label>
    <label>Nombre completo<input name="full_name" required minLength={3} maxLength={120}/></label>
    <label>Cédula<input name="cedula" inputMode="numeric" pattern="[0-9\-]{9,14}" placeholder="1-2345-6789" required minLength={9} maxLength={14}/></label>
    <label>Correo electrónico<input name="email" type="email" placeholder="empleado@ejemplo.com" required maxLength={254} autoComplete="email"/></label>
    <label>Área<select name="department">{DEPTS.map(v=><option key={v}>{v}</option>)}</select></label>
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
