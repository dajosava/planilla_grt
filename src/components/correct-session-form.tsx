"use client";

import {useMemo,useState} from "react";
import {ActionForm} from "@/components/action-form";
import {correctSession} from "@/app/admin/actions";
import {dateTime,toDatetimeLocalCR} from "@/lib/format";

export type CorrectableSession={
 id:string;
 label:string;
 started_at:string;
 ended_at:string|null;
 break_minutes:number;
};

export function CorrectSessionForm({sessions}:{sessions:CorrectableSession[]}){
 const [sessionId,setSessionId]=useState("");
 const selected=useMemo(
  ()=>sessions.find(s=>s.id===sessionId)??null,
  [sessions,sessionId]
 );

 const startLocal=selected?toDatetimeLocalCR(selected.started_at):"";
 const endLocal=selected?.ended_at?toDatetimeLocalCR(selected.ended_at):"";
 const breakMin=selected?selected.break_minutes:0;

 return (
  <ActionForm action={correctSession} key={sessionId||"empty"}>
   <label>Jornada
    <select
     name="session_id"
     value={sessionId}
     onChange={e=>setSessionId(e.target.value)}
     required
    >
     <option value="" disabled>Selecciona una jornada</option>
     {sessions.map(s=>(
      <option value={s.id} key={s.id}>{s.label}</option>
     ))}
    </select>
   </label>
   {selected&&(
    <p className="muted small" style={{gridColumn:"1 / -1",margin:0}}>
     Valores actuales: {dateTime(selected.started_at)}
     {selected.ended_at?` → ${dateTime(selected.ended_at)}`:" · sin salida"}
     {" · "}descanso {breakMin} min. Al guardar se actualiza el ajuste (podés corregir de nuevo).
    </p>
   )}
   <label>Entrada correcta
    <input name="started_at" type="datetime-local" required defaultValue={startLocal} key={`start-${sessionId}`}/>
   </label>
   <label>Salida correcta
    <input name="ended_at" type="datetime-local" required defaultValue={endLocal} key={`end-${sessionId}`}/>
   </label>
   <label>Descanso total (minutos)
    <input name="break_minutes" type="number" min={0} max={1440} required defaultValue={breakMin} key={`break-${sessionId}`}/>
   </label>
   <label>Motivo
    <input name="reason" minLength={5} maxLength={500} required key={`reason-${sessionId}`}/>
   </label>
  </ActionForm>
 );
}
