import type {Metadata,Viewport} from "next";
import {Inter} from "next/font/google";
import {SerwistProvider} from "@serwist/turbopack/react";
import "./globals.css";

const inter=Inter({subsets:["latin"],variable:"--font-inter",display:"swap"});

const APP_NAME="Gasolinera Río Tempisque";
const APP_TITLE="Gasolinera Río Tempisque";
const APP_DESCRIPTION="Operaciones de estación, asistencia y planilla — Pueblo Viejo, Nicoya";

export const metadata:Metadata={
 applicationName:APP_NAME,
 title:{default:APP_TITLE,template:"%s · Gasolinera Río Tempisque"},
 description:APP_DESCRIPTION,
 manifest:"/manifest.webmanifest",
 appleWebApp:{
  capable:true,
  statusBarStyle:"black-translucent",
  title:"Río Tempisque",
 },
 formatDetection:{telephone:false},
 icons:{
  icon:[
   {url:"/icons/favicon-32.png",sizes:"32x32",type:"image/png"},
   {url:"/icons/icon-192.png",sizes:"192x192",type:"image/png"},
  ],
  apple:[{url:"/icons/apple-touch-icon.png",sizes:"180x180",type:"image/png"}],
 },
 openGraph:{
  type:"website",
  siteName:APP_NAME,
  title:APP_TITLE,
  description:APP_DESCRIPTION,
 },
 twitter:{
  card:"summary",
  title:APP_TITLE,
  description:APP_DESCRIPTION,
 },
};

export const viewport:Viewport={
 themeColor:"#0A1628",
 colorScheme:"dark",
 width:"device-width",
 initialScale:1,
 viewportFit:"cover",
};

export default function Layout({children}:{children:React.ReactNode}){
 const disableSw=process.env.NODE_ENV==="development";

 return (
  <html lang="es" className={inter.variable}>
   <body className={inter.className}>
    <SerwistProvider
     swUrl="/serwist/sw.js"
     disable={disableSw}
     cacheOnNavigation={false}
     reloadOnOnline
    >
     {children}
    </SerwistProvider>
   </body>
  </html>
 );
}
