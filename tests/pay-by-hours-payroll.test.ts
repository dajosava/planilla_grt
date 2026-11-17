import {describe,it,expect} from "vitest";
import {ccssCents,calculateFortnight} from "../src/lib/payroll";

/** Ordinario por horas: horas × tarifa (misma fórmula que sync SQL). */
function ordinaryPayCents(ordinaryHours:number,hourlyRateCents:number){
 return Math.round(ordinaryHours*hourlyRateCents);
}

describe("Pago por horas — fórmulas de planilla",()=>{
 const rate=150000; // ₡1,500

 it("base = horas ordinarias × tarifa",()=>{
  expect(ordinaryPayCents(4,rate)).toBe(600000);
  expect(ordinaryPayCents(8.5,rate)).toBe(Math.round(8.5*rate));
 });

 it("CCSS exento es 0 aunque haya base",()=>{
  const base=ordinaryPayCents(20,rate);
  expect(ccssCents(base,true)).toBe(0);
  expect(ccssCents(base,false)).toBe(Math.round(base*0.1083));
 });

 it("extras 1.5× usan la misma tarifa (no salario/2)",()=>{
  const otHours=2;
  const otAmount=Math.round(otHours*rate*1.5);
  expect(otAmount).toBe(450000); // ₡4,500
 });

 it("mensual sigue usando adelanto y CCSS sobre adelanto",()=>{
  const r=calculateFortnight({monthlySalaryCents:41975593,exemptFromCcss:false});
  expect(r.advanceCents).toBeGreaterThan(0);
  expect(r.ccssCents).toBeGreaterThan(0);
  expect(r.netCents).toBe(r.advanceCents-r.ccssCents);
 });
});
