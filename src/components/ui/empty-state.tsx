import type {ReactNode} from "react";
import {ClipboardList} from "lucide-react";

export function EmptyState({text="Todavía no hay registros.",icon}:{text?:string;icon?:ReactNode}){
 return <div className="empty-state" role="status">
  {icon??<ClipboardList size={28} aria-hidden="true"/>}
  <p>{text}</p>
 </div>;
}
