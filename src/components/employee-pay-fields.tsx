"use client";

import {useState} from "react";

const DEFAULT_HOURS_MONTH=243.36;

export function EmployeePayFields({
 payByHours:initialPayByHours=false,
 salaryDefault="",
 hourlyDefault="",
 hoursMonthDefault=DEFAULT_HOURS_MONTH,
 vacationMode="none",
 vacationBalance=0,
 exemptDefault=false,
}:{
 payByHours?:boolean;
 salaryDefault?:string|number;
 hourlyDefault?:string|number;
 hoursMonthDefault?:number;
 /** create = saldo inicial editable; edit = solo lectura; none = no mostrar */
 vacationMode?:"none"|"create"|"edit";
 vacationBalance?:number;
 exemptDefault?:boolean;
}){
 const [payByHours,setPayByHours]=useState(!!initialPayByHours);
 const [exempt,setExempt]=useState(!!initialPayByHours||!!exemptDefault);

 function onPayByHoursChange(checked:boolean){
  setPayByHours(checked);
  if(checked)setExempt(true);
 }

 return (
  <>
   <label className="checkbox" style={{alignSelf:"center"}}>
    <input
     name="pay_by_hours"
     type="checkbox"
     checked={payByHours}
     onChange={e=>onPayByHoursChange(e.target.checked)}
    />
    <span>Pago por horas (sin salario mensual fijo)</span>
   </label>
   {payByHours?(
    <label>Precio por hora (CRC)
     <input
      name="hourly_rate"
      type="number"
      min="0"
      step="0.01"
      defaultValue={hourlyDefault===""||hourlyDefault===0?undefined:Number(hourlyDefault)}
      required
      placeholder="ej. 1500"
     />
     <small className="muted">Se paga solo por horas marcadas en el reloj × esta tarifa. Las extras (si aplican) van a 1.5×.</small>
    </label>
   ):(
    <label>Salario mensual (CRC)
     <input
      name="salary"
      type="number"
      min="0"
      step="0.01"
      defaultValue={salaryDefault===""||salaryDefault===0?undefined:Number(salaryDefault)}
      required
     />
    </label>
   )}
   {payByHours?(
    <input type="hidden" name="hours_month" value={DEFAULT_HOURS_MONTH}/>
   ):(
    <label>Horas ordinarias / mes
     <input name="hours_month" type="number" min={1} max={400} step="0.01" defaultValue={hoursMonthDefault} required/>
     <small className="muted">Default 243.36 (30.42×8). Define el valor hora del salario mensual.</small>
    </label>
   )}
   {vacationMode==="create"?(
    payByHours?(
     <input type="hidden" name="vacation_balance" value="0"/>
    ):(
     <label>Saldo inicial de vacaciones (días)
      <input name="vacation_balance" type="number" min="0" max="365" step="0.01" defaultValue="0" required/>
     </label>
    )
   ):null}
   {vacationMode==="edit"&&!payByHours?(
    <label>Días de vacaciones disponibles
     <input
      type="text"
      value={`${Number(vacationBalance)} días`}
      readOnly
      tabIndex={-1}
      aria-readonly="true"
     />
     <small className="muted">Solo consulta. Para acreditar o descontar usá “Ajustar saldo de vacaciones”.</small>
    </label>
   ):null}
   {payByHours?(
    <>
     <input type="hidden" name="exempt_from_ccss" value="on"/>
     <p className="muted small" style={{margin:0,alignSelf:"center"}}>
      Exento de CCSS (automático en pago por horas: no se rebaja en planilla).
     </p>
    </>
   ):(
    <label className="checkbox" style={{alignSelf:"center"}}>
     <input
      name="exempt_from_ccss"
      type="checkbox"
      checked={exempt}
      onChange={e=>setExempt(e.target.checked)}
     />
     <span>Exento de CCSS</span>
    </label>
   )}
  </>
 );
}
