"use client";
import {AlertTriangle} from "lucide-react";
export default function ErrorPage({reset}:{reset:()=>void}){
 return <section className="panel" role="alert">
  <div className="page-heading-row">
   <div>
    <p className="eyebrow">Error</p>
    <h1>No se pudo cargar esta sección</h1>
    <p className="muted">Comprueba la conexión y que las migraciones de Supabase estén aplicadas.</p>
   </div>
   <AlertTriangle style={{color:"var(--danger)"}} size={28} aria-hidden="true"/>
  </div>
  <button type="button" onClick={reset}>Reintentar</button>
 </section>;
}
