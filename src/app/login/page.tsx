import {ActionForm} from "@/components/action-form";
import {login} from "./actions";
import {configured} from "@/lib/supabase/server";

export default function Login(){
 return <main className="auth-center">
  <div className="auth-form-box">
   <img src="/logo-grt.png" alt="Gasolinera Río Tempisque" className="auth-logo" width={200} height={112} decoding="async"/>
   <h1>Iniciar sesión</h1>
   <p className="muted" style={{marginBottom:18}}>Usa la cuenta administrativa o la cuenta autorizada de la tablet.</p>
   {configured()?(
    <ActionForm action={login} submit="Ingresar">
     <label>Correo<input name="email" type="email" autoComplete="username" required/></label>
     <label>Contraseña<input name="password" type="password" autoComplete="current-password" required/></label>
    </ActionForm>
   ):(
    <p className="alert error">Configura .env.local con tu URL y clave pública de Supabase.</p>
   )}
  </div>
 </main>;
}
