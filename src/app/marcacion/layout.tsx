import type {Metadata,Viewport} from "next";
import {KioskLock} from "@/components/kiosk-lock";

export const metadata:Metadata={
 title:"Marcación",
 robots:{index:false,follow:false},
};

/** Tablet kiosco: sin zoom ni pan horizontal. */
export const viewport:Viewport={
 themeColor:"#FFFFFF",
 colorScheme:"light",
 width:"device-width",
 initialScale:1,
 minimumScale:1,
 maximumScale:1,
 userScalable:false,
 viewportFit:"cover",
};

export default function MarcacionLayout({children}:{children:React.ReactNode}){
 return <KioskLock>{children}</KioskLock>;
}
