import {describe,expect,it} from "vitest";
import {parseKioskPresenceList,PRESENCE_STALE_SECONDS} from "../src/lib/kiosk-presence";

describe("parseKioskPresenceList",()=>{
 it("parsea lista vacía / inválida",()=>{
  expect(parseKioskPresenceList(null)).toMatchObject({ok:false,any_online:false,devices:[]});
  expect(parseKioskPresenceList({})).toMatchObject({ok:false,devices:[]});
 });

 it("parsea dispositivos online/offline",()=>{
  const parsed=parseKioskPresenceList({
   ok:true,
   stale_seconds:PRESENCE_STALE_SECONDS,
   any_online:true,
   devices:[
    {
     device_id:"abc-12345678",
     label:"Reloj marcación",
     last_seen_at:"2026-11-21T20:00:00.000Z",
     queue_pending:2,
     online:true,
     seconds_ago:12,
    },
   ],
  });
  expect(parsed.ok).toBe(true);
  expect(parsed.any_online).toBe(true);
  expect(parsed.devices).toHaveLength(1);
  expect(parsed.devices[0]).toMatchObject({
   device_id:"abc-12345678",
   queue_pending:2,
   online:true,
   seconds_ago:12,
  });
 });
});
