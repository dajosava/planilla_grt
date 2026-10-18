export function Avatar({name,className=""}:{name:string;className?:string}){
 const initials=name.split(/\s+/).filter(Boolean).slice(0,2).map(p=>p[0]?.toUpperCase()??"").join("")||"?";
 return <span className={`avatar ${className}`.trim()} aria-hidden="true">{initials}</span>;
}
