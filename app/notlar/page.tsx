import Link from "next/link";
import { requireProfile } from "@/lib/auth/profile";
import AttendanceReminderPanel from "../yoklama/attendance-reminder-panel";
export const dynamic="force-dynamic";
export default async function NotesPage(){
  await requireProfile(["owner","admin","branch_manager","registration_staff","accounting","coach"]);
  return <main style={{maxWidth:1000,margin:"0 auto",padding:"20px 12px"}}><h1>Notlar</h1><p>Yoklamada kaydedilen hızlı notlar ve tamamlanan işlemler.</p><Link href="/yoklama">Yoklamaya Dön</Link><AttendanceReminderPanel students={[]} showCompleted/></main>;
}
