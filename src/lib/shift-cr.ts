/** Clasificación de jornadas según art. 135 Código de Trabajo (Costa Rica). */

export type ShiftType="DAY"|"MIXED"|"NIGHT";

export type ShiftResult={
 type:ShiftType;
 /** Etiqueta en español */
 label:"Diurna"|"Mixta"|"Nocturna";
 workedMinutes:number;
 dayMinutes:number;
 nightMinutes:number;
 /** Límite ordinario: 8h / 7h / 6h */
 legalOrdinaryLimitMinutes:number;
 legalOrdinaryLimitHours:number;
};

export const SHIFT_LABELS:Record<ShiftType,"Diurna"|"Mixta"|"Nocturna">={
 DAY:"Diurna",
 MIXED:"Mixta",
 NIGHT:"Nocturna",
};

export const ORDINARY_LIMIT_MINUTES:Record<ShiftType,number>={
 DAY:480,
 MIXED:420,
 NIGHT:360,
};

const CR_TZ="America/Costa_Rica";
/** Minutos nocturnos que convierten mixta → nocturna (3 h 30 min). */
export const NIGHT_THRESHOLD_MINUTES=210;

function hourInCostaRica(ms:number):number{
 return Number(
  new Intl.DateTimeFormat("en-US",{
   timeZone:CR_TZ,
   hour:"2-digit",
   hourCycle:"h23",
  }).format(new Date(ms))
 );
}

/** Minutos efectivos en franja nocturna (19:00–05:00 CR), minuto a minuto. */
export function countNightMinutes(start:Date,end:Date):number{
 let night=0;
 for(let t=start.getTime();t<end.getTime();t+=60_000){
  const hour=hourInCostaRica(t);
  if(hour>=19||hour<5)night++;
 }
 return night;
}

/**
 * Clasifica un intervalo continuo de trabajo (entrada → salida).
 * No resta descansos: el caller debe pasar el intervalo ordinario pactado
 * o el intervalo real; las horas netas para OT se comparan aparte.
 */
export function classifyShift(clockIn:string|Date,clockOut:string|Date):ShiftResult{
 const start=clockIn instanceof Date?clockIn:new Date(clockIn);
 const end=clockOut instanceof Date?clockOut:new Date(clockOut);

 if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||end<=start){
  throw new Error("Intervalo de jornada inválido");
 }

 const workedMinutes=Math.round((end.getTime()-start.getTime())/60_000);
 const nightMinutes=countNightMinutes(start,end);
 const dayMinutes=Math.max(0,workedMinutes-nightMinutes);

 let type:ShiftType;
 if(nightMinutes===0)type="DAY";
 else if(dayMinutes===0||nightMinutes>=NIGHT_THRESHOLD_MINUTES)type="NIGHT";
 else type="MIXED";

 const legalOrdinaryLimitMinutes=ORDINARY_LIMIT_MINUTES[type];

 return {
  type,
  label:SHIFT_LABELS[type],
  workedMinutes,
  dayMinutes,
  nightMinutes,
  legalOrdinaryLimitMinutes,
  legalOrdinaryLimitHours:legalOrdinaryLimitMinutes/60,
 };
}

/** Horas extra netas respecto al límite ordinario de la clasificación. */
export function overtimeHours(workedHours:number,shift:Pick<ShiftResult,"legalOrdinaryLimitHours">):number{
 const ot=workedHours-shift.legalOrdinaryLimitHours;
 if(ot<=0)return 0;
 return Math.round(ot*100)/100;
}
