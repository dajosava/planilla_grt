import {PageTransition} from "@/components/page-transition";

export default function OperacionesTemplate({children}:{children:React.ReactNode}){
 return <PageTransition>{children}</PageTransition>;
}
