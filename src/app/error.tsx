"use client";
export default function ErrorPage({reset}:{reset:()=>void}){return <main className="auth"><h1>No se pudo completar la operación</h1><p>Revisa la conexión e inténtalo de nuevo. Si continúa, consulta al administrador.</p><button onClick={reset}>Reintentar</button></main>}
