export function Skeleton({height=16,width="100%"}:{height?:number;width?:string|number}){
 return <div className="skeleton" style={{height,width}} aria-hidden="true"/>;
}

export function PageSkeleton({label="Cargando contenido…"}:{label?:string}){
 return (
  <div className="page-loading" role="status" aria-live="polite" aria-busy="true">
   <img
    src="/logo-grt.png"
    alt="Gasolinera Río Tempisque"
    className="page-loading-logo"
    width={180}
    height={101}
    decoding="async"
   />
   <div className="page-loading-track" aria-hidden="true">
    <span className="page-loading-bar"/>
   </div>
   <p className="page-loading-label">{label}</p>
  </div>
 );
}
