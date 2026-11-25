import {notFound} from "next/navigation";
import {Kiosk} from "../terminal";

export const dynamic="force-dynamic";

/** Solo en desarrollo: UI de marcación sin login ni punches reales. */
export default function MarcacionPreviewPage(){
 if(process.env.NODE_ENV!=="development")notFound();
 return <Kiosk mode="preview"/>;
}
