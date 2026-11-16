import {describe,expect,it} from "vitest";
import {classifyShift,overtimeHours} from "../src/lib/shift-cr";

const d=(h:string)=>`2026-03-15T${h}:00-06:00`;
const next=(h:string)=>`2026-03-16T${h}:00-06:00`;

describe("classifyShift (Código de Trabajo CR)",()=>{
 it("06:00–14:00 → Diurna (0 h nocturnas)",()=>{
  const r=classifyShift(d("06:00"),d("14:00"));
  expect(r.type).toBe("DAY");
  expect(r.nightMinutes).toBe(0);
  expect(r.legalOrdinaryLimitHours).toBe(8);
 });

 it("12:00–20:00 → Mixta (1 h nocturna)",()=>{
  const r=classifyShift(d("12:00"),d("20:00"));
  expect(r.type).toBe("MIXED");
  expect(r.nightMinutes).toBe(60);
  expect(r.legalOrdinaryLimitHours).toBe(7);
 });

 it("14:00–22:00 → Mixta (3 h nocturnas)",()=>{
  const r=classifyShift(d("14:00"),d("22:00"));
  expect(r.type).toBe("MIXED");
  expect(r.nightMinutes).toBe(180);
 });

 it("15:00–23:00 → Nocturna (4 h ≥ 3h30)",()=>{
  const r=classifyShift(d("15:00"),d("23:00"));
  expect(r.type).toBe("NIGHT");
  expect(r.nightMinutes).toBe(240);
  expect(r.legalOrdinaryLimitHours).toBe(6);
 });

 it("18:00–02:00 (+1) → Nocturna",()=>{
  const r=classifyShift(d("18:00"),next("02:00"));
  expect(r.type).toBe("NIGHT");
  expect(r.nightMinutes).toBe(420); // 19:00–02:00
  expect(r.dayMinutes).toBe(60); // 18:00–19:00
 });

 it("22:00–06:00 (+1) → Nocturna",()=>{
  const r=classifyShift(d("22:00"),next("06:00"));
  expect(r.type).toBe("NIGHT");
  expect(r.nightMinutes).toBe(420); // 22:00–05:00
  expect(r.dayMinutes).toBe(60); // 05:00–06:00
 });

 it("03:00–11:00 → Mixta (2 h nocturnas)",()=>{
  const r=classifyShift(d("03:00"),d("11:00"));
  expect(r.type).toBe("MIXED");
  expect(r.nightMinutes).toBe(120);
 });

 it("calcula OT sobre el límite de la jornada",()=>{
  const night=classifyShift(d("15:00"),d("23:00"));
  expect(overtimeHours(7,night)).toBe(1);
  expect(overtimeHours(6,night)).toBe(0);
  const day=classifyShift(d("06:00"),d("14:00"));
  expect(overtimeHours(8.5,day)).toBe(0.5);
 });
});
