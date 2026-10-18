import Link from "next/link";
import {logout} from "../login/actions";
import {ShieldAlert} from "lucide-react";

export default function Denied(){
 return <main className="auth-form-pane" style={{minHeight:"100vh"}}>
  <div className="auth-form-box" style={{textAlign:"center"}}>
   <div className="brand-mark" style={{margin:"0 auto 12px"}} aria-hidden="true"><ShieldAlert size={20}/></div>
   <p className="eyebrow">Seguridad</p>
   <h1>Acceso restringido</h1>
   <p className="muted">Esta cuenta no tiene permisos para esta sección.</p>
   <form action={logout} style={{marginTop:16}}><button type="submit" className="wide">Cambiar de cuenta</button></form>
   <Link href="/" className="text-link">Volver al inicio</Link>
  </div>
 </main>;
}
