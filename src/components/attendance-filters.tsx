"use client";

import {useAttendanceNavigate} from "@/components/attendance-loading-gate";

type Preset={label:string;from:string;to:string};
type EmployeeOpt={id:string;full_name:string;code:string};

/** Filtros de tiempo: activan la animación de carga en cada cambio. */
export function AttendanceFilters({
 presets,
 from,
 to,
 today,
 employee,
 employees,
}:{
 presets:Preset[];
 from:string;
 to:string;
 today:string;
 employee:string;
 employees:EmployeeOpt[];
}){
 const navigate=useAttendanceNavigate();

 function hrefFor(desde:string,hasta:string,empleado?:string){
  const p=new URLSearchParams({desde,hasta});
  const emp=empleado??employee;
  if(emp)p.set("empleado",emp);
  return `/admin/asistencia?${p}`;
 }

 function onFilterSubmit(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();
  const fd=new FormData(e.currentTarget);
  const desde=String(fd.get("desde")??"").trim()||today;
  const hasta=String(fd.get("hasta")??"").trim()||today;
  const emp=String(fd.get("empleado")??"").trim();
  navigate(hrefFor(desde,hasta,emp));
 }

 return (
  <div className="attendance-toolbar-filters attendance-toolbar-filters-below">
   <div className="attendance-filter-presets" role="group" aria-label="Filtros rápidos">
    {presets.map(p=>(
     <button
      key={p.label}
      type="button"
      className={`badge${p.from===from&&p.to===to?" selected":""}`}
      aria-pressed={p.from===from&&p.to===to}
      onClick={()=>navigate(hrefFor(p.from,p.to))}
     >
      {p.label}
     </button>
    ))}
   </div>
   <form className="attendance-filters" onSubmit={onFilterSubmit}>
    <label>Desde<input type="date" name="desde" defaultValue={from} max={today}/></label>
    <label>Hasta<input type="date" name="hasta" defaultValue={to} max={today}/></label>
    <label>Empleado
     <select name="empleado" defaultValue={employee}>
      <option value="">Todos</option>
      {employees.map(e=>(
       <option key={e.id} value={e.id}>{e.full_name} ({e.code})</option>
      ))}
     </select>
    </label>
    <button type="submit" className="secondary">Filtrar</button>
   </form>
  </div>
 );
}
