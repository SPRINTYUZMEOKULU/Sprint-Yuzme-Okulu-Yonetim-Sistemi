import MakeupReminders from "../ders-operasyonlari/makeup-reminders";
import { requireProfile } from "@/lib/auth/profile";
import CompensationManagementClient from "./compensation-management-client";
import "../ogrenciler/[id]/compensation-plan.css";
import "./compensation-management.css";
export const dynamic="force-dynamic";
export default async function Page(){await requireProfile(["owner","admin","branch_manager"]);return <><MakeupReminders/><CompensationManagementClient/></>}
