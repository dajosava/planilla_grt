import Link from "next/link";import {logout} from "../login/actions";
export default function Denied(){return <main className="auth"><h1>Acceso restringido</h1><p>Esta cuenta no tiene permisos para esta sección. El administrador debe asignar el rol correspondiente.</p><form action={logout}><button>Cambiar de cuenta</button></form><Link href="/">Volver al inicio</Link></main>}
