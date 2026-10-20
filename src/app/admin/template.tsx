import {PageTransition} from "@/components/page-transition";

/** Remonta en cada navegación dentro de /admin → anima solo el contenido. */
export default function AdminTemplate({children}:{children:React.ReactNode}){
 return <PageTransition>{children}</PageTransition>;
}
