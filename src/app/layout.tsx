import type {Metadata} from "next";
import "./globals.css";
export const metadata:Metadata={title:"Gasolinera Río Tempisque · Planilla",description:"Control de asistencia y administración de personal"};
export default function Layout({children}:{children:React.ReactNode}) {return <html lang="es"><body>{children}</body></html>}
