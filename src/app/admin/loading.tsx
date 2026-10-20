import {ViewTransition} from "react";
import {PageSkeleton} from "@/components/ui/skeleton";

export default function Loading(){
 return (
  <ViewTransition exit="page-exit" default="none">
   <PageSkeleton/>
  </ViewTransition>
 );
}
