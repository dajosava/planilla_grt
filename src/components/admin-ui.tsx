import type {ReactNode} from "react";
import {EmptyState} from "@/components/ui/empty-state";

export function Heading({title,description,actions}:{title:string;description:string;actions?:ReactNode}){
 return <div className="page-heading">
  <div className="page-heading-row">
   <div>
    <p className="eyebrow">GASOLINERA RÍO TEMPISQUE</p>
    <h1>{title}</h1>
    <p className="muted">{description}</p>
   </div>
   {actions&&<div className="actions">{actions}</div>}
  </div>
 </div>;
}
export function Panel({title,children,action}:{title:string;children:ReactNode;action?:ReactNode}){
 return <section className="panel">
  {(title||action)&&<div className="panel-head"><h2>{title}</h2>{action}</div>}
  {children}
 </section>;
}
export function CollapsiblePanel({title,children,open=false}:{title:string;children:ReactNode;open?:boolean}){
 return <details className="panel collapsible" open={open}><summary><h2>{title}</h2></summary>{children}</details>;
}
export function Empty({text="Todavía no hay registros."}:{text?:string}){
 return <EmptyState text={text}/>;
}
export function Table({headers,children}:{headers:string[];children:ReactNode}){
 return <div className="table-scroll"><table><thead><tr>{headers.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{children}</tbody></table></div>;
}
