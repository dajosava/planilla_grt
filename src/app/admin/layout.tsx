import {requireRole} from "@/lib/auth";
import {logout} from "@/app/login/actions";
import {AdminShell} from "@/components/layout/admin-shell";

export const dynamic="force-dynamic";

export default async function Layout({children}:{children:React.ReactNode}){
 const {client,profile}=await requireRole("admin");
 let late=0,incidents=0,reminders=0;
 try{
  const [a,b,c]=await Promise.all([
   client.from("tasks").select("id",{count:"exact",head:true}).in("status",["pending","in_progress"]).lt("due_at",new Date().toISOString()),
   client.from("incidents").select("id",{count:"exact",head:true}).in("status",["open","assigned"]).eq("severity","critical"),
   client.rpc("count_reminder_alerts"),
  ]);
  late=a.count??0;incidents=b.count??0;
  reminders=typeof c.data==="number"?c.data:0;
 }catch{/* ops/reminders tables may be missing */}
 return <AdminShell displayName={profile.display_name||"Administrador"} logoutAction={logout} badges={{late,incidents,reminders}}>{children}</AdminShell>;
}
