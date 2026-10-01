import {requireRole} from "@/lib/auth";import {Kiosk} from "./terminal";
export const dynamic="force-dynamic";
export default async function Page(){await requireRole("kiosk");return <Kiosk/>}
