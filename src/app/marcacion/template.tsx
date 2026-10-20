import {PageTransition} from "@/components/page-transition";

export default function MarcacionTemplate({children}:{children:React.ReactNode}){
 return <PageTransition>{children}</PageTransition>;
}
