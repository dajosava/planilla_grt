import {requireRole} from "@/lib/auth";
import {logout} from "@/app/login/actions";
import {AdminShell} from "@/components/layout/admin-shell";
import {parseKioskPresenceList,PRESENCE_STALE_SECONDS,type KioskPresenceList} from "@/lib/kiosk-presence";

export const dynamic="force-dynamic";

export default async function Layout({children}:{children:React.ReactNode}){
 const {client,profile}=await requireRole("admin");
 let late=0,incidents=0,reminders=0,ot=0,attendance=0;
 let kioskPresence:KioskPresenceList|null=null;
 try{
  const [a,b,c,d,e,f]=await Promise.all([
   client.from("tasks").select("id",{count:"exact",head:true}).in("status",["pending","in_progress"]).lt("due_at",new Date().toISOString()),
   client.from("incidents").select("id",{count:"exact",head:true}).in("status",["open","assigned"]).eq("severity","critical"),
   client.rpc("count_reminder_alerts"),
   client.rpc("count_pending_payroll_ot"),
   client.rpc("count_attendance_alerts"),
   client.rpc("list_kiosk_presence",{p_stale_seconds:PRESENCE_STALE_SECONDS}),
  ]);
  late=a.count??0;incidents=b.count??0;
  reminders=typeof c.data==="number"?c.data:0;
  ot=typeof d.data==="number"?d.data:0;
  attendance=typeof e.data==="number"?e.data:0;
  kioskPresence=parseKioskPresenceList(f.data);
 }catch{/* ops/reminders/ot/asistencia/presence RPCs may be missing */}
 return (
  <AdminShell
   displayName={profile.display_name||"Administrador"}
   logoutAction={logout}
   badges={{late,incidents,reminders,ot,attendance}}
   kioskPresence={kioskPresence}
  >
   {children}
  </AdminShell>
 );
}
