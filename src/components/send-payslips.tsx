"use client";
import {useActionState} from "react";
import type {ActionState} from "@/components/action-form";
import {sendPayrollPayslips} from "@/app/admin/actions";

export type PayslipEmailStats={
 sent:number;
 pending:number;
 failed:number;
 skipped:number;
 total:number;
};

export function SendPayslips({
 runId,
 stats,
 mailReady,
}:{
 runId:string;
 stats:PayslipEmailStats;
 mailReady:boolean;
}){
 const [state,action,pending]=useActionState(sendPayrollPayslips,{} as ActionState);
 const remaining=stats.pending+stats.failed;

 return (
  <div className="payslip-email-box">
   <p className="muted small" style={{margin:"0 0 10px"}}>
    Correos: <strong>{stats.sent}</strong> enviados
    {stats.pending?<> · <strong>{stats.pending}</strong> pendientes</>:null}
    {stats.failed?<> · <strong className="text-danger">{stats.failed}</strong> fallidos</>:null}
    {stats.skipped?<> · <strong>{stats.skipped}</strong> sin correo</>:null}
    {" · "}total {stats.total}
   </p>

   {!mailReady&&(
    <p className="alert error" role="alert">
      Falta configurar EmailJS (<code>EMAILJS_SERVICE_ID</code>, <code>TEMPLATE_ID</code>, <code>PUBLIC_KEY</code> y <code>PRIVATE_KEY</code>).
    </p>
   )}

   <div className="button-row" style={{marginBottom:8}}>
    <form action={action}>
     <input type="hidden" name="id" value={runId}/>
     <input type="hidden" name="mode" value="pending"/>
     <button type="submit" disabled={pending||!mailReady||remaining===0}>
      {pending?"Enviando…":remaining===0?"Todas las colillas enviadas":`Enviar ${remaining} colilla(s)`}
     </button>
    </form>
    {stats.sent>0&&(
     <form action={action}>
      <input type="hidden" name="id" value={runId}/>
      <input type="hidden" name="mode" value="all"/>
      <button type="submit" className="secondary" disabled={pending||!mailReady}>
       Reenviar todas
      </button>
     </form>
    )}
   </div>

   {state.error&&<p role="alert" className="alert error">{state.error}</p>}
   {state.success&&<p role="status" className="alert success">{state.success}</p>}
  </div>
 );
}
