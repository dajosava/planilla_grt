import {PageTransition} from "@/components/page-transition";

export default function LoginGateTemplate({children}:{children:React.ReactNode}){
 return <PageTransition>{children}</PageTransition>;
}
