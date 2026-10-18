"use client";
import {useRouter,usePathname,useSearchParams} from "next/navigation";

const STATUS_COLORS:Record<string,string>={
 pending:"var(--status-pending)",
 in_progress:"var(--status-progress)",
 completed:"var(--status-completed)",
 approved:"var(--status-approved)",
 rejected:"var(--danger)",
};
const STATUS_HEX:Record<string,string>={
 pending:"#F5A524",
 in_progress:"#4C9AFF",
 completed:"#2DD4BF",
 approved:"#2FCB86",
 rejected:"#FF6B6B",
};
const STATUS_LABEL:Record<string,string>={
 pending:"Pendiente",
 in_progress:"En proceso",
 completed:"Completada",
 approved:"Aprobada",
 rejected:"Rechazada",
};

function toneClass(pct:number){
 if(pct<=0)return "";
 if(pct>=70)return "ok";
 if(pct>=40)return "mid";
 return "low";
}

export function StatusDonut({items}:{items:{status:string;count:number}[]}){
 const router=useRouter();
 const path=usePathname();
 const params=useSearchParams();
 const total=items.reduce((s,i)=>s+i.count,0)||1;
 const size=180;const r=68;const c=2*Math.PI*r;
 const slices=items.filter(i=>i.count>0).reduce<{status:string;count:number;dash:number;gap:number;offset:number;color:string}[]>((acc,i)=>{
  const len=(i.count/total)*c;
  const offset=acc.reduce((s,x)=>s+x.dash,0);
  acc.push({status:i.status,count:i.count,dash:len,gap:c-len,offset,color:STATUS_HEX[i.status]??"#8FA3BF"});
  return acc;
 },[]);
 function filterBy(status:string){
  const q=new URLSearchParams(params.toString());
  if(q.get("estado")===status)q.delete("estado");else q.set("estado",status);
  router.push(`${path}?${q.toString()}`);
 }
 const donePct=Math.round(items.filter(i=>["completed","approved"].includes(i.status)).reduce((a,b)=>a+b.count,0)*100/total);
 return <div className="ops-chart-donut">
  <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label="Distribución por estado">
   <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--track)" strokeWidth="22"/>
   {slices.map(s=><circle key={s.status} cx={size/2} cy={size/2} r={r} fill="none" stroke={s.color} strokeWidth="22"
    strokeDasharray={`${s.dash} ${s.gap}`} strokeDashoffset={-s.offset+c/4}
    transform={`rotate(-90 ${size/2} ${size/2})`} style={{cursor:"pointer"}}
    onClick={()=>filterBy(s.status)}/>)}
   <text x="50%" y="48%" textAnchor="middle" className="ops-chart-center-value">{donePct}%</text>
   <text x="50%" y="58%" textAnchor="middle" className="ops-chart-center-label">hecho</text>
  </svg>
  <ul className="ops-chart-legend">
   {items.map(i=><li key={i.status}>
    <button type="button" onClick={()=>filterBy(i.status)} aria-pressed={params.get("estado")===i.status} title={`Filtrar por ${STATUS_LABEL[i.status]}`}>
     <span className="swatch" style={{background:STATUS_HEX[i.status]??"#8FA3BF"}} aria-hidden="true"/>
     <span className="legend-label">{STATUS_LABEL[i.status]??i.status}</span>
     <strong className="tabular">{i.count}</strong>
    </button>
   </li>)}
  </ul>
 </div>;
}

/** Barra de cumplimiento: track completo; relleno solo al % real. */
function PctBar({done,total,label}:{done:number;total:number;label:string}){
 const pct=total?Math.round(done*100/total):0;
 const cls=toneClass(pct);
 return <div className="ops-hbar-track" role="img" aria-label={`${label}: ${pct}% completado`}>
  {pct>0&&<div className={`ops-hbar-fill ${cls}`} style={{width:`${pct}%`}}/>}
 </div>;
}

/** Barra apilada por estado sobre track completo. */
function StackedBar({done,inProgress,pending,total,title}:{done:number;inProgress:number;pending:number;total:number;title:string}){
 const base=total||1;
 return <div className="ops-hbar-track" title={title} role="img" aria-label={title}>
  {done>0&&<div className="ops-hbar-fill done" style={{width:`${(done/base)*100}%`}}/>}
  {inProgress>0&&<div className="ops-hbar-fill progress" style={{width:`${(inProgress/base)*100}%`}}/>}
  {pending>0&&<div className="ops-hbar-fill pending" style={{width:`${(pending/base)*100}%`}}/>}
 </div>;
}

export function AreaBars({areas}:{areas:{area:string;total:number;done:number;pending:number;in_progress:number}[]}){
 if(!areas.length)return null;
 const sorted=[...areas].sort((a,b)=>(a.total?a.done/a.total:0)-(b.total?b.done/b.total:0));
 return <div className="ops-hbar-list">{sorted.map(a=>{
  const donePct=a.total?Math.round(a.done*100/a.total):0;
  return <div key={a.area} className="ops-hbar">
   <div className="ops-hbar-meta"><strong>{a.area}</strong><span>{a.done}/{a.total} · <em>{donePct}%</em></span></div>
   <PctBar done={a.done} total={a.total} label={a.area}/>
  </div>;
 })}</div>;
}

export function DayBars({days}:{days:{day:string;total:number;done:number;pending:number;in_progress:number}[]}){
 if(!days.length)return null;
 return <div className="ops-hbar-list">{days.map(d=>{
  const donePct=d.total?Math.round(d.done*100/d.total):0;
  return <div key={d.day} className="ops-hbar">
   <div className="ops-hbar-meta"><strong>{d.day}</strong><span>{d.done}/{d.total} · <em>{donePct}%</em></span></div>
   <StackedBar total={d.total} done={d.done} inProgress={d.in_progress} pending={d.pending} title={d.day}/>
  </div>;
 })}</div>;
}

export function EmployeeBars({rows}:{rows:{full_name:string;code:string;total:number;done:number;pending:number;in_progress:number}[]}){
 if(!rows.length)return null;
 const sorted=[...rows].sort((a,b)=>(a.total?a.done/a.total:0)-(b.total?b.done/b.total:0));
 return <div className="ops-hbar-list">{sorted.map(r=>{
  const donePct=r.total?Math.round(r.done*100/r.total):0;
  return <div key={r.code} className="ops-hbar">
   <div className="ops-hbar-meta"><strong>{r.full_name}</strong><span>{r.code} · {r.done}/{r.total} (<em>{donePct}%</em>)</span></div>
   <PctBar done={r.done} total={r.total} label={r.full_name}/>
  </div>;
 })}</div>;
}

export {STATUS_COLORS,STATUS_HEX,STATUS_LABEL};
