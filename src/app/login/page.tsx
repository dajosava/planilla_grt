import {ActionForm} from "@/components/action-form";
import {login} from "./actions";
import {configured} from "@/lib/supabase/server";
import {Fuel} from "lucide-react";

export default function Login(){
 return <main className="auth-split">
  <section className="auth-form-pane">
   <div className="auth-form-box">
    <div className="brand-mark" aria-hidden="true"><Fuel size={20}/></div>
    <p className="eyebrow">Gasolinera Río Tempisque</p>
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
  </section>
  <aside className="auth-brand-pane" aria-hidden="true">
   <div className="brand-mark" style={{margin:"0 auto 16px",background:"rgba(255,255,255,.2)"}}>GRT</div>
   <h1>Operaciones claras, turno a turno</h1>
   <p>Control de tareas, incidentes, asistencia y planilla para la estación.</p>
  </aside>
 </main>;
}
