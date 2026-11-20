"use client";

import {useRouter} from "next/navigation";
import {COMPANIES} from "@/lib/companies";

export function EmployeesAreaFilter({
 area,
 counts,
 total,
}:{
 area:string|null;
 counts:Record<string,number>;
 total:number;
}){
 const router=useRouter();

 return (
  <label className="empleados-area-filter">
   <span className="sr-only">Sociedad</span>
   <select
    value={area??""}
    onChange={e=>{
     const v=e.target.value;
     const q=new URLSearchParams();
     if(v)q.set("area",v);
     const s=q.toString();
     router.push(s?`/admin/empleados?${s}`:"/admin/empleados");
    }}
    aria-label="Filtrar por sociedad"
   >
    <option value="">Todas las sociedades ({total})</option>
    {COMPANIES.map(c=>(
     <option key={c} value={c}>{c} ({counts[c]??0})</option>
    ))}
   </select>
  </label>
 );
}
