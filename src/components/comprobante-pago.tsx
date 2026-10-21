import {money} from "@/lib/format";

export type ComprobanteLine={
 label:string;
 hours?:string|null;
 amountCents:number;
 balanceCents?:number|null;
};

export type ComprobantePagoProps={
 companyName:string;
 employeeName:string;
 employeeCode:string;
 department:string;
 position:string;
 section?:string;
 periodLabel:string;
 income:ComprobanteLine[];
 deductions:ComprobanteLine[];
 note?:string|null;
};

function dash(v:string|null|undefined){
 const t=(v??"").trim();
 return t||"—";
}

function amount(cents:number){
 if(!cents)return "";
 return money(cents);
}

/** Rellena filas vacías para que el layout se parezca al template. */
function padRows(rows:ComprobanteLine[],min=3):ComprobanteLine[]{
 const out=[...rows];
 while(out.length<min)out.push({label:"",amountCents:0});
 return out;
}

export function ComprobantePago({
 companyName,employeeName,employeeCode,department,position,section,periodLabel,income,deductions,note,
}:ComprobantePagoProps){
 const incomeRows=padRows(income.filter(r=>r.amountCents>0||r.label));
 const dedRows=padRows(deductions.filter(r=>r.amountCents>0||r.label));
 const totalIncome=income.reduce((s,r)=>s+r.amountCents,0);
 const totalDed=deductions.reduce((s,r)=>s+r.amountCents,0);
 const net=Math.max(0,totalIncome-totalDed);

 return (
  <section className="comprobante" aria-label={`Comprobante de pago de ${employeeName}`}>
   <header className="comprobante-head">
    <p className="comprobante-company">{companyName}</p>
    <p className="comprobante-title">Comprobante de Pago</p>
   </header>

   <div className="comprobante-meta">
    <div className="comprobante-meta-col">
     <p><span>Colaborador:</span> <strong>{dash(employeeName)}</strong></p>
     <p><span>Departamento:</span> <strong>{dash(department)}</strong></p>
     <p><span>Puesto:</span> <strong>{dash(position)}</strong></p>
    </div>
    <div className="comprobante-meta-col">
     <p><span>Código:</span> <strong>{dash(employeeCode)}</strong></p>
     <p><span>Sección:</span> <strong>{dash(section??department)}</strong></p>
     <p><span>Periodo:</span> <strong>{dash(periodLabel)}</strong></p>
    </div>
   </div>

   <div className="comprobante-grid">
    <table className="comprobante-table">
     <thead>
      <tr>
       <th>Ingresos</th>
       <th className="num">Horas</th>
       <th className="num">Monto</th>
      </tr>
     </thead>
     <tbody>
      {incomeRows.map((r,i)=>(
       <tr key={`in-${i}`}>
        <td>{r.label||"\u00a0"}</td>
        <td className="num">{r.hours||""}</td>
        <td className="num">{amount(r.amountCents)}</td>
       </tr>
      ))}
      <tr className="comprobante-total">
       <td colSpan={2}>Total Ingresos</td>
       <td className="num">{money(totalIncome)}</td>
      </tr>
     </tbody>
    </table>

    <table className="comprobante-table">
     <thead>
      <tr>
       <th>Deducciones</th>
       <th className="num">Monto</th>
       <th className="num">Saldo</th>
      </tr>
     </thead>
     <tbody>
      {dedRows.map((r,i)=>(
       <tr key={`de-${i}`}>
        <td>{r.label||"\u00a0"}</td>
        <td className="num">{amount(r.amountCents)}</td>
        <td className="num">{r.balanceCents!=null&&r.balanceCents>0?money(r.balanceCents):""}</td>
       </tr>
      ))}
      <tr className="comprobante-total">
       <td>Total Deducciones</td>
       <td className="num" colSpan={2}>{money(totalDed)}</td>
      </tr>
      <tr className="comprobante-net">
       <td>Neto a Pagar</td>
       <td className="num" colSpan={2}>{money(net)}</td>
      </tr>
     </tbody>
    </table>
   </div>

   {note?<p className="comprobante-note pre-wrap">{note}</p>:null}
  </section>
 );
}

/** Arma líneas de ingresos/deducciones desde un ítem de planilla. */
export function linesFromPayrollItem(i:{
 base_cents:number;
 ot_hours?:number|null;
 ot_amount_cents?:number|null;
 double_hours?:number|null;
 double_amount_cents?:number|null;
 other_pay_cents?:number|null;
 ccss_cents?:number|null;
 shortage_cents?:number|null;
 receipt_cents?:number|null;
 other_deduction_cents?:number|null;
}):{income:ComprobanteLine[];deductions:ComprobanteLine[]}{
 const income:ComprobanteLine[]=[
  {label:"Adelanto quincenal",hours:"",amountCents:Number(i.base_cents||0)},
 ];
 const otH=Number(i.ot_hours||0);
 const otAmt=Number(i.ot_amount_cents||0);
 if(otH>0||otAmt>0)income.push({label:"Horas extra (1.5×)",hours:otH?otH.toFixed(2):"",amountCents:otAmt});
 const dblH=Number(i.double_hours||0);
 const dblAmt=Number(i.double_amount_cents||0);
 if(dblH>0||dblAmt>0)income.push({label:"Horas doble (2×)",hours:dblH?dblH.toFixed(2):"",amountCents:dblAmt});
 const other=Number(i.other_pay_cents||0);
 if(other>0)income.push({label:"Otros pagos / comisiones",hours:"",amountCents:other});

 const deductions:ComprobanteLine[]=[];
 const ccss=Number(i.ccss_cents||0);
 if(ccss>0)deductions.push({label:"CCSS (10.83%)",amountCents:ccss});
 const shortage=Number(i.shortage_cents||0);
 if(shortage>0)deductions.push({label:"Faltantes pista",amountCents:shortage});
 const receipt=Number(i.receipt_cents||0);
 if(receipt>0)deductions.push({label:"Facturas / recibos",amountCents:receipt});
 const otherDed=Number(i.other_deduction_cents||0);
 if(otherDed>0)deductions.push({label:"Otras deducciones",amountCents:otherDed});

 return {income,deductions};
}

/** Fecha ISO YYYY-MM-DD → DD/MM/YYYY */
export function formatSlipDate(iso:string):string{
 const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
 if(!m)return iso;
 return `${m[3]}/${m[2]}/${m[1]}`;
}

export function formatSlipPeriod(start:string,end:string):string{
 return `${formatSlipDate(start)} - ${formatSlipDate(end)}`;
}
