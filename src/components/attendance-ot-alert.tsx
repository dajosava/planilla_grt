"use client";
import {useActionState,useCallback,useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {AlarmClock} from "lucide-react";
import {type ActionState} from "@/components/action-form";
import {AckAttendanceAlert} from "@/components/ack-attendance-alert";
import {Table} from "@/components/admin-ui";
import {Badge} from "@/components/ui/badge";
import {dateOnly} from "@/lib/format";
import {ackAttendanceAlertBulk} from "@/app/admin/actions";

export type AttendanceOtItem={
 employee_id:string;
 employee_name:string;
 employee_code:string;
 department:string;
 work_date:string;
 worked_hours:number;
 ot_hours:number;
 shift_type?:string;
 shift_label?:string;
 ordinary_limit_hours?:number;
 night_minutes?:number;
 scheduled?:boolean;
 needs_review?:boolean;
 item_id:string|null;
 run_id:string|null;
 company:string|null;
 alert_status:"pending_approval"|"needs_payroll"|"needs_sync"|"approved"|"rejected";
 ack_ref?:string;
};

const statusLabel:Record<AttendanceOtItem["alert_status"],string>={
 pending_approval:"Por aprobar",
 needs_payroll:"Sin quincena",
 needs_sync:"Sincronizar",
 approved:"Aprobado",
 rejected:"Rechazado",
};

function ackKey(i:AttendanceOtItem){
 return i.ack_ref??`${i.employee_id}|${i.work_date}`;
}

function BulkAckBar({
 selectedRefs,allCount,allSelected,onToggleAll,onClear,
}:{
 selectedRefs:string[];
 allCount:number;
 allSelected:boolean;
 onToggleAll:()=>void;
 onClear:()=>void;
}){
 const [state,formAction,pending]=useActionState(ackAttendanceAlertBulk,{} as ActionState);

 useEffect(()=>{
  if(state.success)onClear();
 },[state.success,onClear]);

 return (
  <div className="ot-bulk-bar">
   <label className="ot-check-label ot-check-all">
    <input
     type="checkbox"
     checked={allSelected}
     onChange={onToggleAll}
     disabled={!allCount||pending}
    />
    <span>Seleccionar todos ({allCount})</span>
   </label>
   {selectedRefs.length>0&&(
    <span className="muted small">
     {selectedRefs.length} seleccionado{selectedRefs.length===1?"":"s"}
    </span>
   )}
   <form action={formAction} className="ot-bulk-form">
    <input type="hidden" name="kind" value="ot_day"/>
    <input type="hidden" name="ref_ids" value={selectedRefs.join("\n")}/>
    <button className="primary" disabled={pending||!selectedRefs.length} type="submit">
     {pending?"Aceptando…":"Aceptar avisos seleccionados"}
    </button>
   </form>
   {state.error&&<p role="alert" className="alert error">{state.error}</p>}
   {state.success&&<p role="status" className="alert success">{state.success}</p>}
  </div>
 );
}

export function AttendanceOtAlert({
 items,people,
}:{
 items:AttendanceOtItem[];
 people:number;
 otHours?:number;
}){
 const [selected,setSelected]=useState<Set<string>>(()=>new Set());

 const allRefs=useMemo(()=>items.map(ackKey),[items]);
 const allSelected=allRefs.length>0&&allRefs.every(r=>selected.has(r));
 const selectedRefs=useMemo(()=>allRefs.filter(r=>selected.has(r)),[allRefs,selected]);

 if(!items.length)return null;

 function toggleAll(){
  setSelected(allSelected?new Set():new Set(allRefs));
 }
 function toggleRef(ref:string){
  setSelected(prev=>{
   const next=new Set(prev);
   if(next.has(ref))next.delete(ref);else next.add(ref);
   return next;
  });
 }
 const clearSelection=useCallback(()=>setSelected(new Set()),[]);

 return (
  <section className="panel attendance-alerts ot-alerts" role="alert">
   <div className="ot-alerts-head">
    <div>
     <h2>
      <AlarmClock size={18} aria-hidden="true"/>{" "}
      {people===1
       ?"1 persona registró horas extra"
       :`${people} personas registraron horas extra`}
     </h2>
    </div>
    <div className="button-row">
     <Link className="button" href="/admin/planilla">Ir a planilla</Link>
    </div>
   </div>

   <BulkAckBar
    selectedRefs={selectedRefs}
    allCount={allRefs.length}
    allSelected={allSelected}
    onToggleAll={toggleAll}
    onClear={clearSelection}
   />

   <Table headers={["","Empleado","Sociedad","Día","Jornada","Trabajó","Extra","Estado","Acción"]}>
    {items.map(i=>{
     const key=`${i.employee_id}-${i.work_date}`;
     const ref=ackKey(i);
     const lim=i.ordinary_limit_hours??8;
     return (
      <tr key={key} className={selected.has(ref)?"ot-row-selected":undefined}>
       <td>
        <label className="ot-check-label">
         <input
          type="checkbox"
          checked={selected.has(ref)}
          onChange={()=>toggleRef(ref)}
          aria-label={`Seleccionar aviso de ${i.employee_name}`}
         />
        </label>
       </td>
       <td className="ot-cell-employee" title={`${i.employee_name} (${i.employee_code})`}>
        <strong>{i.employee_name}</strong>
        <span className="muted small"> ({i.employee_code})</span>
       </td>
       <td className="ot-cell-nowrap">{i.department}</td>
       <td className="ot-cell-nowrap">{dateOnly(i.work_date)}</td>
       <td className="ot-cell-nowrap" title={i.scheduled?"Según turno asignado":"Sin turno asignado · revisión recomendada"}>
        {i.shift_label??"—"}
        <span className="muted small"> · lim. {lim} h</span>
       </td>
       <td className="ot-cell-nowrap ot-cell-num">{Number(i.worked_hours).toFixed(2)} h</td>
       <td className="ot-cell-nowrap ot-cell-num"><strong>{Number(i.ot_hours).toFixed(2)} h</strong></td>
       <td className="ot-cell-status" title={
        i.alert_status==="pending_approval"?"Por aprobar en planilla"
        :i.alert_status==="needs_payroll"?"Sin quincena creada"
        :i.alert_status==="needs_sync"?"Quincena creada · sincronizar"
        :statusLabel[i.alert_status]
       }>
        <Badge tone={i.alert_status==="pending_approval"?"danger":"pending"}>
         {statusLabel[i.alert_status]}
        </Badge>
       </td>
       <td className="ot-cell-actions">
        <div className="row-actions alert-row-actions ot-actions-inline">
         <AckAttendanceAlert kind="ot_day" refId={ref} label="Aceptar"/>
        </div>
       </td>
      </tr>
     );
    })}
   </Table>

  </section>
 );
}
