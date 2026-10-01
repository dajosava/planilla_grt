import {z} from "zod";
export const employeeSchema=z.object({code:z.string().regex(/^[A-Z0-9-]{2,12}$/),full_name:z.string().trim().min(3).max(120),position:z.string().trim().min(2).max(80),department:z.enum(["Pista","Supermercado","Tienda","Transporte","Administración"]),salary:z.string(),pin:z.string().regex(/^\d{6,8}$/),vacation_balance:z.coerce.number().min(0).max(365)});
export const punchSchema=z.object({code:z.string().regex(/^[A-Z0-9-]{2,12}$/),pin:z.string().regex(/^\d{6,8}$/),kind:z.enum(["entry","exit","break_start","break_end"]),requestId:z.uuid()});
export const dateSchema=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s=>!Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0,10)===s);
