import Link from "next/link";
import {ClipboardCheck,LayoutDashboard,Fuel} from "lucide-react";

export default function Home(){
 return <main className="landing">
  <div className="brand-mark" aria-hidden="true"><Fuel size={20}/></div>
  <p className="eyebrow">Pueblo Viejo · Nicoya</p>
  <h1>Gasolinera Río Tempisque</h1>
  <p className="muted">Operaciones de estación, asistencia y planilla en un solo lugar.</p>
  <div className="landing-options">
   <Link className="option" href="/marcacion">
    <span className="option-icon" aria-hidden="true"><ClipboardCheck size={22}/></span>
    <h2>Marcación y tareas</h2>
    <p>Marca asistencia y completa las tareas del turno.</p>
    <span className="text-link">Abrir terminal →</span>
   </Link>
   <Link className="option" href="/admin">
    <span className="option-icon" aria-hidden="true"><LayoutDashboard size={22}/></span>
    <h2>Administración</h2>
    <p>Operaciones, incidentes, empleados y planilla.</p>
    <span className="text-link">Ingresar al panel →</span>
   </Link>
  </div>
  <p className="small muted">Acceso autorizado · Zona horaria de Costa Rica</p>
 </main>;
}
