import {describe,it,expect} from "vitest";
import {employeeSchema} from "../src/lib/schemas";

const base={
 code:"LIM1",
 full_name:"Ana Limpieza",
 position:"Limpieza",
 department:"Gasolinera" as const,
 pin:"1234",
 hired_on:"2026-01-15",
 cedula:"1-2345-6789",
 email:"ana@grt.com",
};

describe("employeeSchema — pago por horas",()=>{
 it("acepta empleado por horas con tarifa y sin salario",()=>{
  const v=employeeSchema.parse({
   ...base,
   pay_by_hours:true,
   hourly_rate:"1500",
   salary:"0",
   vacation_balance:0,
   hours_month:243.36,
   exempt_from_ccss:true,
  });
  expect(v.pay_by_hours).toBe(true);
  expect(v.hourly_rate).toBe("1500");
 });

 it("rechaza pago por horas sin precio de hora",()=>{
  const r=employeeSchema.safeParse({
   ...base,
   pay_by_hours:true,
   hourly_rate:"0",
   vacation_balance:0,
  });
  expect(r.success).toBe(false);
  if(!r.success){
   expect(r.error.issues.some(i=>i.path.includes("hourly_rate"))).toBe(true);
  }
 });

 it("acepta mensual con salario y sin tarifa",()=>{
  const v=employeeSchema.parse({
   ...base,
   pay_by_hours:false,
   salary:"419755.93",
   vacation_balance:10,
   hours_month:243.36,
  });
  expect(v.pay_by_hours).toBe(false);
  expect(v.salary).toBe("419755.93");
 });

 it("rechaza mensual sin salario válido",()=>{
  const r=employeeSchema.safeParse({
   ...base,
   pay_by_hours:false,
   salary:"",
   vacation_balance:0,
  });
  expect(r.success).toBe(false);
 });

 it("default de vacaciones y horas cuando omitidos (onboarding por horas)",()=>{
  const v=employeeSchema.parse({
   ...base,
   pay_by_hours:true,
   hourly_rate:"1800.50",
  });
  expect(v.vacation_balance).toBe(0);
  expect(v.hours_month).toBe(243.36);
 });
});
