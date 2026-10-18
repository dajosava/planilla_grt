const STATUS_COLORS:Record<string,string>={
 pending:"#E67E22",
 in_progress:"#E8B923",
 completed:"#08766d",
 approved:"#08766d",
 rejected:"#b54a4a",
};
const STATUS_LABEL:Record<string,string>={
 pending:"Pendiente",
 in_progress:"En proceso",
 completed:"Completada",
 approved:"Aprobada",
 rejected:"Rechazada",
};

export function StatusDonut({items}:{items:{status:string;count:number}[]}){
 const total=items.reduce((s,i)=>s+i.count,0)||1;
 const size=180;const r=68;const c=2*Math.PI*r;
 let offset=0;
 const slices=items.filter(i=>i.count>0).map(i=>{
  const len=(i.count/total)*c;
  const slice={status:i.status,count:i.count,dash:len,gap:c-len,offset,color:STATUS_COLORS[i.status]??"#6b7a83"};
  offset+=len;
  return slice;
 });
 return <div className="ops-chart-donut">
  <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label="Distribución por estado">
   <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e3e9ec" strokeWidth="22"/>
   {slices.map(s=><circle key={s.status} cx={size/2} cy={size/2} r={r} fill="none" stroke={s.color} strokeWidth="22"
    strokeDasharray={`${s.dash} ${s.gap}`} strokeDashoffset={-s.offset+c/4}
    transform={`rotate(-90 ${size/2} ${size/2})`}/>)}
   <text x="50%" y="48%" textAnchor="middle" className="ops-chart-center-value">{Math.round(items.filter(i=>["completed","approved"].includes(i.status)).reduce((a,b)=>a+b.count,0)*100/total)}%</text>
   <text x="50%" y="58%" textAnchor="middle" className="ops-chart-center-label">hecho</text>
  </svg>
  <ul className="ops-chart-legend">{items.map(i=><li key={i.status}><span style={{background:STATUS_COLORS[i.status]??"#6b7a83"}}/>{STATUS_LABEL[i.status]??i.status} <strong>{i.count}</strong></li>)}</ul>
 </div>;
}

export function DayBars({days}:{days:{day:string;total:number;done:number;pending:number;in_progress:number}[]}){
 if(!days.length)return null;
 const max=Math.max(...days.map(d=>d.total),1);
 const w=Math.max(days.length*36,280);const h=160;const pad=28;
 return <div className="ops-chart-scroll"><svg viewBox={`0 0 ${w} ${h+pad}`} width="100%" height={h+pad} role="img" aria-label="Tareas por día">
  {days.map((d,i)=>{
   const x=i*(w/days.length)+8;
   const bw=Math.max(12,w/days.length-16);
   const doneH=(d.done/max)*(h-10);
   const progH=(d.in_progress/max)*(h-10);
   const pendH=(d.pending/max)*(h-10);
   const label=d.day.slice(5);
   return <g key={d.day}>
    <rect x={x} y={h-doneH} width={bw} height={doneH} fill={STATUS_COLORS.approved} rx="3"/>
    <rect x={x} y={h-doneH-progH} width={bw} height={progH} fill={STATUS_COLORS.in_progress} rx="3"/>
    <rect x={x} y={h-doneH-progH-pendH} width={bw} height={pendH} fill={STATUS_COLORS.pending} rx="3"/>
    <text x={x+bw/2} y={h+16} textAnchor="middle" className="ops-chart-axis">{label}</text>
   </g>;
  })}
 </svg>
 <ul className="ops-chart-legend compact">
  <li><span style={{background:STATUS_COLORS.approved}}/>Hechas</li>
  <li><span style={{background:STATUS_COLORS.in_progress}}/>En proceso</li>
  <li><span style={{background:STATUS_COLORS.pending}}/>Pendientes</li>
 </ul></div>;
}

function StackedBar({total,max,done,inProgress,pending}:{total:number;max:number;done:number;inProgress:number;pending:number}){
 const scale=max?total/max:0;
 const base=total||1;
 return <div className="ops-hbar-track" style={{width:`${Math.max(scale*100,4)}%`}}>
  {done>0&&<div className="ops-hbar-fill done" style={{width:`${(done/base)*100}%`}}/>}
  {inProgress>0&&<div className="ops-hbar-fill progress" style={{width:`${(inProgress/base)*100}%`}}/>}
  {pending>0&&<div className="ops-hbar-fill pending" style={{width:`${(pending/base)*100}%`}}/>}
 </div>;
}

export function AreaBars({areas}:{areas:{area:string;total:number;done:number;pending:number;in_progress:number}[]}){
 if(!areas.length)return null;
 const max=Math.max(...areas.map(a=>a.total),1);
 return <div className="ops-hbar-list">{areas.map(a=>{
  const donePct=a.total?Math.round(a.done*100/a.total):0;
  return <div key={a.area} className="ops-hbar">
   <div className="ops-hbar-meta"><strong>{a.area}</strong><span>{a.done}/{a.total} · {donePct}%</span></div>
   <StackedBar total={a.total} max={max} done={a.done} inProgress={a.in_progress} pending={a.pending}/>
  </div>;
 })}</div>;
}

export function EmployeeBars({rows}:{rows:{full_name:string;code:string;total:number;done:number;pending:number;in_progress:number}[]}){
 if(!rows.length)return null;
 const max=Math.max(...rows.map(r=>r.total),1);
 return <div className="ops-hbar-list">{rows.map(r=>{
  const donePct=r.total?Math.round(r.done*100/r.total):0;
  return <div key={r.code} className="ops-hbar">
   <div className="ops-hbar-meta"><strong>{r.full_name}</strong><span>{r.code} · {r.done}/{r.total} ({donePct}%)</span></div>
   <StackedBar total={r.total} max={max} done={r.done} inProgress={r.in_progress} pending={r.pending}/>
  </div>;
 })}</div>;
}
