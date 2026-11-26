"use client";

import {useEffect,useMemo,useState,useTransition} from "react";
import {useRouter} from "next/navigation";
import {ChevronLeft,ChevronRight} from "lucide-react";
import {upsertHoliday,deleteHoliday} from "@/app/admin/actions";

export type HolidayItem={date:string;name:string};

const WEEKDAYS=["Lu","Ma","Mi","Ju","Vi","Sá","Do"];
const MONTHS=[
 "Enero","Febrero","Marzo","Abril","Mayo","Junio",
 "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];

function pad(n:number){return String(n).padStart(2,"0")}
function iso(y:number,m0:number,d:number){return `${y}-${pad(m0+1)}-${pad(d)}`}

function monthCells(year:number,month0:number){
 const first=new Date(Date.UTC(year,month0,1));
 const startDow=(first.getUTCDay()+6)%7;
 const daysInMonth=new Date(Date.UTC(year,month0+1,0)).getUTCDate();
 const cells:(number|null)[]=[];
 for(let i=0;i<startDow;i++)cells.push(null);
 for(let d=1;d<=daysInMonth;d++)cells.push(d);
 while(cells.length%7!==0)cells.push(null);
 return cells;
}

export function HolidaysCalendar({
 year,
 holidays,
}:{
 year:number;
 holidays:HolidayItem[];
}){
 const router=useRouter();
 const [pending,startTransition]=useTransition();
 const [msg,setMsg]=useState<{ok?:string;error?:string}|null>(null);
 const [busyDate,setBusyDate]=useState<string|null>(null);
 const [month0,setMonth0]=useState(()=>{
  const now=new Date();
  return now.getFullYear()===year?now.getMonth():0;
 });

 useEffect(()=>{
  const now=new Date();
  setMonth0(now.getFullYear()===year?now.getMonth():0);
 },[year]);

 const byDate=useMemo(()=>{
  const m=new Map<string,string>();
  for(const h of holidays)m.set(h.date,h.name);
  return m;
 },[holidays]);

 const cells=useMemo(()=>monthCells(year,month0),[year,month0]);
 const monthHolidays=useMemo(
  ()=>holidays.filter(h=>h.date.startsWith(`${year}-${pad(month0+1)}`)),
  [holidays,year,month0]
 );

 const yearOptions=useMemo(()=>{
  const current=new Date().getFullYear();
  const from=Math.min(2024,current-1,year);
  const to=Math.max(2050,year);
  const years:number[]=[];
  for(let y=from;y<=to;y++)years.push(y);
  return years;
 },[year]);

 function goYear(next:number,nextMonth=month0){
  const q=new URLSearchParams({tab:"feriados",year:String(next)});
  setMonth0(nextMonth);
  router.push(`/admin/empleados?${q}`);
 }

 function prevMonth(){
  if(month0===0)goYear(year-1,11);
  else setMonth0(m=>m-1);
 }

 function nextMonth(){
  if(month0===11)goYear(year+1,0);
  else setMonth0(m=>m+1);
 }

 async function toggleDay(date:string){
  if(pending||busyDate)return;
  setMsg(null);
  setBusyDate(date);
  const fd=new FormData();
  fd.set("date",date);
  try{
   if(byDate.has(date)){
    const res=await deleteHoliday({},fd);
    setMsg(res.error?{error:res.error}:{ok:res.success??"Eliminado"});
   }else{
    const name=window.prompt("Nombre del feriado","Feriado")?.trim();
    if(!name){setBusyDate(null);return;}
    fd.set("name",name);
    const res=await upsertHoliday({},fd);
    setMsg(res.error?{error:res.error}:{ok:res.success??"Guardado"});
   }
   startTransition(()=>router.refresh());
  }catch{
   setMsg({error:"No se pudo actualizar el feriado."});
  }finally{
   setBusyDate(null);
  }
 }

  return (
  <div className="holidays-calendar">
   <div className="holidays-year-bar">
    <label className="holidays-year-select">
     <span>Año</span>
     <select
      value={year}
      disabled={pending}
      aria-label="Seleccionar año"
      onChange={e=>goYear(Number(e.target.value))}
     >
      {yearOptions.map(y=>(
       <option key={y} value={y}>{y}</option>
      ))}
     </select>
    </label>
    <p className="muted small holidays-year-hint">
     Tocá un día para marcarlo o quitarlo como feriado. Las horas trabajadas en feriado
     se pagan <strong>doble</strong> al sincronizar la planilla.
    </p>
   </div>

   {msg?.error?<p className="alert error" role="alert">{msg.error}</p>:null}
   {msg?.ok?<p className="alert success" role="status">{msg.ok}</p>:null}

   <div className="holidays-carousel" aria-roledescription="carrusel" aria-label="Calendario de feriados">
    <button
     type="button"
     className="secondary holidays-nav"
     disabled={pending}
     onClick={prevMonth}
     aria-label="Mes anterior"
    >
     <ChevronLeft size={20} aria-hidden="true"/>
    </button>

    <section className="holidays-month holidays-month-slide" aria-label={`${MONTHS[month0]} ${year}`}>
     <div className="holidays-month-head">
      <h3 className="holidays-year">{MONTHS[month0]}</h3>
      <div className="holidays-dots" aria-hidden="true">
       {MONTHS.map((_,i)=>(
        <button
         key={i}
         type="button"
         className={`holidays-dot${i===month0?" is-active":""}`}
         aria-label={MONTHS[i]}
         onClick={()=>setMonth0(i)}
        />
       ))}
      </div>
     </div>

     <div className="holidays-weekdays" aria-hidden="true">
      {WEEKDAYS.map(d=><span key={d}>{d}</span>)}
     </div>
     <div className="holidays-grid">
      {cells.map((day,idx)=>{
       if(day==null)return <span key={`e-${idx}`} className="holidays-cell is-empty"/>;
       const date=iso(year,month0,day);
       const marked=byDate.has(date);
       const name=byDate.get(date);
       return (
        <button
         key={date}
         type="button"
         className={`holidays-cell${marked?" is-holiday":""}${busyDate===date?" is-busy":""}`}
         title={marked?`${date} · ${name} (clic para quitar)`:`${date} · marcar feriado`}
         aria-pressed={marked}
         disabled={!!busyDate}
         onClick={()=>void toggleDay(date)}
        >
         {day}
        </button>
       );
      })}
     </div>
    </section>

    <button
     type="button"
     className="secondary holidays-nav"
     disabled={pending}
     onClick={nextMonth}
     aria-label="Mes siguiente"
    >
     <ChevronRight size={20} aria-hidden="true"/>
    </button>
   </div>

   <div className="holidays-list">
    <h4>Feriados de {MONTHS[month0]} ({monthHolidays.length})</h4>
    {!monthHolidays.length?(
     <p className="muted small">No hay feriados marcados en este mes.</p>
    ):(
     <ul>
      {monthHolidays.map(h=>(
       <li key={h.date}>
        <strong>{h.date}</strong>
        <span>{h.name}</span>
        <button
         type="button"
         className="secondary small-button"
         disabled={!!busyDate}
         onClick={()=>void toggleDay(h.date)}
        >
         Quitar
        </button>
       </li>
      ))}
     </ul>
    )}
    <p className="muted small" style={{marginTop:12}}>
     Total del año {year}: <strong>{holidays.length}</strong> feriado{holidays.length===1?"":"s"}.
    </p>
   </div>
  </div>
 );
}
