import Link from "next/link";
import {AlarmClock} from "lucide-react";
import {ActionForm} from "@/components/action-form";
import {Table} from "@/components/admin-ui";
import {Badge} from "@/components/ui/badge";
import {dateOnly} from "@/lib/format";
import {approvePayrollOt,rejectPayrollOt} from "@/app/admin/actions";

export type AttendanceOtItem={
 employee_id:string;
 employee_name:string;
 employee_code:string;
 department:string;
 work_date:string;
 worked_hours:number;
 ot_hours:number;
 item_id:string|null;
 run_id:string|null;
 company:string|null;
 alert_status:"pending_approval"|"needs_payroll"|"needs_sync"|"approved"|"rejected";
};

const statusLabel:Record<AttendanceOtItem["alert_status"],string>={
 pending_approval:"Por aprobar en planilla",
 needs_payroll:"Sin quincena creada",
 needs_sync:"Quincena creada · sincronizar",
 approved:"Aprobado",
 rejected:"Rechazado",
};

export function AttendanceOtAlert({
 items,people,otHours,
}:{
 items:AttendanceOtItem[];
 people:number;
 otHours:number;
}){
 if(!items.length)return null;
 const pending=items.filter(i=>i.alert_status==="pending_approval");
 const needPayroll=items.filter(i=>i.alert_status==="needs_payroll"||i.alert_status==="needs_sync");

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
     <p className="muted small">
      {items.length} día(s) · {otHours.toFixed(2)} h extra (&gt;8 h/día).
      Deben aprobarse para ingresarlas a la planilla.
     </p>
    </div>
    <div className="button-row">
     <Link className="button" href="/admin/planilla">Ir a planilla a aprobar</Link>
    </div>
   </div>

   <Table headers={["Empleado","Sociedad","Día","Trabajó","Extra","Estado","Acción"]}>
    {items.map(i=>{
     const key=`${i.employee_id}-${i.work_date}`;
     return (
      <tr key={key}>
       <td><strong>{i.employee_name}</strong><small>{i.employee_code}</small></td>
       <td>{i.department}</td>
       <td>{dateOnly(i.work_date)}</td>
       <td>{Number(i.worked_hours).toFixed(2)} h</td>
       <td><strong>{Number(i.ot_hours).toFixed(2)} h</strong></td>
       <td>
        <Badge tone={i.alert_status==="pending_approval"?"danger":"pending"}>
         {statusLabel[i.alert_status]}
        </Badge>
       </td>
       <td>
        {i.alert_status==="pending_approval"&&i.item_id?(
         <div className="row-actions">
          <ActionForm action={approvePayrollOt} submit="Aprobar extras">
           <input type="hidden" name="id" value={i.item_id}/>
          </ActionForm>
          <ActionForm action={rejectPayrollOt} submit="Rechazar">
           <input type="hidden" name="id" value={i.item_id}/>
          </ActionForm>
         </div>
        ):i.alert_status==="needs_payroll"?(
         <Link className="button secondary btn-sm" href={`/admin/planilla?empresa=${encodeURIComponent(i.department)}`}>
          Crear quincena
         </Link>
        ):i.alert_status==="needs_sync"&&i.run_id?(
         <Link className="button secondary btn-sm" href={`/admin/planilla?empresa=${encodeURIComponent(i.department||i.company||"Gasolinera")}&run=${i.run_id}`}>
          Abrir quincena
         </Link>
        ):"—"}
       </td>
      </tr>
     );
    })}
   </Table>

   {(pending.length>0||needPayroll.length>0)&&(
    <p className="muted small" style={{marginTop:12}}>
     {pending.length>0&&<>Podés aprobar aquí o en Planilla. </>}
     {needPayroll.length>0&&<>Si aún no hay quincena, creala primero para que el sistema proponga las extras.</>}
    </p>
   )}
  </section>
 );
}
