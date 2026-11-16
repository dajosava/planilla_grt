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

 it("04:45–13:00 → Diurna (tolerancia 20 min antes de 05:00)",()=>{
  const r=classifyShift("2026-03-15T04:45:00-06:00",d("13:00"));
  expect(r.type).toBe("DAY");
  expect(r.nightMinutes).toBe(0);
  expect(r.legalOrdinaryLimitHours).toBe(8);
  expect(r.workedMinutes).toBe(8*60+15); // conserva entrada real 04:45
 });

 it("04:40–12:40 → Diurna (límite inferior de la tolerancia)",()=>{
  const r=classifyShift("2026-03-15T04:40:00-06:00","2026-03-15T12:40:00-06:00");
  expect(r.type).toBe("DAY");
  expect(r.nightMinutes).toBe(0);
 });

 it("04:39–12:39 → Mixta (fuera de tolerancia)",()=>{
  const r=classifyShift("2026-03-15T04:39:00-06:00","2026-03-15T12:39:00-06:00");
  expect(r.type).toBe("MIXED");
  expect(r.nightMinutes).toBe(21); // 04:39–05:00
 });

 it("04:59–13:00 → Diurna (límite superior de la tolerancia)",()=>{
  const r=classifyShift("2026-03-15T04:59:00-06:00",d("13:00"));
  expect(r.type).toBe("DAY");
  expect(r.nightMinutes).toBe(0);
 });

 it("calcula OT con umbral de 30 min (menos de 30 → 0; 30+ → total)",()=>{
  const night=classifyShift(d("15:00"),d("23:00")); // lim 6 h
  expect(overtimeHours(6,night)).toBe(0);
  expect(overtimeHours(6.25,night)).toBe(0); // 15 min < umbral
  expect(overtimeHours(6.5,night)).toBe(0.5); // 30 min exactos → se registra
  expect(overtimeHours(7,night)).toBe(1); // 1 h completa
  const day=classifyShift(d("06:00"),d("14:00")); // lim 8 h
  expect(overtimeHours(8.25,day)).toBe(0);
  expect(overtimeHours(8.5,day)).toBe(0.5);
  expect(overtimeHours(9,day)).toBe(1);
 });
});
