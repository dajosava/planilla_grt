import {describe,it,expect} from "vitest";
import {
 calculatePayroll,crcToCents,csvCell,
 calculateFortnight,hourlyRateCents,fortnightAdvanceCents,ccssCents,
 aguinaldoCents,fortnightBounds,DEFAULT_HOURS_MONTH,CCSS_RATE,
} from "../src/lib/payroll";

describe("Planilla con centavos enteros",()=>{
 it("calcula bruto y neto sin flotantes",()=>expect(calculatePayroll({baseCents:50000000,additionCents:2500050,deductionCents:5500025})).toEqual({grossCents:52500050,netCents:47000025}));
 it("rechaza deducciones mayores al bruto",()=>expect(()=>calculatePayroll({baseCents:100,additionCents:0,deductionCents:101})).toThrow());
 it("rechaza importes negativos o fraccionarios",()=>{expect(()=>calculatePayroll({baseCents:-1,additionCents:0,deductionCents:0})).toThrow();expect(()=>calculatePayroll({baseCents:1.1,additionCents:0,deductionCents:0})).toThrow()});
 it("convierte decimales de CRC de forma exacta",()=>{expect(crcToCents("123.45")).toBe(12345);expect(crcToCents("0.10")).toBe(10);expect(crcToCents("500000")).toBe(50000000)});
 it("no acepta comas, exponentes ni precisión excesiva",()=>{for(const v of ["1,000","1e6","1.001","-10",""])expect(()=>crcToCents(v)).toThrow()});
 it("neutraliza fórmulas CSV y escapa comillas",()=>{expect(csvCell("=1+1")).toBe('"\'=1+1"');expect(csvCell('Nombre "A"')).toBe('"Nombre ""A"""')});
});

describe("Lógica quincenal GRT (Excel)",()=>{
 // Salario cajero 2026: ₡419,755.93
 const salary=41975593;

 it("horas mes por defecto = 243.36",()=>expect(DEFAULT_HOURS_MONTH).toBe(243.36));
 it("CCSS rate = 10.83%",()=>expect(CCSS_RATE).toBe(0.1083));

 it("adelanto = salario / 2",()=>{
  expect(fortnightAdvanceCents(salary)).toBe(20987797); // ₡209,877.965 → round half up in cents
 });

 it("valor hora redondeado a colón (~1725)",()=>{
  expect(hourlyRateCents(salary,243.36)).toBe(172500); // ₡1,725
 });

 it("CCSS solo sobre adelanto",()=>{
  const advance=fortnightAdvanceCents(salary);
  expect(ccssCents(advance)).toBe(Math.round(advance*0.1083));
  expect(ccssCents(advance,true)).toBe(0);
 });

 it("quincena sin extras coincide con Excel (neto ≈ 187148)",()=>{
  const r=calculateFortnight({monthlySalaryCents:salary,hoursMonth:243.36});
  expect(r.advanceCents).toBe(20987797);
  expect(r.hourlyRateCents).toBe(172500);
  expect(r.otAmountCents).toBe(0);
  expect(r.ccssCents).toBe(Math.round(20987797*0.1083));
  expect(r.netCents).toBe(r.advanceCents-r.ccssCents);
  // Excel: 187148.18 → 18714818 cents (±1 por redondeo)
  expect(Math.abs(r.netCents-18714818)).toBeLessThanOrEqual(1);
 });

 it("extras 1.5× y doble 2×",()=>{
  const r=calculateFortnight({monthlySalaryCents:salary,otHours:2,doubleHours:1});
  expect(r.otAmountCents).toBe(Math.round(2*172500*1.5)); // ₡5,175
  expect(r.doubleRateCents).toBe(345000);
  expect(r.doubleAmountCents).toBe(345000);
  expect(r.additionCents).toBe(r.otAmountCents+r.doubleAmountCents);
 });

 it("faltantes y facturas suman a deducciones con CCSS",()=>{
  const r=calculateFortnight({
   monthlySalaryCents:salary,
   shortageCents:537500,
   receiptCents:10000,
  });
  expect(r.deductionCents).toBe(r.ccssCents+537500+10000);
 });

 it("exento de CCSS (caso Elmer)",()=>{
  const r=calculateFortnight({monthlySalaryCents:60000000,exemptFromCcss:true});
  expect(r.advanceCents).toBe(30000000);
  expect(r.ccssCents).toBe(0);
  expect(r.netCents).toBe(30000000);
 });

 it("aguinaldo = (ordinario + extras) / 12",()=>{
  expect(aguinaldoCents(4_190_827_20,1_523_661_00)).toBe(Math.round((4_190_827_20+1_523_661_00)/12));
 });

 it("límites de quincena",()=>{
  expect(fortnightBounds("2026-10",1)).toEqual({start:"2026-10-01",end:"2026-10-15"});
  expect(fortnightBounds("2026-10",2)).toEqual({start:"2026-10-16",end:"2026-10-31"});
  expect(fortnightBounds("2026-02",2)).toEqual({start:"2026-02-16",end:"2026-02-28"});
 });
});
