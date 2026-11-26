/// <reference no-default-lib="true" />
/// <reference lib="esnext" />
/// <reference lib="webworker" />
import {defaultCache} from "@serwist/turbopack/worker";
import type {PrecacheEntry,SerwistGlobalConfig} from "serwist";
import {NetworkOnly,Serwist} from "serwist";

declare global{
 interface WorkerGlobalScope extends SerwistGlobalConfig{
  __SW_MANIFEST:(PrecacheEntry|string)[]|undefined;
 }
}

declare const self:ServiceWorkerGlobalScope;

/**
 * `/api/*` no debe cachearse: el default de Serwist usa NetworkFirst (24 h)
 * y eso puede devolver un health “ok” viejo o colgar el probe tras un deploy.
 * Estas rutas van primero (primer match gana).
 */
const apiNetworkOnly={
 matcher:({sameOrigin,url:{pathname}}:{sameOrigin:boolean;url:{pathname:string}})=>
  sameOrigin&&pathname.startsWith("/api/"),
 handler:new NetworkOnly({networkTimeoutSeconds:8}),
};

const serwist=new Serwist({
 precacheEntries:self.__SW_MANIFEST,
 skipWaiting:true,
 clientsClaim:true,
 navigationPreload:true,
 runtimeCaching:[apiNetworkOnly,...defaultCache],
 fallbacks:{
  entries:[
   {
    url:"/~offline",
    matcher({request}){
     return request.destination==="document";
    },
   },
  ],
 },
});

serwist.addEventListeners();
