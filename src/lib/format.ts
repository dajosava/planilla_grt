export const money = (cents: number) => new Intl.NumberFormat("es-CR", { style: "currency", currency: "CRC" }).format(cents / 100);
export const dateTime = (date: string) => new Intl.DateTimeFormat("es-CR", {timeZone:"America/Costa_Rica", dateStyle:"short",timeStyle:"short"}).format(new Date(date));
export const todayCR = () => new Intl.DateTimeFormat("en-CA", {timeZone:"America/Costa_Rica",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
export const dateOnly = (date: string) => new Intl.DateTimeFormat("es-CR", {timeZone:"UTC", dateStyle:"medium"}).format(new Date(date+"T00:00:00Z"));
export const cedula = (value: string | null | undefined) => {
 if(!value) return "Sin cédula";
 const digits=value.replace(/\D/g,"");
 return digits.length===9?`${digits[0]}-${digits.slice(1,5)}-${digits.slice(5)}`:digits;
};
export const labels: Record<string,string> = {entry:"Entrada",exit:"Salida",break_start:"Inicio de descanso",break_end:"Fin de descanso",vacation:"Vacaciones",sick:"Incapacidad",permission:"Permiso",pending:"Pendiente",approved:"Aprobada",rejected:"Rechazada",draft:"Borrador",closed:"Cerrada"};
