"use client";
import {useActionState,useRef} from "react";
import {FileText,Paperclip,Trash2,Upload} from "lucide-react";
import type {ActionState} from "@/components/action-form";
import {uploadReminderDocument,deleteReminderDocument} from "@/app/admin/recordatorios/actions";

export type ReminderDocMeta={
 id:string;
 file_name:string;
 mime_type:string;
 file_size:number;
 created_at:string;
};

function sizeLabel(n:number){
 if(n<1024)return `${n} B`;
 if(n<1024*1024)return `${(n/1024).toFixed(0)} KB`;
 return `${(n/(1024*1024)).toFixed(1)} MB`;
}

function UploadForm({reminderId}:{reminderId:string}){
 const [state,action,pending]=useActionState(uploadReminderDocument,{} as ActionState);
 const input=useRef<HTMLInputElement>(null);
 return (
  <form action={action} className="reminder-docs-upload">
   <input type="hidden" name="reminder_id" value={reminderId}/>
   <label className="reminder-docs-file">
    <Paperclip size={15} aria-hidden="true"/>
    <span>Elegir archivo</span>
    <input
     ref={input}
     type="file"
     name="file"
     required
     disabled={pending}
     accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,application/pdf,image/jpeg,image/png,image/webp,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    />
   </label>
   <button type="submit" className="secondary btn-sm" disabled={pending}>
    <Upload size={14}/>{pending?"Subiendo…":"Adjuntar"}
   </button>
   {state.error&&<p className="alert error" role="alert">{state.error}</p>}
   {state.success&&<p className="alert success" role="status">{state.success}</p>}
   <p className="muted small">PDF, JPG, PNG, WEBP o Word · máx. 5 MB</p>
  </form>
 );
}

function DeleteForm({id,name}:{id:string;name:string}){
 const [state,action,pending]=useActionState(deleteReminderDocument,{} as ActionState);
 return (
  <form action={action}>
   <input type="hidden" name="id" value={id}/>
   <button
    type="submit"
    className="danger small-button"
    disabled={pending}
    onClick={e=>{if(!confirm(`¿Eliminar «${name}»?`))e.preventDefault()}}
   >
    <Trash2 size={13}/>{pending?"…":"Eliminar"}
   </button>
   {state.error&&<p className="alert error" role="alert">{state.error}</p>}
  </form>
 );
}

export function ReminderDocs({
 reminderId,
 docs,
 canUpload,
}:{
 reminderId:string;
 docs:ReminderDocMeta[];
 canUpload:boolean;
}){
 return (
  <div className="reminder-docs">
   <p className="reminder-docs-title"><FileText size={15}/> Documentos del trámite</p>
   {!docs.length?<p className="muted small">Todavía no hay archivos adjuntos.</p>:(
    <ul className="reminder-docs-list">
     {docs.map(d=>(
      <li key={d.id}>
       <a href={`/api/documentos/${d.id}`} className="reminder-docs-link">
        <FileText size={15} aria-hidden="true"/>
        <span>{d.file_name}</span>
        <small>{sizeLabel(d.file_size)}</small>
       </a>
       {canUpload&&<DeleteForm id={d.id} name={d.file_name}/>}
      </li>
     ))}
    </ul>
   )}
   {canUpload&&<UploadForm reminderId={reminderId}/>}
  </div>
 );
}
