import {ViewTransition} from "react";

/** Transición suave al cambiar de ruta (View Transitions API + React 19). */
export function PageTransition({children}:{children:React.ReactNode}){
 return (
  <ViewTransition enter="page-enter" exit="page-exit" default="none">
   {children}
  </ViewTransition>
 );
}
