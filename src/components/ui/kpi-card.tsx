import Link from "next/link";
import type {ReactNode} from "react";

export function KpiCard({
 label,value,sub,icon,tone="green",progress,badge,href,title,
}:{
 label:string;value:string|number;sub?:ReactNode;icon?:ReactNode;
 tone?:"green"|"orange"|"amber"|"navy"|"danger";progress?:number;badge?:ReactNode;href?:string;title?:string;
}){
 const body=<>
  <div className="kpi-top">
   <div>
    <p className="kpi-label">{label}</p>
    <p className="kpi-value tabular">{value}</p>
   </div>
   {icon&&<div className={`kpi-icon ${tone}`} aria-hidden="true">{icon}</div>}
  </div>
  {sub&&<p className="kpi-sub">{sub}</p>}
  {badge&&<div style={{marginTop:8}}>{badge}</div>}
  {typeof progress==="number"&&<div className="kpi-progress" aria-hidden="true"><span style={{width:`${Math.max(0,Math.min(100,progress))}%`}}/></div>}
 </>;
 if(href)return <Link className="kpi-card" href={href} title={title}>{body}</Link>;
 return <div className="kpi-card" title={title}>{body}</div>;
}
