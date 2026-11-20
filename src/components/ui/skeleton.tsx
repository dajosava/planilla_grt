export function Skeleton({height=16,width="100%"}:{height?:number;width?:string|number}){
 return <div className="skeleton" style={{height,width}} aria-hidden="true"/>;
}

function TruckSvg(){
 return (
  <svg aria-hidden="true" width="128" height="45" viewBox="0 0 160 56">
   <defs>
    <clipPath id="rl-tank">
     <rect x="8" y="10" width="96" height="30" rx="15"/>
    </clipPath>
   </defs>
   <rect x="4" y="38" width="150" height="5" rx="2" fill="#1f2937"/>
   <rect x="100" y="35" width="16" height="6" fill="#374151"/>
   <rect x="2" y="36" width="6" height="5" rx="1" fill="#374151"/>
   <rect x="30" y="6" width="12" height="5" rx="2" fill="#94a3b8"/>
   <rect x="68" y="6" width="12" height="5" rx="2" fill="#94a3b8"/>
   <rect x="8" y="10" width="96" height="30" rx="15" fill="#e5e7eb"/>
   <g clipPath="url(#rl-tank)">
    <rect x="8" y="22" width="96" height="7" fill="#f59e0b"/>
    <rect x="8" y="29" width="96" height="3" fill="#16a34a"/>
    <path d="M38 10V40M66 10V40M88 10V40" stroke="#cbd5e1" strokeWidth="1.2"/>
   </g>
   <rect x="112" y="3" width="3" height="11" fill="#6b7280"/>
   <path d="M110 40V16Q110 12 114 12H132Q135 12 137 15L150 28Q152 30 152 33V40Z" fill="#15803d"/>
   <path d="M122 17H132L142 28H122Z" fill="#bfdbfe"/>
   <rect x="110" y="33" width="42" height="3" fill="#f59e0b"/>
   <rect x="149" y="29" width="3" height="4" rx="1" fill="#fde68a"/>
   <rect x="148" y="37" width="7" height="4" rx="1" fill="#374151"/>
   <g transform="translate(20 44)"><g className="rl-wheel"><circle r="7" fill="#111827" stroke="#374151"/><circle r="3.2" fill="#9ca3af"/><path d="M-3.2 0H3.2M0 -3.2V3.2" stroke="#4b5563"/></g></g>
   <g transform="translate(34 44)"><g className="rl-wheel"><circle r="7" fill="#111827" stroke="#374151"/><circle r="3.2" fill="#9ca3af"/><path d="M-3.2 0H3.2M0 -3.2V3.2" stroke="#4b5563"/></g></g>
   <g transform="translate(48 44)"><g className="rl-wheel"><circle r="7" fill="#111827" stroke="#374151"/><circle r="3.2" fill="#9ca3af"/><path d="M-3.2 0H3.2M0 -3.2V3.2" stroke="#4b5563"/></g></g>
   <g transform="translate(124 44)"><g className="rl-wheel"><circle r="7" fill="#111827" stroke="#374151"/><circle r="3.2" fill="#9ca3af"/><path d="M-3.2 0H3.2M0 -3.2V3.2" stroke="#4b5563"/></g></g>
   <g transform="translate(142 44)"><g className="rl-wheel"><circle r="7" fill="#111827" stroke="#374151"/><circle r="3.2" fill="#9ca3af"/><path d="M-3.2 0H3.2M0 -3.2V3.2" stroke="#4b5563"/></g></g>
  </svg>
 );
}

export function PageSkeleton({label="Cargando contenido…"}:{label?:string}){
 return (
  <div className="page-loading" role="status" aria-live="polite" aria-busy="true">
   <div className="rl-logo">
    <img
     src="/logo-grt.png"
     alt="Gasolinera Río Tempisque"
     width={220}
     height={167}
     decoding="async"
    />
   </div>
   <div className="rl-track" aria-hidden="true">
    <div className="rl-road"/>
    <div className="rl-truck">
     <TruckSvg/>
    </div>
   </div>
   <p className="page-loading-label">{label}</p>
  </div>
 );
}
