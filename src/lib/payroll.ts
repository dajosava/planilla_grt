import { z } from "zod";
export const payrollInput = z.object({baseCents:z.number().int().min(0).max(100_000_000_00), additionCents:z.number().int().min(0).max(100_000_000_00), deductionCents:z.number().int().min(0).max(100_000_000_00)});
export function calculatePayroll(input: z.infer<typeof payrollInput>) {
 const v = payrollInput.parse(input); const grossCents = v.baseCents + v.additionCents;
 if (v.deductionCents > grossCents) throw new Error("Las deducciones superan el salario bruto.");
 return {grossCents,netCents:grossCents-v.deductionCents};
}
export function crcToCents(value: string): number {
 if (!/^\d{1,9}(\.\d{1,2})?$/.test(value)) throw new Error("Usa un monto positivo con hasta dos decimales, sin separadores de miles.");
 const [whole, fraction=""] = value.split("."); return Number(whole)*100+Number(fraction.padEnd(2,"0"));
}
export function csvCell(value: unknown): string {
 let text = String(value ?? ""); if (/^[=+@\-\t\r\n]/.test(text)) text="'"+text;
 return '"'+text.replaceAll('"','""')+'"';
}
