import "server-only";
import { redirect } from "next/navigation";
import { supabase, configured } from "./supabase/server";
export async function requireRole(role: "admin" | "kiosk") {
 // Sin sesión → home (no revelar la ruta del login).
 if (!configured()) redirect("/");
 const client = await supabase();
 const {data, error} = await client.auth.getUser();
 if (error || !data.user) redirect("/");
 const {data: profile} = await client.from("profiles").select("role, display_name").eq("id",data.user.id).single();
 if (!profile || profile.role !== role) redirect("/acceso-denegado");
 return {client, user: data.user, profile};
}
