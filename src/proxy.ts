import {createServerClient} from "@supabase/ssr";
import {NextResponse,type NextRequest} from "next/server";

function loginSegment(){
 const raw=(process.env.ADMIN_LOGIN_PATH ?? "acceso-grt-7k2m").trim().replace(/^\/+|\/+$/g,"");
 if(!raw || raw==="login" || raw==="admin" || raw.includes("/") || raw.includes("..")){
  return "acceso-grt-7k2m";
 }
 return raw;
}

export async function proxy(request:NextRequest){
 const {pathname}=request.nextUrl;
 const secret=`/${loginSegment()}`;

 if(pathname === "/login" || pathname.startsWith("/login/")){
  return NextResponse.redirect(new URL("/",request.url));
 }

 if(pathname === "/login-gate" || pathname.startsWith("/login-gate/")){
  return NextResponse.redirect(new URL("/",request.url));
 }

 const rewriteToGate=pathname === secret || pathname.startsWith(`${secret}/`);
 const gateUrl=request.nextUrl.clone();
 if(rewriteToGate)gateUrl.pathname="/login-gate";

 let response=rewriteToGate
  ?NextResponse.rewrite(gateUrl,{request})
  :NextResponse.next({request});

 if(!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY){
  return response;
 }

 const client=createServerClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  {
   cookies:{
    getAll:()=>request.cookies.getAll(),
    setAll:(items)=>{
     items.forEach(({name,value})=>request.cookies.set(name,value));
     response=rewriteToGate
      ?NextResponse.rewrite(gateUrl,{request})
      :NextResponse.next({request});
     items.forEach(({name,value,options})=>response.cookies.set(name,value,options));
    },
   },
  }
 );
 await client.auth.getClaims();
 response.headers.set("Cache-Control","private, no-store");
 return response;
}

export const config={
 matcher:[
  "/((?!_next/static|_next/image|favicon.ico|icons/|serwist/|manifest\\.webmanifest|logo-grt\\.png|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)",
 ],
};
