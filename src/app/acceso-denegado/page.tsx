import Link from "next/link";
import {logout} from "../login/actions";
import {ShieldAlert} from "lucide-react";

export default function Denied(){
 return (
  <main className="auth-center">
   <div className="auth-form-box">
    <img
     src="/logo-grt.png"
     alt="Gasolinera Río Tempisque"
     className="auth-logo"
     width={200}
     height={112}
     decoding="async"
    />
    <div className="brand-mark" style={{margin:"0 auto 12px"}} aria-hidden="true">
     <ShieldAlert size={20}/>
    </div>
    <p className="eyebrow">Seguridad</p>
    <h1>Acceso restringido</h1>
    <p className="muted">Esta cuenta no tiene permisos para esta sección.</p>
    <form action={logout} style={{marginTop:16}}>
     <button type="submit" className="wide">Cambiar de cuenta</button>
    </form>
    <p style={{marginTop:14}}>
     <Link href="/" className="text-link">Volver al inicio</Link>
    </p>
   </div>
  </main>
 );
}
