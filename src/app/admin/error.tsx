"use client";
export default function ErrorPage({reset}:{reset:()=>void}){return <section className="panel"><h1>No se pudo cargar esta sección</h1><p>Comprueba la conexión y que las migraciones de Supabase estén aplicadas.</p><button onClick={reset}>Reintentar</button></section>}
