import {todayCR} from "@/lib/format";

export const REMINDER_CATEGORIES=[
 {id:"tramite",label:"Trámite"},
 {id:"permiso",label:"Permiso"},
 {id:"renovacion",label:"Renovación"},
 {id:"documentacion",label:"Documentación"},
 {id:"otro",label:"Otro"},
] as const;

export type ReminderCategory=(typeof REMINDER_CATEGORIES)[number]["id"];
export type ReminderUrgency="overdue"|"urgent"|"soon"|"ok"|"done"|"cancelled";

export function categoryLabel(id:string){
 return REMINDER_CATEGORIES.find(c=>c.id===id)?.label??id;
}

/** Días restantes hasta due_on (negativo = vencido). */
export function daysUntilDue(dueOn:string,today=todayCR()){
 const a=Date.parse(today+"T12:00:00Z");
 const b=Date.parse(dueOn+"T12:00:00Z");
 return Math.round((b-a)/86400000);
}

export function reminderUrgency(opts:{
 due_on:string;
 alert_days:number;
 status:string;
 today?:string;
}):ReminderUrgency{
 if(opts.status==="done")return "done";
 if(opts.status==="cancelled")return "cancelled";
 const days=daysUntilDue(opts.due_on,opts.today??todayCR());
 if(days<0)return "overdue";
 if(days<=7)return "urgent";
 if(days<=opts.alert_days)return "soon";
 return "ok";
}

export function urgencyLabel(u:ReminderUrgency){
 return ({
  overdue:"Vencido",
  urgent:"Urgente (≤7 días)",
  soon:"Alarma temprana",
  ok:"Programado",
  done:"Atendido",
  cancelled:"Cancelado",
 } as const)[u];
}

export function urgencyTone(u:ReminderUrgency){
 if(u==="overdue"||u==="urgent")return "danger";
 if(u==="soon")return "pending";
 if(u==="done")return "approved";
 return "pending";
}
