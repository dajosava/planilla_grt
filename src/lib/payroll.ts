import {z} from "zod";

/** Constantes alineadas a xls_actual/LOGICA-PLANILLA.md */
export const CCSS_RATE=0.1083;
export const DAYS_PER_MONTH=30.42;
export const DEFAULT_HOURS_PER_DAY=8;
export const DEFAULT_HOURS_MONTH=Number((DAYS_PER_MONTH*DEFAULT_HOURS_PER_DAY).toFixed(2)); // 243.36
export const OT_FACTOR=1.5;

export const payrollInput=z.object({
 baseCents:z.number().int().min(0).max(100_000_000_00),
 additionCents:z.number().int().min(0).max(100_000_000_00),
 deductionCents:z.number().int().min(0).max(100_000_000_00),
});

export function calculatePayroll(input:z.infer<typeof payrollInput>){
 const v=payrollInput.parse(input);
 const grossCents=v.baseCents+v.additionCents;
 if(v.deductionCents>grossCents)throw new Error("Las deducciones superan el salario bruto.");
 return {grossCents,netCents:grossCents-v.deductionCents};
}

/** CRC string → centavos enteros */
export function crcToCents(value:string):number{
 if(!/^\d{1,9}(\.\d{1,2})?$/.test(value))throw new Error("Usa un monto positivo con hasta dos decimales, sin separadores de miles.");
 const [whole,fraction=""]=value.split(".");
 return Number(whole)*100+Number(fraction.padEnd(2,"0"));
}

export function csvCell(value:unknown):string{
 let text=String(value??"");
 if(/^[=+@\-\t\r\n]/.test(text))text="'"+text;
 return '"'+text.replaceAll('"','""')+'"';
}

/** Redondeo a colón entero (como usan en quincena: 1724.84 → 1725). */
export function roundColonCents(cents:number):number{
 return Math.round(cents/100)*100;
}

/** Valor hora en centavos: salario_mensual / horas_mes, redondeado a colón. */
export function hourlyRateCents(monthlySalaryCents:number,hoursMonth=DEFAULT_HOURS_MONTH):number{
 if(hoursMonth<=0)throw new Error("Las horas del mes deben ser mayores a cero.");
 return roundColonCents(monthlySalaryCents/hoursMonth);
}

/** Adelanto quincenal = salario / 2 */
export function fortnightAdvanceCents(monthlySalaryCents:number):number{
 return Math.round(monthlySalaryCents/2);
}

/** Jornada diaria = salario / 30.42 */
export function dailyWageCents(monthlySalaryCents:number):number{
 return Math.round(monthlySalaryCents/DAYS_PER_MONTH);
}

export function overtimeAmountCents(otHours:number,hourlyCents:number):number{
 if(otHours<0)throw new Error("Las horas extra no pueden ser negativas.");
 return Math.round(otHours*hourlyCents*OT_FACTOR);
}

export function doubleAmountCents(doubleHours:number,doubleRateCents:number):number{
 if(doubleHours<0)throw new Error("Las horas doble no pueden ser negativas.");
 return Math.round(doubleHours*doubleRateCents);
}

/** CCSS solo sobre el adelanto (como en Excel actual). */
export function ccssCents(advanceCents:number,exempt=false):number{
 if(exempt)return 0;
 return Math.round(advanceCents*CCSS_RATE);
}

export type FortnightInput={
 monthlySalaryCents:number;
 hoursMonth?:number;
 otHours?:number;
 doubleHours?:number;
 /** Si no se pasa, usa 2× valor hora */
 doubleRateCents?:number;
 otherPayCents?:number;
 shortageCents?:number;
 receiptCents?:number;
 otherDeductionCents?:number;
 exemptFromCcss?:boolean;
};

export type FortnightResult={
 hoursMonth:number;
 hourlyRateCents:number;
 advanceCents:number;
 dailyWageCents:number;
 otHours:number;
 otAmountCents:number;
 doubleHours:number;
 doubleRateCents:number;
 doubleAmountCents:number;
 otherPayCents:number;
 additionCents:number;
 ccssCents:number;
 shortageCents:number;
 receiptCents:number;
 otherDeductionCents:number;
 deductionCents:number;
 grossCents:number;
 netCents:number;
};

/** Motor quincenal completo (adelanto + extras + CCSS + deducciones manuales). */
export function calculateFortnight(input:FortnightInput):FortnightResult{
 const hoursMonth=input.hoursMonth??DEFAULT_HOURS_MONTH;
 const hourly=hourlyRateCents(input.monthlySalaryCents,hoursMonth);
 const advance=fortnightAdvanceCents(input.monthlySalaryCents);
 const otHours=input.otHours??0;
 const doubleHours=input.doubleHours??0;
 const doubleRate=input.doubleRateCents??hourly*2;
 const otAmount=overtimeAmountCents(otHours,hourly);
 const doubleAmount=doubleAmountCents(doubleHours,doubleRate);
 const otherPay=input.otherPayCents??0;
 const shortage=input.shortageCents??0;
 const receipt=input.receiptCents??0;
 const otherDed=input.otherDeductionCents??0;
 const ccss=ccssCents(advance,input.exemptFromCcss??false);
 const addition=otAmount+doubleAmount+otherPay;
 const deduction=ccss+shortage+receipt+otherDed;
 const {grossCents,netCents}=calculatePayroll({
  baseCents:advance,
  additionCents:addition,
  deductionCents:deduction,
 });
 return {
  hoursMonth,
  hourlyRateCents:hourly,
  advanceCents:advance,
  dailyWageCents:dailyWageCents(input.monthlySalaryCents),
  otHours,
  otAmountCents:otAmount,
  doubleHours,
  doubleRateCents:doubleRate,
  doubleAmountCents:doubleAmount,
  otherPayCents:otherPay,
  additionCents:addition,
  ccssCents:ccss,
  shortageCents:shortage,
  receiptCents:receipt,
  otherDeductionCents:otherDed,
  deductionCents:deduction,
  grossCents,
  netCents,
 };
}

/** Aguinaldo = (ordinario_acum + extras_acum) / 12 */
export function aguinaldoCents(ordinaryAccumCents:number,overtimeAccumCents:number):number{
 return Math.round((ordinaryAccumCents+overtimeAccumCents)/12);
}

/** Fechas de una quincena en CR a partir de YYYY-MM y half 1|2. */
export function fortnightBounds(yearMonth:string,half:1|2):{start:string;end:string}{
 if(!/^\d{4}-\d{2}$/.test(yearMonth))throw new Error("Mes inválido.");
 const [y,m]=yearMonth.split("-").map(Number);
 const lastDay=new Date(Date.UTC(y,m,0)).getUTCDate();
 if(half===1)return {start:`${yearMonth}-01`,end:`${yearMonth}-15`};
 return {start:`${yearMonth}-16`,end:`${yearMonth}-${String(lastDay).padStart(2,"0")}`};
}

export function labelFortnight(periodStart:string,periodEnd:string):string{
 return `${periodStart} → ${periodEnd}`;
}
