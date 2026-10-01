import type {ReactNode} from "react";
export function Heading({title,description}:{title:string;description:string}){return <div className="page-heading"><p className="eyebrow">GASOLINERA RÍO TEMPISQUE / ADMINISTRACIÓN</p><h1>{title}</h1><p className="muted">{description}</p></div>}
export function Panel({title,children}:{title:string;children:ReactNode}){return <section className="panel"><h2>{title}</h2>{children}</section>}
export function Empty({text="Todavía no hay registros."}:{text?:string}){return <div className="empty">{text}</div>}
export function Table({headers,children}:{headers:string[];children:ReactNode}){return <div className="table-scroll"><table><thead><tr>{headers.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{children}</tbody></table></div>}
