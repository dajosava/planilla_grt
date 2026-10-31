/**
 * Genera iconos PWA a partir de public/logo-grt.png
 * Uso: node scripts/generate-pwa-icons.mjs
 */
import {mkdir,readFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import sharp from "sharp";

const root=path.join(path.dirname(fileURLToPath(import.meta.url)),"..");
const logoPath=path.join(root,"public","logo-grt.png");
const outDir=path.join(root,"public","icons");
const BG="#0A1628";

async function makeIcon(size,fileName,{maskable=false}={}){
 const pad=maskable?Math.round(size*0.18):Math.round(size*0.12);
 const logoSize=size-pad*2;
 const logo=await sharp(await readFile(logoPath))
  .resize(logoSize,logoSize,{fit:"contain",background:{r:0,g:0,b:0,alpha:0}})
  .png()
  .toBuffer();

 await sharp({
  create:{width:size,height:size,channels:4,background:BG},
 })
  .composite([{input:logo,gravity:"center"}])
  .png()
  .toFile(path.join(outDir,fileName));
}

await mkdir(outDir,{recursive:true});
await Promise.all([
 makeIcon(192,"icon-192.png"),
 makeIcon(512,"icon-512.png"),
 makeIcon(512,"icon-512-maskable.png",{maskable:true}),
 makeIcon(180,"apple-touch-icon.png"),
 makeIcon(32,"favicon-32.png"),
]);
console.log("Iconos PWA generados en public/icons/");
