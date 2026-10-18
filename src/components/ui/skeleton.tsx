export function Skeleton({height=16,width="100%"}:{height?:number;width?:string|number}){
 return <div className="skeleton" style={{height,width}} aria-hidden="true"/>;
}
export function PageSkeleton(){
 return <div aria-busy="true" aria-label="Cargando">
  <Skeleton height={28} width="42%"/><div style={{height:12}}/>
  <Skeleton height={64}/><div style={{height:16}}/>
  <div className="stats">{[1,2,3,4,5].map(i=><Skeleton key={i} height={108}/>)}</div>
 </div>;
}
