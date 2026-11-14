import type {Metadata,Viewport} from "next";
import {KioskLock} from "@/components/kiosk-lock";

export const metadata:Metadata={
 title:"Operaciones",
 robots:{index:false,follow:false},
};

export const viewport:Viewport={
 themeColor:"#0A1628",
 colorScheme:"dark",
 width:"device-width",
 initialScale:1,
 minimumScale:1,
 maximumScale:1,
 userScalable:false,
 viewportFit:"cover",
};

export default function OperacionesLayout({children}:{children:React.ReactNode}){
 return <KioskLock>{children}</KioskLock>;
}
