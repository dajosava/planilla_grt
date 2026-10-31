import Link from "next/link";

export const metadata={
 title:"Sin conexión",
};

export default function OfflinePage(){
 return (
  <main className="landing">
   <img
    src="/logo-grt.png"
    alt="Gasolinera Río Tempisque"
    className="landing-logo"
    width={180}
    height={101}
    decoding="async"
   />
   <p className="eyebrow">Sin conexión</p>
   <h1>No hay internet</h1>
   <p className="muted">
    Revisá la señal o el Wi‑Fi e intentá de nuevo. Algunas pantallas ya abiertas pueden seguir disponibles.
   </p>
   <div className="landing-options" style={{gridTemplateColumns:"1fr"}}>
    <Link className="option" href="/">
     <h2>Reintentar</h2>
     <p>Volver al inicio de la aplicación.</p>
     <span className="text-link">Abrir inicio →</span>
    </Link>
   </div>
  </main>
 );
}
