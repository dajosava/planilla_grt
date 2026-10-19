import {
 Users,CalendarRange,Calculator,Clock3,Receipt,
 ClipboardCheck,Wallet,Building2,type LucideIcon,
} from "lucide-react";

export type PayrollStepId=
 |"empleados"|"periodo"|"calculo"|"extras"|"deducciones"|"revision"|"neto"|"pago";

const STEPS:{id:PayrollStepId;label:string;hint:string;Icon:LucideIcon}[]=[
 {id:"empleados",label:"Empleados",hint:"Salarios y horas/mes",Icon:Users},
 {id:"periodo",label:"Periodo",hint:"Quincena 1 o 2",Icon:CalendarRange},
 {id:"calculo",label:"Cálculo",hint:"Adelanto = salario/2",Icon:Calculator},
 {id:"extras",label:"Extras",hint:"Horas 1.5× y doble",Icon:Clock3},
 {id:"deducciones",label:"Deducciones",hint:"CCSS + faltantes",Icon:Receipt},
 {id:"revision",label:"Revisión",hint:"Confirmar cada uno",Icon:ClipboardCheck},
 {id:"neto",label:"Neto a pagar",hint:"Total a depositar",Icon:Wallet},
 {id:"pago",label:"Pago",hint:"Reporte / CSV banco",Icon:Building2},
];

/** Índice del paso activo según el estado de la corrida. */
export function payrollActiveIndex(opts:{
 hasRun:boolean;
 isDraft:boolean;
 reviewed:number;
 total:number;
 hasExtras:boolean;
 hasManualDeductions:boolean;
}):number{
 if(!opts.hasRun)return 1; // periodo
 if(opts.isDraft){
  if(opts.reviewed>=opts.total&&opts.total>0)return 6; // listo para neto/cierre
  if(opts.hasManualDeductions||opts.hasExtras)return 5; // revisión
  return 3; // extras / captura
 }
 return 7; // cerrado → pago
}

export function PayrollFlow({activeIndex}:{activeIndex:number}){
 return (
  <section className="payroll-flow" aria-label="Flujo de planilla">
   <div className="payroll-flow-head">
    <p className="eyebrow">Flujo de nómina</p>
    <p className="muted small" style={{margin:0}}>Seguí estos pasos para pagar la quincena sin errores.</p>
   </div>
   <ol className="payroll-flow-track">
    {STEPS.map((s,i)=>{
     const state=i<activeIndex?"done":i===activeIndex?"current":"todo";
     const {Icon}=s;
     return (
      <li key={s.id} className={`payroll-flow-step ${state}`} aria-current={state==="current"?"step":undefined}>
       <span className="payroll-flow-icon" aria-hidden="true"><Icon size={18}/></span>
       <span className="payroll-flow-label">{s.label}</span>
       <span className="payroll-flow-hint">{s.hint}</span>
      </li>
     );
    })}
   </ol>
  </section>
 );
}
