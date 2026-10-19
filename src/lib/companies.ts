/** Tres sociedades del cliente: cada una tiene su planilla. */
export const COMPANIES=["Gasolinera","Supermercado","Transporte"] as const;
export type Company=(typeof COMPANIES)[number];

export function isCompany(v:string):v is Company{
 return (COMPANIES as readonly string[]).includes(v);
}

export function parseCompany(v:string|string[]|undefined,fallback:Company="Gasolinera"):Company{
 return typeof v==="string"&&isCompany(v)?v:fallback;
}
