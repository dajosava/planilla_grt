import type {ReactNode} from "react";
import {ChevronDown} from "lucide-react";
import {EmptyState} from "@/components/ui/empty-state";

export function Heading({title,description,actions}:{title:string;description?:string;actions?:ReactNode}){
 return <div className="page-heading">
  <p className="eyebrow">GASOLINERA RÍO TEMPISQUE</p>
  <div className="page-heading-row">
   <h1>{title}</h1>
   {actions?<div className="actions">{actions}</div>:null}
  </div>
  {description?<p className="muted page-heading-desc">{description}</p>:null}
 </div>;
}
export function Panel({title,children,action}:{title:string;children:ReactNode;action?:ReactNode}){
 return <section className="panel">
  {(title||action)&&<div className="panel-head"><h2>{title}</h2>{action}</div>}
  {children}
 </section>;
}
/** Formularios y paneles de captura: colapsados por defecto. */
export function CollapsiblePanel({title,children,open=false}:{title:string;children:ReactNode;open?:boolean}){
 return (
  <details className="panel collapsible" {...(open?{open:true}:{})}>
   <summary>
    <h2>{title}</h2>
    <ChevronDown size={18} className="collapsible-chevron" aria-hidden="true"/>
   </summary>
   <div className="collapsible-body">{children}</div>
  </details>
 );
}
export function Empty({text="Todavía no hay registros."}:{text?:string}){
 return <EmptyState text={text}/>;
}
export function Table({headers,children}:{headers:string[];children:ReactNode}){
 return <div className="table-scroll"><table><thead><tr>{headers.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{children}</tbody></table></div>;
}
