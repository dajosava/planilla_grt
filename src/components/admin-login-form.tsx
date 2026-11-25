"use client";

import {useActionState,useState} from "react";
import {Eye,EyeOff} from "lucide-react";
import {login} from "@/app/login/actions";
import type {ActionState} from "@/components/action-form";

export function AdminLoginForm(){
 const [state,formAction,pending]=useActionState(login,{} as ActionState);
 const [showPass,setShowPass]=useState(false);

 return (
  <form action={formAction} className="admin-login-form" autoComplete="on">
   <label className="admin-login-field">
    <span className="admin-login-field-label">Correo</span>
    <input
     name="email"
     type="email"
     autoComplete="username"
     placeholder="nombre@correo.com"
     required
     disabled={pending}
    />
   </label>

   <div className="admin-login-field">
    <label className="admin-login-field-label" htmlFor="admin-login-password">Contraseña</label>
    <div className="admin-login-pass-wrap">
     <input
      id="admin-login-password"
      name="password"
      type={showPass?"text":"password"}
      autoComplete="current-password"
      placeholder="Su contraseña"
      required
      disabled={pending}
     />
     <button
      type="button"
      className="admin-login-pass-toggle"
      onClick={()=>setShowPass(v=>!v)}
      aria-label={showPass?"Ocultar contraseña":"Mostrar contraseña"}
      disabled={pending}
     >
      {showPass?<EyeOff size={15} aria-hidden="true"/>:<Eye size={15} aria-hidden="true"/>}
      <span>{showPass?"Ocultar":"Ver"}</span>
     </button>
    </div>
   </div>

   <p className="admin-login-hint">Si olvidó la clave, consulte al administrador.</p>

   {state.error?(
    <p role="alert" className="alert error admin-login-alert">{state.error}</p>
   ):null}

   <button type="submit" className="admin-login-submit" disabled={pending}>
    {pending?"Ingresando…":"Ingresar"}
   </button>
  </form>
 );
}
