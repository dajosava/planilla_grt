import {spawnSync} from "node:child_process";
import {createSerwistRoute} from "@serwist/turbopack";

const gitRev=spawnSync("git",["rev-parse","HEAD"],{encoding:"utf-8"});
const revision=(gitRev.stdout||"").trim()||crypto.randomUUID();

export const {dynamic,dynamicParams,revalidate,generateStaticParams,GET}=createSerwistRoute({
 swSrc:"src/app/sw.ts",
 additionalPrecacheEntries:[{url:"/~offline",revision}],
 useNativeEsbuild:true,
});
