"use client";
import {useActionState,useEffect,useMemo,useState} from "react";
import {Search,X} from "lucide-react";
import type {ActionState} from "@/components/action-form";
import {DeleteEmployee} from "@/components/delete-employee";
import {Badge} from "@/components/ui/badge";
import {COMPANIES} from "@/lib/companies";
import {cedula,dateOnly} from "@/lib/format";
import {deleteEmployee,toggleEmployee,updateEmployee} from "@/app/admin/actions";

function normalizeQuery(value:string){
 return value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
}

export type EmployeeListItem={
 id:string;
 code:string;
 full_name:string;
 cedula:string|null;
 email:string|null;
 department:string;
 position:string;
 hired_on:string;
 monthly_salary_cents:number;
 hours_per_month:number|null;
 vacation_balance:number;
 exempt_from_ccss:boolean;
 active:boolean;
};

function EditEmployeeModal({
 employee,today,onClose,
}:{
 employee:EmployeeListItem;
 today:string;
 onClose:()=>void;
}){
 const [state,formAction,pending]=useActionState(updateEmployee,{} as ActionState);

 useEffect(()=>{
  if(state.success){
   const t=window.setTimeout(onClose,700);
   return ()=>window.clearTimeout(t);
  }
 },[state.success,onClose]);

 useEffect(()=>{
  const onKey=(e:KeyboardEvent)=>{if(e.key==="Escape"&&!pending)onClose()};
  window.addEventListener("keydown",onKey);
  return ()=>window.removeEventListener("keydown",onKey);
 },[onClose,pending]);

 return (
  <div className="modal-backdrop" onClick={()=>{if(!pending)onClose()}}>
   <div
    className="modal modal-lg"
    role="dialog"
    aria-modal="true"
    aria-labelledby={`emp-edit-${employee.id}`}
    onClick={e=>e.stopPropagation()}
   >
    <form id={`emp-edit-form-${employee.id}`} action={formAction} className="template-modal-form">
     <input type="hidden" name="id" value={employee.id}/>
     <div className="modal-head">
      <div className="modal-head-copy">
       <p className="eyebrow">Editar empleado</p>
       <h2 id={`emp-edit-${employee.id}`}>{employee.full_name}</h2>
       <p className="muted small" style={{margin:"4px 0 0"}}>
        {employee.code} · {cedula(employee.cedula)} · Ingreso {dateOnly(employee.hired_on)} · Vacaciones {employee.vacation_balance} días
       </p>
      </div>
      <div className="modal-head-actions">
       <Badge tone={employee.active?"approved":"pending"}>{employee.active?"Activo":"Inactivo"}</Badge>
       <button
        type="button"
        className="btn-icon secondary"
        onClick={onClose}
        disabled={pending}
        aria-label="Cerrar"
       >
        <X size={18}/>
       </button>
      </div>
     </div>

     <div className="form-grid modal-form-grid template-edit-form">
      <label>Nombre<input name="full_name" defaultValue={employee.full_name} required minLength={3} maxLength={120}/></label>
      <label>Cédula
       <input name="cedula" defaultValue={employee.cedula??""} inputMode="numeric" pattern="[0-9\-]{9,14}" placeholder="1-2345-6789" required minLength={9} maxLength={14}/>
      </label>
      <label>Correo electrónico
       <input name="email" type="email" defaultValue={employee.email??""} placeholder="empleado@ejemplo.com" required maxLength={254} autoComplete="email"/>
      </label>
      <label>Sociedad / planilla
       <select name="department" defaultValue={employee.department}>
        {COMPANIES.map(v=><option key={v}>{v}</option>)}
       </select>
      </label>
      <label>Puesto<input name="position" defaultValue={employee.position} required minLength={2} maxLength={80}/></label>
      <label>Fecha de ingreso
       <input name="hired_on" type="date" defaultValue={employee.hired_on} max={today} min="1950-01-01" required/>
      </label>
      <label>Salario mensual (CRC)
       <input name="salary" type="number" min="0" step="0.01" defaultValue={employee.monthly_salary_cents/100} required/>
      </label>
      <label>Horas ordinarias / mes
       <input name="hours_month" type="number" min="1" max="400" step="0.01" defaultValue={Number(employee.hours_per_month??243.36)} required/>
       <small className="muted">Default 243.36 (30.42×8). Define el valor hora.</small>
      </label>
      <label className="template-active-check" style={{alignSelf:"center"}}>
       <input name="exempt_from_ccss" type="checkbox" defaultChecked={!!employee.exempt_from_ccss}/>
       <span>Exento de CCSS</span>
      </label>
      {(state.error||state.success)&&(
       <div className="form-footer" style={{justifyContent:"flex-start"}}>
        {state.error&&<p role="alert" className="alert error">{state.error}</p>}
        {state.success&&<p role="status" className="alert success">{state.success}</p>}
       </div>
      )}
     </div>
    </form>

    <div className="employee-modal-footer">
     <div className="employee-modal-footer-left">
      <form action={toggleEmployee}>
       <input type="hidden" name="id" value={employee.id}/>
       <input type="hidden" name="active" value={String(!employee.active)}/>
       <button type="submit" className="secondary">
        {employee.active?"Desactivar":"Reactivar"}
       </button>
      </form>
      <DeleteEmployee
       id={employee.id}
       name={employee.full_name}
       code={employee.code}
       action={deleteEmployee}
      />
     </div>
     <div className="employee-modal-footer-right">
      <button type="button" className="secondary" onClick={onClose} disabled={pending}>Cancelar</button>
      <button type="submit" form={`emp-edit-form-${employee.id}`} disabled={pending}>
       {pending?"Guardando…":"Guardar cambios"}
      </button>
     </div>
    </div>
   </div>
  </div>
 );
}

export function EmployeesDirectory({
 employees,today,
}:{
 employees:EmployeeListItem[];
 today:string;
}){
 const [openId,setOpenId]=useState<string|null>(null);
 const [query,setQuery]=useState("");
 const q=normalizeQuery(query);

 const filtered=useMemo(()=>{
  if(!q)return employees;
  return employees.filter(e=>{
   const name=normalizeQuery(e.full_name);
   const code=normalizeQuery(e.code);
   const id=normalizeQuery(e.cedula??"");
   return name.includes(q)||code.includes(q)||id.includes(q)||`n.º ${code}`.includes(q)||`nº ${code}`.includes(q);
  });
 },[employees,q]);

 const selected=employees.find(e=>e.id===openId)??null;

 return (
  <>
   <div className="directory-box">
    <div className="directory-box-head">
     <label className="directory-search">
      <Search size={16} aria-hidden="true"/>
      <input
       type="search"
       value={query}
       onChange={e=>setQuery(e.target.value)}
       placeholder="Buscar por nombre, N.º o cédula…"
       aria-label="Buscar empleado"
       autoComplete="off"
      />
      {query?(
       <button
        type="button"
        className="directory-search-clear"
        onClick={()=>setQuery("")}
        aria-label="Limpiar búsqueda"
       >
        <X size={14}/>
       </button>
      ):null}
     </label>
     {q?(
      <span className="muted small directory-search-meta">
       {filtered.length}/{employees.length}
      </span>
     ):null}
    </div>

    <div className="directory-scroll directory-scroll-in-box">
     {!employees.length?(
      <p className="muted small" style={{margin:0,padding:"12px 4px"}}>No hay empleados en este filtro.</p>
     ):!filtered.length?(
      <p className="muted small" style={{margin:0,padding:"12px 4px"}}>Ningún empleado coincide con “{query.trim()}”.</p>
     ):filtered.map(e=>(
      <button
       key={e.id}
       type="button"
       className="employee-dir-row template-dir-row employee-dir-row-compact"
       onClick={()=>setOpenId(e.id)}
      >
       <span className="employee-dir-main">
        <strong>{e.full_name}</strong>
        <small>· N.º {e.code}</small>
       </span>
       <Badge tone={e.active?"approved":"pending"}>{e.active?"Activo":"Inactivo"}</Badge>
      </button>
     ))}
    </div>
   </div>

   {selected&&(
    <EditEmployeeModal
     key={selected.id}
     employee={selected}
     today={today}
     onClose={()=>setOpenId(null)}
    />
   )}
  </>
 );
}
