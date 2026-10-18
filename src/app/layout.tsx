import type {Metadata} from "next";
import {Inter} from "next/font/google";
import "./globals.css";

const inter=Inter({subsets:["latin"],variable:"--font-inter",display:"swap"});

export const metadata:Metadata={
 title:{default:"Gasolinera Río Tempisque",template:"%s · Gasolinera Río Tempisque"},
 description:"Operaciones de estación, asistencia y planilla — Pueblo Viejo, Nicoya",
};

export default function Layout({children}:{children:React.ReactNode}){
 return <html lang="es" className={inter.variable}><body className={inter.className}>{children}</body></html>;
}
