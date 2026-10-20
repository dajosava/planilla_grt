import {requireRole} from "@/lib/auth";
import {
 fetchPayrollHistory,
 parseHistoryFilters,
 payrollHistoryToCsv,
} from "@/lib/payroll-history";

export async function GET(req:Request){
 const {client}=await requireRole("admin");
 const url=new URL(req.url);
 const filters=parseHistoryFilters({
  desde:url.searchParams.get("desde")??undefined,
  hasta:url.searchParams.get("hasta")??undefined,
  estado:url.searchParams.get("estado")??undefined,
  empresa:url.searchParams.get("empresa")??undefined,
  emp:url.searchParams.getAll("emp"),
 });
 if(!filters.empIds.length){
  return new Response("Seleccioná al menos un empleado.",{status:400});
 }
 try{
  const rows=await fetchPayrollHistory(client,filters);
  const name=`historial-pagos-${filters.desde}_${filters.hasta}.csv`;
  return new Response(payrollHistoryToCsv(rows),{
   headers:{
    "Content-Type":"text/csv; charset=utf-8",
    "Content-Disposition":`attachment; filename="${name}"`,
    "Cache-Control":"private, no-store",
   },
  });
 }catch(e){
  return new Response(e instanceof Error?e.message:"No se pudo generar el reporte",{status:500});
 }
}
