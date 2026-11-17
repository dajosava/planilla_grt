import {z} from "zod";
import {COMPANIES} from "@/lib/companies";
export const dateSchema=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s=>!Number.isNaN(Date.parse(s+"T00:00:00Z")) && new Date(s+"T00:00:00Z").toISOString().slice(0,10)===s);
export const cedulaSchema=z.string().trim().transform(s=>s.replace(/\D/g,"")).pipe(z.string().regex(/^\d{9,12}$/));
export const emailSchema=z.string().trim().toLowerCase().email().max(254);
export const companySchema=z.enum(COMPANIES);
export const employeeSchema=z.object({
 code:z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{1,12}$/),
 full_name:z.string().trim().min(3).max(120),
 position:z.string().trim().min(2).max(80),
 department:companySchema,
 salary:z.string().optional().default("0"),
 hourly_rate:z.string().optional().default("0"),
 pin:z.string().regex(/^\d{4}$/),
 vacation_balance:z.coerce.number().min(0).max(365).optional().default(0),
 hired_on:dateSchema,
 cedula:cedulaSchema,
 email:emailSchema,
 hours_month:z.coerce.number().min(1).max(400).optional().default(243.36),
 exempt_from_ccss:z.coerce.boolean().default(false),
 pay_by_hours:z.coerce.boolean().default(false),
}).superRefine((v,ctx)=>{
 if(v.pay_by_hours){
  if(!v.hourly_rate||v.hourly_rate==="0"||!/^\d{1,9}(\.\d{1,2})?$/.test(v.hourly_rate)){
   ctx.addIssue({code:"custom",message:"Indicá el precio por hora (CRC).",path:["hourly_rate"]});
  }
 }else if(!v.salary||!/^\d{1,9}(\.\d{1,2})?$/.test(v.salary)){
  ctx.addIssue({code:"custom",message:"Indicá el salario mensual (CRC).",path:["salary"]});
 }
});
export const punchSchema=z.object({
 code:z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{1,12}$/),
 pin:z.string().regex(/^\d{4}$/),
 kind:z.enum(["entry","exit","break_start","break_end"]),
 requestId:z.uuid(),
 photo:z.string().max(270000).regex(/^[A-Za-z0-9+/]+=*$/).nullish().catch(null),
 /** ISO UTC de la tablet; solo cola offline. Online: omitir (hora servidor). */
 occurredAt:z.iso.datetime().nullish().catch(null),
});
