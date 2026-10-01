"use client";
import {useActionState} from "react";
export type ActionState={error?:string;success?:string};
export function ActionForm({action,children,submit="Guardar"}:{action:(state:ActionState,form:FormData)=>Promise<ActionState>;children:React.ReactNode;submit?:string}){
 const [state,formAction,pending]=useActionState(action,{});
 return <form action={formAction} className="form-grid">{children}<div className="form-footer">{state.error&&<p role="alert" className="alert error">{state.error}</p>}{state.success&&<p role="status" className="alert success">{state.success}</p>}<button disabled={pending}>{pending?"Procesando…":submit}</button></div></form>;
}
