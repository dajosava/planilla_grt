import {money} from "@/lib/format";
import type {ComprobanteLine} from "@/components/comprobante-pago";

function esc(v:string){
 return v
  .replace(/&/g,"&amp;")
  .replace(/</g,"&lt;")
  .replace(/>/g,"&gt;")
  .replace(/"/g,"&quot;");
}

function rowIncome(r:ComprobanteLine){
 if(!r.label&&!r.amountCents)return "";
 return `<tr>
  <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb">${esc(r.label)}</td>
  <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:right">${esc(r.hours??"")}</td>
  <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:right">${r.amountCents?esc(money(r.amountCents)):""}</td>
 </tr>`;
}

function rowDed(r:ComprobanteLine){
 if(!r.label&&!r.amountCents)return "";
 return `<tr>
  <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb">${esc(r.label)}</td>
  <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:right">${r.amountCents?esc(money(r.amountCents)):""}</td>
 </tr>`;
}

export function buildPayslipEmailHtml(opts:{
 companyName:string;
 employeeName:string;
 employeeCode:string;
 department:string;
 position:string;
 section:string;
 periodLabel:string;
 income:ComprobanteLine[];
 deductions:ComprobanteLine[];
 note?:string|null;
}):{subject:string;html:string;text:string;netPay:string}{
 const income=opts.income.filter(r=>r.amountCents>0||r.label);
 const deductions=opts.deductions.filter(r=>r.amountCents>0||r.label);
 const totalIncome=income.reduce((s,r)=>s+r.amountCents,0);
 const totalDed=deductions.reduce((s,r)=>s+r.amountCents,0);
 const net=Math.max(0,totalIncome-totalDed);
 const netPay=money(net);

 const subject=`Comprobante de pago · ${opts.periodLabel} · ${opts.employeeName}`;

 const html=`<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/></head>
<body style="margin:0;padding:24px;background:#0A1628;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
 <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden">
  <div style="background:#0E7C4A;color:#fff;padding:18px 22px">
   <p style="margin:0;font-size:12px;letter-spacing:.06em;text-transform:uppercase;opacity:.9">${esc(opts.companyName)}</p>
   <h1 style="margin:6px 0 0;font-size:22px">Comprobante de Pago</h1>
  </div>
  <div style="padding:22px">
   <p style="margin:0 0 14px;font-size:14px;color:#334155">Hola <strong>${esc(opts.employeeName)}</strong>, adjuntamos tu colilla de la quincena.</p>
   <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:18px">
    <tr><td style="padding:4px 0;color:#64748b">Código</td><td style="padding:4px 0;text-align:right"><strong>${esc(opts.employeeCode)}</strong></td></tr>
    <tr><td style="padding:4px 0;color:#64748b">Departamento</td><td style="padding:4px 0;text-align:right"><strong>${esc(opts.department)}</strong></td></tr>
    <tr><td style="padding:4px 0;color:#64748b">Puesto</td><td style="padding:4px 0;text-align:right"><strong>${esc(opts.position||"—")}</strong></td></tr>
    <tr><td style="padding:4px 0;color:#64748b">Sección</td><td style="padding:4px 0;text-align:right"><strong>${esc(opts.section)}</strong></td></tr>
    <tr><td style="padding:4px 0;color:#64748b">Periodo</td><td style="padding:4px 0;text-align:right"><strong>${esc(opts.periodLabel)}</strong></td></tr>
   </table>

   <h2 style="margin:0 0 8px;font-size:15px;color:#0E7C4A">Ingresos</h2>
   <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px">
    <thead>
     <tr style="background:#f1f5f9">
      <th style="text-align:left;padding:8px 10px">Concepto</th>
      <th style="text-align:right;padding:8px 10px">Horas</th>
      <th style="text-align:right;padding:8px 10px">Monto</th>
     </tr>
    </thead>
    <tbody>
     ${income.map(rowIncome).join("")||`<tr><td colspan="3" style="padding:8px 10px;color:#64748b">Sin ingresos</td></tr>`}
     <tr>
      <td colspan="2" style="padding:10px;font-weight:700">Total ingresos</td>
      <td style="padding:10px;text-align:right;font-weight:700">${esc(money(totalIncome))}</td>
     </tr>
    </tbody>
   </table>

   <h2 style="margin:0 0 8px;font-size:15px;color:#0E7C4A">Deducciones</h2>
   <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px">
    <thead>
     <tr style="background:#f1f5f9">
      <th style="text-align:left;padding:8px 10px">Concepto</th>
      <th style="text-align:right;padding:8px 10px">Monto</th>
     </tr>
    </thead>
    <tbody>
     ${deductions.map(rowDed).join("")||`<tr><td colspan="2" style="padding:8px 10px;color:#64748b">Sin deducciones</td></tr>`}
     <tr>
      <td style="padding:10px;font-weight:700">Total deducciones</td>
      <td style="padding:10px;text-align:right;font-weight:700">${esc(money(totalDed))}</td>
     </tr>
    </tbody>
   </table>

   <div style="background:#ecfdf5;border:1px solid #86efac;border-radius:10px;padding:14px 16px;margin-bottom:16px">
    <p style="margin:0;font-size:13px;color:#166534">Neto a pagar</p>
    <p style="margin:4px 0 0;font-size:24px;font-weight:700;color:#0E7C4A">${esc(netPay)}</p>
   </div>

   ${opts.note?`<p style="font-size:12px;color:#64748b;white-space:pre-wrap">${esc(opts.note)}</p>`:""}
   <p style="margin:18px 0 0;font-size:11px;color:#94a3b8">Gasolinera Río Tempisque · Pueblo Viejo, Nicoya. Este correo es informativo.</p>
  </div>
 </div>
</body>
</html>`;

 const text=[
  `Comprobante de pago — ${opts.companyName}`,
  `Colaborador: ${opts.employeeName} (${opts.employeeCode})`,
  `Periodo: ${opts.periodLabel}`,
  `Total ingresos: ${money(totalIncome)}`,
  `Total deducciones: ${money(totalDed)}`,
  `Neto a pagar: ${netPay}`,
 ].join("\n");

 return {subject,html,text,netPay};
}
