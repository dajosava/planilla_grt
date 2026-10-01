import {describe,it,expect} from "vitest";import {calculatePayroll,crcToCents,csvCell} from "../src/lib/payroll";
describe("Planilla con centavos enteros",()=>{
 it("calcula bruto y neto sin flotantes",()=>expect(calculatePayroll({baseCents:50000000,additionCents:2500050,deductionCents:5500025})).toEqual({grossCents:52500050,netCents:47000025}));
 it("rechaza deducciones mayores al bruto",()=>expect(()=>calculatePayroll({baseCents:100,additionCents:0,deductionCents:101})).toThrow());
 it("rechaza importes negativos o fraccionarios",()=>{expect(()=>calculatePayroll({baseCents:-1,additionCents:0,deductionCents:0})).toThrow();expect(()=>calculatePayroll({baseCents:1.1,additionCents:0,deductionCents:0})).toThrow()});
 it("convierte decimales de CRC de forma exacta",()=>{expect(crcToCents("123.45")).toBe(12345);expect(crcToCents("0.10")).toBe(10);expect(crcToCents("500000")).toBe(50000000)});
 it("no acepta comas, exponentes ni precisión excesiva",()=>{for(const v of ["1,000","1e6","1.001","-10",""])expect(()=>crcToCents(v)).toThrow()});
 it("neutraliza fórmulas CSV y escapa comillas",()=>{expect(csvCell("=1+1")).toBe('"\'=1+1"');expect(csvCell('Nombre "A"')).toBe('"Nombre ""A"""')});
});
