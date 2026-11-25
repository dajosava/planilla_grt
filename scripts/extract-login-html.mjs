import fs from "node:fs";

const src="c:/Users/dajos/Downloads/Login Admin Río Tempisque – Login administrador (1).html";
const s=fs.readFileSync(src,"utf8");
const marker='"<!DOCTYPE html>';
const jsonStart=s.indexOf(marker);
if(jsonStart<0)throw new Error("HTML string not found");

let j=jsonStart+1;
let esc=false;
let end=-1;
while(j<s.length){
 const c=s[j];
 if(esc){esc=false;j++;continue}
 if(c==="\\"){esc=true;j++;continue}
 if(c==='"'){end=j;break}
 j++;
}
if(end<0)throw new Error("Unterminated HTML string");

const html=JSON.parse(s.slice(jsonStart,end+1));
const outDir="c:/Users/dajos/Downloads";
fs.writeFileSync(`${outDir}/login-admin-extracted-2.html`,html);
const textOnly=html
 .replace(/<style[\s\S]*?<\/style>/gi,"\n[STYLE]\n")
 .replace(/<script[\s\S]*?<\/script>/gi,"\n[SCRIPT]\n");
fs.writeFileSync(`${outDir}/login-admin-extracted-2.txt`,textOnly);
console.log("html chars",html.length);
console.log(textOnly.slice(0,16000));
