import {describe,expect,it} from "vitest";
import {
 applyPunchToOpen,
 openAfterPending,
 validatePunchAgainstOpen,
} from "../src/lib/offline-punches";

describe("validación offline de marcación",()=>{
 it("rechaza segunda entrada si la jornada ya está abierta",()=>{
  expect(validatePunchAgainstOpen(true,"entry")).toEqual({
   ok:false,
   error:expect.stringMatching(/entrada pendiente o abierta/i),
  });
 });

 it("permite entrada si no hay jornada abierta",()=>{
  expect(validatePunchAgainstOpen(false,"entry")).toEqual({ok:true});
 });

 it("rechaza salida sin entrada abierta",()=>{
  expect(validatePunchAgainstOpen(false,"exit")).toEqual({
   ok:false,
   error:expect.stringMatching(/entrada abierta/i),
  });
 });

 it("permite salida con jornada abierta",()=>{
  expect(validatePunchAgainstOpen(true,"exit")).toEqual({ok:true});
 });

 it("applyPunchToOpen: entry abre, exit cierra",()=>{
  expect(applyPunchToOpen(false,"entry")).toBe(true);
  expect(applyPunchToOpen(true,"exit")).toBe(false);
  expect(applyPunchToOpen(true,"break_start")).toBe(true);
 });

 it("simula cola: entry + entry queda abierta (la 2ª se validaría aparte)",()=>{
  expect(openAfterPending(false,[
   {kind:"entry",occurredAt:"2026-11-18T10:00:00.000Z"},
   {kind:"entry",occurredAt:"2026-11-18T10:05:00.000Z"},
  ])).toBe(true);
 });

 it("simula cola: entry + exit vuelve a cerrada y permite otra entrada",()=>{
  const after=openAfterPending(false,[
   {kind:"entry",occurredAt:"2026-11-18T10:00:00.000Z"},
   {kind:"exit",occurredAt:"2026-11-18T18:00:00.000Z"},
  ]);
  expect(after).toBe(false);
  expect(validatePunchAgainstOpen(after,"entry")).toEqual({ok:true});
 });

 it("respeta estado base conocido (entrada online previa)",()=>{
  expect(openAfterPending(true,[])).toBe(true);
  expect(validatePunchAgainstOpen(openAfterPending(true,[]),"entry").ok).toBe(false);
  expect(openAfterPending(true,[
   {kind:"exit",occurredAt:"2026-11-18T18:00:00.000Z"},
  ])).toBe(false);
 });

 it("ordena por occurredAt al simular",()=>{
  expect(openAfterPending(false,[
   {kind:"exit",occurredAt:"2026-11-18T18:00:00.000Z"},
   {kind:"entry",occurredAt:"2026-11-18T10:00:00.000Z"},
  ])).toBe(false);
 });
});
