import {ActionForm} from "@/components/action-form";
import {ackAttendanceAlert} from "@/app/admin/actions";

export function AckAttendanceAlert({
 kind,refId,label="Aceptar aviso",
}:{
 kind:"missing_photo"|"missing_exit"|"ot_day";
 refId:string;
 label?:string;
}){
 return (
  <ActionForm action={ackAttendanceAlert} submit={label}>
   <input type="hidden" name="kind" value={kind}/>
   <input type="hidden" name="ref_id" value={refId}/>
  </ActionForm>
 );
}
