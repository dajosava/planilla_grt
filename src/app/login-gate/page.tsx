import type {Metadata} from "next";
import {AdminLoginForm} from "@/components/admin-login-form";
import {configured} from "@/lib/supabase/server";

export const metadata:Metadata={
 title:"Ingreso al panel administrativo",
 robots:{index:false,follow:false},
};

/** Arte: sol fuego + puente anclado abajo a la derecha (cubierta tapa la mitad inferior del sol). */
function BrandArt(){
 return (
  <svg viewBox="0 0 640 340" preserveAspectRatio="xMaxYMax slice" aria-hidden="true" className="admin-login-art">
   <defs>
    <linearGradient id="admin-login-deck-fade" x1="0" y1="0" x2="0" y2="1">
     <stop offset="0%" stopColor="#07101F" stopOpacity="1"/>
     <stop offset="40%" stopColor="#0B1730" stopOpacity="0.75"/>
     <stop offset="100%" stopColor="#0B1730" stopOpacity="0"/>
    </linearGradient>
    <radialGradient id="admin-login-sun" cx="50%" cy="50%" r="50%">
     <stop offset="0%" stopColor="#FFC84A" stopOpacity="1"/>
     <stop offset="40%" stopColor="#FF8A14" stopOpacity="1"/>
     <stop offset="70%" stopColor="#FF6A00" stopOpacity="0.97"/>
     <stop offset="88%" stopColor="#FF5A00" stopOpacity="0.55"/>
     <stop offset="100%" stopColor="#FF4A00" stopOpacity="0"/>
    </radialGradient>
   </defs>
   <circle cx="440" cy="215" r="136" fill="url(#admin-login-sun)"/>
   <g stroke="#07101F" strokeWidth="1.6" fill="none">
    <line x1="308" y1="48" x2="340" y2="262"/>
    <line x1="308" y1="48" x2="395" y2="262"/>
    <line x1="308" y1="48" x2="450" y2="262"/>
    <line x1="308" y1="48" x2="505" y2="262"/>
    <line x1="308" y1="48" x2="560" y2="262"/>
    <line x1="308" y1="48" x2="615" y2="262"/>
    <line x1="308" y1="48" x2="276" y2="262"/>
    <line x1="308" y1="48" x2="221" y2="262"/>
    <line x1="308" y1="48" x2="166" y2="262"/>
    <line x1="308" y1="48" x2="111" y2="262"/>
    <line x1="308" y1="48" x2="56" y2="262"/>
   </g>
   <polygon points="300,34 316,34 322,262 294,262" fill="#07101F"/>
   <rect x="0" y="256" width="640" height="10" fill="#07101F"/>
   <rect x="0" y="266" width="640" height="74" fill="url(#admin-login-deck-fade)"/>
  </svg>
 );
}

export default function LoginGate(){
 const ready=configured();

 return (
  <main className="admin-login" aria-label="Ingreso al panel administrativo">
   <div className="admin-login-arte" aria-hidden="true">
    <BrandArt/>
   </div>

   <div className="admin-login-form-col">
    <div className="admin-login-form-center">
     <section className="admin-login-card">
      <div className="admin-login-intro">
       <img
        src="/logo-grt.png"
        alt="Gasolinera Río Tempisque"
        className="admin-login-logo"
        width={200}
        height={112}
        decoding="async"
       />
       <div className="admin-login-accent" aria-hidden="true"/>
       <h1>Panel administrativo</h1>
       <p>Ingrese con su cuenta autorizada.</p>
      </div>

      {ready?(
       <AdminLoginForm/>
      ):(
       <p className="alert error" role="alert">
        Configura `.env.local` con la URL y la clave pública de Supabase.
       </p>
      )}
     </section>
    </div>

    <footer className="admin-login-footer">
     <span>Pueblo Viejo, Nicoya, Guanacaste</span>
     <a
      href="https://manakinlabs.com/"
      target="_blank"
      rel="noopener noreferrer"
      className="admin-login-support"
     >
      Soporte: Manakin Labs
     </a>
    </footer>
   </div>

   <aside className="admin-login-hero">
    <div className="admin-login-hero-center">
     <span className="admin-login-place">Nicoya · Guanacaste</span>
     <h2>Su estación,<br/>en un solo lugar.</h2>
     <p>Asistencia, operaciones y planilla al alcance de la administración.</p>
    </div>
    <div className="admin-login-hero-foot" aria-hidden="true"/>
   </aside>
  </main>
 );
}
