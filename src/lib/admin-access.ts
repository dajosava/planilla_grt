/**
 * Segmento de URL del login oculto (sin slash).
 * Configurá ADMIN_LOGIN_PATH en Netlify / .env.local (ej. acceso-grt-7k2m).
 * No uses "login" ni "admin".
 */
export function adminLoginSegment():string{
 const raw=(process.env.ADMIN_LOGIN_PATH??"acceso-grt-7k2m").trim().replace(/^\/+|\/+$/g,"");
 if(!raw||raw==="login"||raw==="admin"||raw.includes("/")||raw.includes("..")){
  return "acceso-grt-7k2m";
 }
 return raw;
}

export function adminLoginPath():string{
 return `/${adminLoginSegment()}`;
}
