"use client";

import {useState} from "react";

export function AttendancePhotoThumb({
 id,kindLabel,title,status,eager,
}:{
 id:string;
 kindLabel:string;
 title:string;
 status:string|null;
 /** Si true, carga la imagen de inmediato (últimas 24 h). */
 eager:boolean;
}){
 const [revealed,setRevealed]=useState(eager);
 const src=`/api/fotos/${id}`;

 if(status!=="captured"){
  return (
   <span className="photo-thumb photo-thumb-empty" title={title}>
    <span className={`no-photo${status==="missing"?"":" expired"}`}>
     {status==="missing"?"Sin foto":status==="expired"?"Vencida":"—"}
    </span>
    <span className="photo-thumb-label">{kindLabel}</span>
   </span>
  );
 }

 if(!revealed){
  return (
   <button
    type="button"
    className="photo-thumb photo-thumb-deferred"
    title={`${title} · clic para cargar`}
    onClick={()=>setRevealed(true)}
   >
    <span className="photo-thumb-deferred-label">Ver foto</span>
    <span className="photo-thumb-label">{kindLabel}</span>
   </button>
  );
 }

 return (
  <a className="photo-thumb" href={src} target="_blank" rel="noopener" title={title}>
   <img src={src} alt={`Foto de ${kindLabel}`} loading={eager?"lazy":"eager"}/>
   <span className="photo-thumb-label">{kindLabel}</span>
  </a>
 );
}
