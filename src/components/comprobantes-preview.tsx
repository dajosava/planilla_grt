"use client";

import {useEffect,useState} from "react";
import {X} from "lucide-react";
import {money} from "@/lib/format";
import {Table} from "@/components/admin-ui";
import {
 ComprobantePago,
 type ComprobantePagoProps,
} from "@/components/comprobante-pago";

export type ComprobantePreviewItem={
 id:string;
 employee_code:string;
 employee_name:string;
 base_cents:number;
 extras_cents:number;
 ccss_cents:number;
 other_ded_cents:number;
 net_cents:number;
 slip:ComprobantePagoProps;
};

export function ComprobantesPreview({
 items,
 totalNet,
}:{
 items:ComprobantePreviewItem[];
 totalNet:number;
}){
 const [openId,setOpenId]=useState<string|null>(null);
 const selected=items.find(i=>i.id===openId)??null;

 useEffect(()=>{
  if(!openId)return;
  const onKey=(e:KeyboardEvent)=>{if(e.key==="Escape")setOpenId(null);};
  window.addEventListener("keydown",onKey);
  return()=>window.removeEventListener("keydown",onKey);
 },[openId]);

 return (
  <>
   <div className="no-print report-summary">
    <Table headers={["Código","Empleado","Adelanto","Extras","CCSS","Otras ded.","Neto"]}>
     {items.map(i=>(
      <tr
       key={i.id}
       className="comprobante-row-click"
       tabIndex={0}
       role="button"
       aria-label={`Ver comprobante de ${i.employee_name}`}
       onClick={()=>setOpenId(i.id)}
       onKeyDown={e=>{
        if(e.key==="Enter"||e.key===" "){e.preventDefault();setOpenId(i.id);}
       }}
      >
       <td>{i.employee_code}</td>
       <td><strong>{i.employee_name}</strong></td>
       <td>{money(i.base_cents)}</td>
       <td>{money(i.extras_cents)}</td>
       <td>{money(i.ccss_cents)}</td>
       <td>{money(i.other_ded_cents)}</td>
       <td>{money(i.net_cents)}</td>
      </tr>
     ))}
    </Table>
    <h2>Total neto: {money(totalNet)}</h2>
    <p className="small muted">
     Tocá un empleado para ver su comprobante. Para imprimir todos usá <strong>Imprimir / guardar PDF</strong>.
    </p>
   </div>

   {/* Solo impresión: todos los comprobantes, sin modal */}
   <div className="comprobante-stack print-only" aria-hidden="true">
    {items.map(i=>(
     <ComprobantePago key={i.id} {...i.slip}/>
    ))}
   </div>

   {selected?(
    <div
     className="modal-backdrop comprobante-modal-backdrop no-print"
     onClick={()=>setOpenId(null)}
     role="presentation"
    >
     <div
      className="comprobante-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="comprobante-modal-title"
      onClick={e=>e.stopPropagation()}
     >
      <div className="comprobante-modal-bar">
       <h2 id="comprobante-modal-title" className="comprobante-modal-heading">
        Comprobante · {selected.employee_name}
       </h2>
       <button
        type="button"
        className="secondary small-button comprobante-modal-close"
        onClick={()=>setOpenId(null)}
        autoFocus
       >
        <X size={16} aria-hidden="true"/>
        Cerrar
       </button>
      </div>
      <div className="comprobante-modal-body">
       <ComprobantePago {...selected.slip}/>
      </div>
     </div>
    </div>
   ):null}
  </>
 );
}
