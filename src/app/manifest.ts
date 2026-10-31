import type {MetadataRoute} from "next";

export default function manifest():MetadataRoute.Manifest{
 return {
  name:"Gasolinera Río Tempisque",
  short_name:"Río Tempisque",
  description:"Operaciones de estación, asistencia y planilla — Pueblo Viejo, Nicoya",
  start_url:"/",
  scope:"/",
  display:"standalone",
  orientation:"portrait-primary",
  background_color:"#0A1628",
  theme_color:"#0A1628",
  lang:"es-CR",
  categories:["business","productivity"],
  icons:[
   {src:"/icons/icon-192.png",sizes:"192x192",type:"image/png",purpose:"any"},
   {src:"/icons/icon-512.png",sizes:"512x512",type:"image/png",purpose:"any"},
   {src:"/icons/icon-512-maskable.png",sizes:"512x512",type:"image/png",purpose:"maskable"},
  ],
 };
}
