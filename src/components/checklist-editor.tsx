"use client";
import {useId,useState} from "react";
import {Camera,NotebookPen,Plus,Trash2} from "lucide-react";

export type ChecklistDraftItem={
 label:string;
 requires_photo:boolean;
 for_bitacora:boolean;
};

type Props={
 name?:string;
 initial?:ChecklistDraftItem[];
};

const empty=():ChecklistDraftItem=>({label:"",requires_photo:false,for_bitacora:false});

export function ChecklistEditor({name="items_json",initial}:Props){
 const baseId=useId();
 const [items,setItems]=useState<ChecklistDraftItem[]>(
  initial?.length?initial.map(i=>({...i})): [empty()]
 );

 function update(i:number,patch:Partial<ChecklistDraftItem>){
  setItems(prev=>prev.map((row,idx)=>idx===i?{...row,...patch}:row));
 }
 function remove(i:number){
  setItems(prev=>prev.length<=1?[empty()]:prev.filter((_,idx)=>idx!==i));
 }
 function add(){
  setItems(prev=>[...prev,empty()]);
 }

 const payload=JSON.stringify(
  items
   .map(i=>({
    label:i.label.trim(),
    requires_photo:i.requires_photo,
    for_bitacora:i.for_bitacora,
   }))
   .filter(i=>i.label.length>0)
 );

 return (
  <div className="checklist-editor">
   <div className="checklist-editor-head">
    <span>Checklist</span>
    <span className="muted small checklist-editor-legend">
     <Camera size={14} aria-hidden="true"/> foto · <NotebookPen size={14} aria-hidden="true"/> bitácora
    </span>
   </div>
   <ul className="checklist-editor-list">
    {items.map((item,i)=>(
     <li key={`${baseId}-${i}`} className="checklist-editor-row">
      <input
       type="text"
       value={item.label}
       onChange={e=>update(i,{label:e.target.value})}
       placeholder={`Ítem ${i+1}`}
       maxLength={200}
       aria-label={`Ítem ${i+1}`}
      />
      <label className="checklist-flag" title="Requiere foto de evidencia">
       <input
        type="checkbox"
        checked={item.requires_photo}
        onChange={e=>update(i,{requires_photo:e.target.checked})}
        aria-label="Requiere foto"
       />
       <Camera size={16} aria-hidden="true"/>
      </label>
      <label className="checklist-flag" title="Incluir en bitácora imprimible">
       <input
        type="checkbox"
        checked={item.for_bitacora}
        onChange={e=>update(i,{for_bitacora:e.target.checked})}
        aria-label="Incluir en bitácora"
       />
       <NotebookPen size={16} aria-hidden="true"/>
      </label>
      <button type="button" className="btn-icon checklist-remove" onClick={()=>remove(i)} aria-label="Quitar ítem">
       <Trash2 size={15}/>
      </button>
     </li>
    ))}
   </ul>
   <button type="button" className="secondary btn-sm" onClick={add}>
    <Plus size={15}/> Agregar ítem
   </button>
   <input type="hidden" name={name} value={payload}/>
  </div>
 );
}
