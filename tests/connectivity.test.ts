import {describe,expect,it,vi} from "vitest";
import {HEALTH_PATH,probeReachability} from "../src/lib/connectivity";

type FetchFn=typeof fetch;

describe("probeReachability",()=>{
 it("devuelve true si el health responde ok",async()=>{
  const fetchImpl=vi.fn<FetchFn>(async()=>new Response("ok",{status:200}));
  await expect(probeReachability({fetchImpl,url:HEALTH_PATH})).resolves.toBe(true);
  expect(fetchImpl).toHaveBeenCalledOnce();
  const init=fetchImpl.mock.calls[0]?.[1];
  expect(init?.cache).toBe("no-store");
  expect(init?.method).toBe("GET");
 });

 it("devuelve false si el status no es ok",async()=>{
  const fetchImpl=vi.fn<FetchFn>(async()=>new Response("no",{status:503}));
  await expect(probeReachability({fetchImpl,url:HEALTH_PATH})).resolves.toBe(false);
 });

 it("devuelve false si fetch falla (red caída)",async()=>{
  const fetchImpl=vi.fn<FetchFn>(async()=>{throw new TypeError("Failed to fetch");});
  await expect(probeReachability({fetchImpl,url:HEALTH_PATH})).resolves.toBe(false);
 });

 it("aborta por timeout y devuelve false",async()=>{
  const fetchImpl=vi.fn<FetchFn>((_url,init)=>new Promise<Response>((_resolve,reject)=>{
   init?.signal?.addEventListener("abort",()=>reject(new DOMException("Aborted","AbortError")));
  }));
  await expect(probeReachability({fetchImpl,url:HEALTH_PATH,timeoutMs:30})).resolves.toBe(false);
 });
});
