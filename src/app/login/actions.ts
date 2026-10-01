"use server";
import {redirect} from "next/navigation";import {supabase} from "@/lib/supabase/server";import type {ActionState} from "@/components/action-form";
export async function login(_:ActionState, form:FormData):Promise<ActionState>{
 const email=String(form.get("email")??"").trim();const password=String(form.get("password")??"");
 if(!email||!password) return {error:"Ingresa tu correo y contraseña."};
 const client=await supabase();const {error}=await client.auth.signInWithPassword({email,password});
 if(error) return {error:"No se pudo iniciar sesión. Revisa tus credenciales."};
 const {data}=await client.from("profiles").select("role").single();
 redirect(data?.role==="kiosk"?"/marcacion":"/admin");
}
export async function logout(){const client=await supabase();await client.auth.signOut();redirect("/login");}
